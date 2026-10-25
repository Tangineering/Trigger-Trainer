// Generates idealized recordings (one per drill label) into tests/recordings/synthetic/.
// They exercise the replay harness and expectations without a phone. Real recordings replace
// them as the source of truth; keep these as a baseline. Run: npm run synthetic
const fs = require('fs');
const path = require('path');
const TDT = require('../engine.js');

const W = 844, H = 390, FRAME = 1000 / 60, T0 = 1000;
const mid = (z, id) => ({ id, cx: (z.x + z.w / 2) * W, cy: (z.y + z.h / 2) * H, rx: 0, ry: 0 });
const REST = mid(TDT.ZONES.rest, 1);
const TRG = mid(TDT.zoneFor('trigger', W), 2);   // drawn trigger zone, px offset included (D-72)
const between = (t, a, b) => t >= a && t < b;
const r = TDT.r4;

// Each scenario: dur (s), touches(t) -> [touch...], rot(t) -> {a, b, g} in spec axis order (x = beta,
// y = gamma, z = alpha); each recording stores axisMode: 'spec' because 'auto' now means x/y/z order.
const tiny = t => 0.3 * Math.sin(t * 9);   // hand tremor, deg/s
const S = {
  'safe-move': { dur: 3, touches: () => [REST], rot: t => between(t, 0.5, 2.5) ? { a: 60 * Math.sin(t * 6), b: 40 * Math.cos(t * 5), g: 0 } : { a: tiny(t), b: 0, g: 0 } },
  'off-frame-move': { dur: 3.6, touches: t => (t < 1 || t >= 3) ? [REST] : [], rot: t => between(t, 1.6, 2.4) ? { a: 60, b: -30, g: 0 } : { a: tiny(t), b: 0, g: 0 } },
  'off-frame-still': { dur: 3.6, touches: t => (t < 1 || t >= 3) ? [REST] : [], rot: t => ({ a: tiny(t), b: tiny(t + 1), g: 0 }) },
  'clean-press': {
    dur: 3.2,
    touches: t => t < 1 || t >= 2.6 ? [REST]
      : between(t, 1.3, 2.3) ? [Object.assign({}, TRG, { cx: TRG.cx - Math.max(0, Math.min(1, (t - 1.5) / 0.5)) * 70 })] : [],
    rot: t => ({ a: tiny(t), b: tiny(t + 2), g: 0 }),
  },
  'jerked-press': {
    dur: 3.2,
    touches: t => t < 1 || t >= 2.6 ? [REST]
      : between(t, 1.3, 2.3) ? [Object.assign({}, TRG, { cx: TRG.cx - Math.max(0, Math.min(1, (t - 1.85) / 0.15)) * 70 })] : [],
    // Hard jerk at the break: muzzle dips low-left at 120 deg/s, far over the alarm limit.
    rot: t => between(t, 1.85, 2.0) ? { a: -120, b: 40, g: 0 } : { a: tiny(t), b: 0, g: 0 },
  },
  // Slow press (breaks at 2.3 s) while the phone wobbles in short bursts: no single burst is long,
  // but together they exceed the jerk allowance.
  'press-wobble': {
    dur: 3.2,
    touches: t => t < 1 || t >= 2.6 ? [REST]
      : between(t, 1.2, 2.4) ? [Object.assign({}, TRG, { cx: TRG.cx - Math.max(0, Math.min(1, (t - 1.3) / 1.0)) * 70 })] : [],
    rot: t => between(t, 1.5, 2.2) && (t - 1.5) % 0.3 < 0.2 ? { a: 0, b: (Math.floor((t - 1.5) / 0.3) % 2 ? -50 : 50), g: 0 }
      : { a: tiny(t), b: 0, g: 0 },
  },
  // Fingertip rests on the trigger (no pull) while the phone sweeps back and forth.
  'trigger-sweep': {
    dur: 3.2, touches: t => t < 1 || t >= 2.6 ? [REST] : between(t, 1.2, 2.4) ? [TRG] : [],
    rot: t => between(t, 1.6, 2.2) ? { a: 0, b: 60 * Math.sign(Math.sin(t * 20)) || 60, g: 0 } : { a: tiny(t), b: 0, g: 0 },
  },
  // Finger stays on the frame; yaw 120° to the right (past the 180 limit), hold, come back.
  '180-break': {
    dur: 3.6, downrangeAt: 0.3, touches: () => [REST],
    rot: t => between(t, 0.8, 1.6) ? { a: 0, b: -150, g: 0 } : between(t, 2.2, 3.0) ? { a: 0, b: 150, g: 0 } : { a: tiny(t), b: 0, g: 0 },
  },
  // Finger on the frame; 70° right and back, 70° up and back, 70.7° diagonal and back, then a full cant.
  '180-safe': {
    dur: 5.4, downrangeAt: 0.3, touches: () => [REST],
    rot: t => between(t, 0.5, 1.0) ? { a: 0, b: -140, g: 0 } : between(t, 1.0, 1.5) ? { a: 0, b: 140, g: 0 }
      : between(t, 1.5, 2.0) ? { a: 140, b: 0, g: 0 } : between(t, 2.0, 2.5) ? { a: -140, b: 0, g: 0 }
      : between(t, 2.5, 3.0) ? { a: 100, b: -100, g: 0 } : between(t, 3.0, 3.5) ? { a: -100, b: 100, g: 0 }
      : between(t, 3.6, 4.6) ? { a: 0, b: 0, g: 180 } : { a: tiny(t), b: 0, g: 0 },
  },
  // Bill Drill (WQ-027): drillAt 0 logs an 'r' row (fixed seed) right after the opening 'p' row. Finger on the frame from
  // 0 s, the beep falls 1-4 s after arming, so six presses start at 5.2 s (touch the trigger, slide 70 px rearward over
  // 0.25 s, lift at +0.35 s, next press 0.5 s after the last one started), then the finger goes back on the frame.
  // The finger is also off the frame from 1.2 s to 1.9 s: with this seed the beep is due 1.43 s after arming, inside that window,
  // so it is deferred until the finger has been back DRILL_BEEP_HOLD_MS (350 ms): 2.25 s <= beep < 2.3 s + one frame after arming.
  'drill-bill': {
    dur: 9.6, drillAt: 0, drillSeed: 20261025,
    touches: t => {
      if (t < 5.2) return t >= 1.2 && t < 1.9 ? [] : [REST];
      const i = Math.floor((t - 5.2) / 0.5), u = (t - 5.2) - i * 0.5;
      if (i >= 6) return t >= 8.2 ? [REST] : [];
      return u < 0.35 ? [Object.assign({}, TRG, { cx: TRG.cx - Math.max(0, Math.min(1, (u - 0.05) / 0.25)) * 70 })] : [];
    },
    rot: t => ({ a: tiny(t), b: tiny(t + 2), g: 0 }),
  },
  // Low Ready (WQ-028): five reps, seeded. Each rep's beep time depends on the seed (rep 1: 2-5 s after arming; later reps:
  // 2-5 s after the previous cue, which itself falls 750 ms after the finger returns), so no fixed touch schedule can know
  // when the beeps come. This scenario is therefore ADAPTIVE: the generator runs a live engine on the rows it writes
  // (same settings as the replay) and reads engine.state.drill after each frame to decide the next frame's touches:
  // standby -> finger on the frame; from the frame in which a rep's beep is seen: two presses 0.5 s apart (first
  // trigger touch 0.6 s after the beep), then the finger returns to the frame 0.1 s after the last press ends. The
  // log it writes is a plain recording and replays deterministically (replay.js checks it against the same engine).
  // Rep 2 is the "restart" rep: finger back on the frame, lifted 0.4 s later for 0.2 s, back again, so the 750 ms cue
  // timer restarts. Rep 4 has three presses: the extra shot stays in the rep and gives no extra cue. The run ends
  // 0.4 s after the drill end event.
  'drill-low-ready': {
    live: true, drillAt: 0, drillId: 'lowready', drillSeed: 20261026, dur: 0,
    mem: { rep: 0, beep: 0, end: null },
    touches(t, eng) {
      const d = eng.state.drill, m = this.mem;
      if (!d) return [REST];
      if (d.rep !== m.rep) { m.rep = d.rep; m.beep = t; }
      if (d.phase === 'ended' && m.end == null) m.end = t;
      if (m.rep === 0 || d.phase === 'ended') return [REST];
      const u = t - m.beep, n = m.rep === 4 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const uu = u - (0.6 + 0.5 * k);
        if (uu >= 0 && uu < 0.35) return [Object.assign({}, TRG, { cx: TRG.cx - Math.max(0, Math.min(1, (uu - 0.05) / 0.25)) * 70 })];
      }
      const back = 0.6 + 0.5 * (n - 1) + 0.35 + 0.1;   // finger returns to the frame
      if (u < back) return [];
      if (m.rep === 2 && u >= back + 0.4 && u < back + 0.6) return [];   // restart rep: off again for 0.2 s
      return [REST];
    },
    finished(t) { return this.mem.end != null && t >= this.mem.end + 0.4; },
    rot: t => ({ a: tiny(t), b: tiny(t + 2), g: 0 }),
  },
  // Box Drill (WQ-029): five positions, seeded; the beep is 1-4 s after arming and every later position starts at the previous
  // cue, which falls in the tick the finger is back on the frame after two or more shots. Adaptive like Low Ready (the
  // generator reads engine.state.drill after each frame; the written log is a plain recording). Position 1: two presses,
  // first trigger touch 0.6 s after the beep. Positions 2-5 begin at the cue: the walk is the finger held on the frame for
  // 1 s, then the presses. Position 2 has three presses (the third shot stays in the position, one cue). Position 3 is the
  // one-shot return: press, finger back on the frame for 1.3 s (no cue after a single shot), then the second press.
  // The run ends 0.4 s after the drill end event.
  'drill-box': {
    live: true, drillAt: 0, drillId: 'box', drillSeed: 20261027, dur: 0,
    mem: { rep: 0, t0: 0, end: null },
    touches(t, eng) {
      const d = eng.state.drill, m = this.mem;
      if (!d) return [REST];
      if (d.rep !== m.rep) { m.rep = d.rep; m.t0 = t; }   // the beep (rep 1) or a cue (rep 2-5) opens a position
      if (d.phase === 'ended' && m.end == null) m.end = t;
      if (m.rep === 0 || d.phase === 'ended') return [REST];
      const u = t - m.t0, s = m.rep === 1 ? 0.6 : 1.0;
      const starts = m.rep === 2 ? [s, s + 0.5, s + 1.0] : m.rep === 3 ? [s, s + 1.75] : [s, s + 0.5];
      if (u < s) return [REST];                            // the walk: finger held on the frame
      for (let k = 0; k < starts.length; k++) {
        const uu = u - starts[k];
        if (uu >= 0 && uu < 0.35) return [Object.assign({}, TRG, { cx: TRG.cx - Math.max(0, Math.min(1, (uu - 0.05) / 0.25)) * 70 })];
      }
      if (m.rep === 3 && u >= s + 0.45 && u < starts[1]) return [REST];   // back on the frame after ONE shot, held 1.3 s
      return u < starts[starts.length - 1] + 0.35 + 0.1 ? [] : [REST];
    },
    finished(t) { return this.mem.end != null && t >= this.mem.end + 0.4; },
    rot: t => ({ a: tiny(t), b: tiny(t + 2), g: 0 }),
  },
  // Transitions (WQ-030): ten shots in five pairs, seeded, adaptive (the generator reads engine.state.drill; the written log is a
  // plain recording). From the beep (the tick the run goes live) pair p (0-4) starts at 0.6 + 2.4 p s: press, press 0.5 s later
  // (each a 0.35 s pull and reset), then the trigger touch STAYS at its base (pull 0) while the phone swings fast about the
  // barrel-perpendicular axis for 0.5 s (80 deg/s, 40 deg; direction alternates so the muzzle does not wander), then 0.85 s
  // of stillness before the next pair. After shot 10 the trigger is lifted and the finger is back on the frame 0.1 s later.
  // The run ends 0.4 s after the drill end event. The phone is still during every press, so every shot grades Clean.
  'drill-transitions': {
    live: true, drillAt: 0, drillId: 'transitions', drillSeed: 20261031, dur: 0,
    mem: { t0: null, end: null },
    sched: p => 0.6 + 2.4 * p,                              // pair p opens at this many seconds after the beep
    touches(t, eng) {
      const d = eng.state.drill, m = this.mem;
      if (!d) return [REST];
      if (d.phase === 'live' && m.t0 == null) m.t0 = t;
      if (d.phase === 'ended' && m.end == null) m.end = t;
      if (m.t0 == null || d.phase === 'ended') return [REST];
      const u = t - m.t0, pull = uu => Object.assign({}, TRG, { cx: TRG.cx - Math.max(0, Math.min(1, (uu - 0.05) / 0.25)) * 70 });
      if (u < this.sched(0)) return [REST];                  // finger on the frame until the first press
      const p = Math.min(4, Math.floor((u - this.sched(0)) / 2.4)), a = this.sched(p), uu = u - a;
      if (p === 4 && uu >= 0.5 + 0.35 + 0.1) return [REST];  // after shot 10: lifted, finger back on the frame 0.1 s later
      if (p === 4 && uu >= 0.5 + 0.35) return [];
      if (uu >= 0 && uu < 0.35) return [pull(uu)];
      if (uu >= 0.5 && uu < 0.85) return [pull(uu - 0.5)];
      return [TRG];                                          // the touch stays on the trigger, pull 0
    },
    finished(t) { return this.mem.end != null && t >= this.mem.end + 0.4; },
    rot(t) {
      const t0 = this.mem.t0;
      if (t0 != null) {
        const u = t - t0;
        for (let p = 0; p < 4; p++) {                        // the swing after pair p: 0.2 s after its second press has reset
          const s = this.sched(p) + 1.05;
          if (u >= s && u < s + 0.5) return { a: p % 2 ? -80 : 80, b: 0, g: 0 };
        }
      }
      return { a: tiny(t), b: tiny(t + 2), g: 0 };
    },
  },
  'axis-up': { dur: 3, touches: () => [REST], rot: t => between(t, 1, 1.5) ? { a: 40, b: 0, g: 0 } : { a: tiny(t), b: 0, g: 0 } },
  'axis-right': { dur: 3, touches: () => [REST], rot: t => between(t, 1, 1.5) ? { a: 0, b: -40, g: 0 } : { a: tiny(t), b: 0, g: 0 } },
};

const out = path.join(__dirname, 'recordings', 'synthetic');
fs.mkdirSync(out, { recursive: true });
for (const [label, sc] of Object.entries(S)) {
  const log = [['p', T0, 0]];
  if (sc.drillAt != null) log.push(['r', TDT.rt(T0 + sc.drillAt * 1000), sc.drillId || 'bill', sc.drillSeed]);
  // Adaptive scenarios (sc.live) feed every row they write to a live engine configured like the replay's.
  const eng = sc.live ? TDT.createEngine(Object.assign({}, TDT.DEFAULTS, { axisMode: 'spec' }), {}) : null;
  let fed = 0;
  const feed = () => { for (; fed < log.length; fed++) {
    const row = log[fed];
    switch (row[0]) {
      case 'm': eng.motion(TDT.unpackMotion(row)); break;
      case 't': eng.touches(row[1], TDT.unpackTouchList(row[4]), row[2], row[3]); break;
      case 'p': eng.setPaused(!!row[2], row[1]); break;
      case 'd': eng.setDownrange(row[1]); break;
      case 'r': eng.startDrill(row[1], row[2], row[3]); break;
      case 'f': eng.tick(row[1]); break;
    }
  } };
  let lastTouchKey = '';
  for (let i = 0; sc.live ? (!sc.finished((i * FRAME) / 1000) && i < 6000) : i * FRAME <= sc.dur * 1000; i++) {
    const t = TDT.rt(T0 + i * FRAME), ts = (t - T0) / 1000;
    if (sc.live) feed();
    sc.lastTs = ts;
    const rot = sc.rot(ts);
    log.push(['m', t, r(rot.a), r(rot.b), r(rot.g), 0, 0, 0, null, null, null, 90]);
    const list = (sc.live ? sc.touches(ts, eng) : sc.touches(ts)).map(p => ({ id: p.id, cx: TDT.r2(p.cx), cy: TDT.r2(p.cy), rx: 0, ry: 0 }));
    const key = JSON.stringify(list);
    if (key !== lastTouchKey) { log.push(TDT.packTouches(t, list, W, H)); lastTouchKey = key; }
    if (sc.downrangeAt != null && Math.abs(ts - sc.downrangeAt) < FRAME / 2000) log.push(['d', TDT.rt(t + 0.5)]);
    log.push(['f', TDT.rt(t + 1)]);
  }
  if (sc.live) { feed(); sc.dur = sc.lastTs; }
  const rec = {
    format: 'tdt-recording', version: 1, app: TDT.VERSION, synthetic: true,
    label, notes: 'Generated by tests/make-synthetic.js', recordedAt: '2026-10-14T00:00:00.000Z',
    device: { ua: 'synthetic (spec axis order)', ios: false, dpr: 2, w: W, h: H },
    settings: Object.assign({}, TDT.DEFAULTS, { axisMode: 'spec' }), t0: T0, t1: TDT.rt(T0 + sc.dur * 1000), log, observed: [],
  };
  fs.writeFileSync(path.join(out, `${label}.json`), JSON.stringify(rec));
  console.log(`wrote synthetic/${label}.json (${log.length} rows)`);
}
