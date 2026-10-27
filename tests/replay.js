// Replays every recording in tests/recordings/ through engine.js (no browser) and checks:
//  1. label expectations (tests/expectations.js)
//  2. live == replay: for recordings made with the current engine version, the replay must
//     reproduce the events the phone produced live, exactly
//  3. for axis-* recordings: which gyro axis mapping / flips would read the motion correctly;
//     for a real phone (one recordings folder + user agent; Chrome's reduced UA is the same on
//     every Android phone) with both axis recordings, FAIL when the default axisMode 'auto' resolves
//     to a mapping outside that phone's verdict (synthetic recordings pin 'spec' and are skipped)
//  4. WARN when a recording's device.ios disagrees with its device.ua (pre-D-53 recordings)
// Usage: node tests/replay.js [file-or-dir ...]
const fs = require('fs');
const path = require('path');
const TDT = require('../engine.js');
const EXPECT = require('./expectations.js');

const roots = process.argv.slice(2).length ? process.argv.slice(2) : [path.join(__dirname, 'recordings')];
const files = [];
const walk = p => {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) fs.readdirSync(p).sort().forEach(f => walk(path.join(p, f)));
  else if (p.endsWith('.json') || p.endsWith('.txt')) files.push(p);   // .txt: Android share-sheet copies
};
roots.forEach(walk);

function summarize(res) {
  const ev = res.events;
  const p0 = res.path.length ? res.path[0] : [0, 0, 0];
  let peak = { h: 0, v: 0 }, best = -1;
  for (const [, h, v] of res.path) {
    const dh = h - p0[1], dv = v - p0[2], m = Math.hypot(dh, dv);
    if (m > best) { best = m; peak = { h: dh, v: dv }; }
  }
  return {
    armed: ev.filter(e => e.type === 'armed').length,
    alarms: ev.filter(e => e.type === 'alarmStart').length,                      // any reason
    alarmsMove: ev.filter(e => e.type === 'alarmStart' && e.reason === 'move').length,
    alarmTs: ev.filter(e => e.type === 'alarmStart').map(e => e.t),
    b180: ev.filter(e => e.type === 'alarmStart' && e.reason === '180').length,
    drillBeeps: ev.filter(e => e.type === 'drillBeep').length,
    drillCues: ev.filter(e => e.type === 'drillCue').length,
    beepEvs: ev.filter(e => e.type === 'drillBeep').map(e => ({ t: e.t, rep: e.rep })),
    cueEvs: ev.filter(e => e.type === 'drillCue').map(e => ({ t: e.t, rep: e.rep, cue: e.cue })),
    endTs: ev.filter(e => e.type === 'drillEnd').map(e => e.t),
    drillEnds: ev.filter(e => e.type === 'drillEnd').length,
    drillCancels: ev.filter(e => e.type === 'drillCancel').length,
    okTs: ev.filter(e => e.type === 'ok').map(e => e.t),
    runs: res.state.drillRuns,
    firstArmedT: (ev.find(e => e.type === 'armed') || {}).t,
    beepT: (ev.find(e => e.type === 'drillBeep') || {}).t,
    shotTimes: ev.filter(e => e.type === 'shot').map(e => e.t),
    trigOnTs: ev.filter(e => e.type === 'trigOn').map(e => e.t),
    finalAlarm: res.state.alarmActive,
    maxDev: Math.max(0, ...res.path.map(p => p[3] || 0)),
    shots: ev.filter(e => e.type === 'shot').map(e => e.shot),
    peak,
  };
}

const IOS_UA = /iP(hone|ad|od)/;
const mappingName = (axisMode, flipH, flipV) => `${axisMode}${flipH ? '+flipH' : ''}${flipV ? '+flipV' : ''}`;

// Which concrete mapping the default settings (axisMode 'auto', default flips) resolve to for this
// recording: the explicit mapping whose replay is identical (events and aim path) to the 'auto' replay.
function autoResolution(rec) {
  const base = { flipH: TDT.DEFAULTS.flipH, flipV: TDT.DEFAULTS.flipV };
  const key = r => JSON.stringify([r.packed, r.path]);
  const auto = key(TDT.replay(rec, Object.assign({ axisMode: 'auto' }, base)));
  const hits = ['spec', 'ios'].filter(m => key(TDT.replay(rec, Object.assign({ axisMode: m }, base))) === auto);
  return hits.length === 1 ? mappingName(hits[0], base.flipH, base.flipV) : null;
}

function axisDiagnosis(rec) {
  const ok = [];
  for (const axisMode of ['spec', 'ios']) for (const flipH of [false, true]) for (const flipV of [false, true]) {
    const r = summarize(TDT.replay(rec, { axisMode, flipH, flipV }));
    if (EXPECT[rec.label](r).every(([, pass]) => pass)) ok.push(mappingName(axisMode, flipH, flipV));
  }
  return ok;
}

let failures = 0;
const byDevice = {};
if (!files.length) console.log('No recordings found.');
for (const f of files) {
  const rel = path.relative(process.cwd(), f);
  let rec;
  try { rec = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log(`FAIL  ${rel}: unreadable JSON`); failures++; continue; }
  if (rec.format !== 'tdt-recording') { console.log(`SKIP  ${rel}: not a tdt recording`); continue; }

  const res = TDT.replay(rec);
  const sum = summarize(res); sum.synthetic = !!rec.synthetic;
  sum.rRow = (rec.log || []).find(x => x[0] === 'r') || null;   // the drill request row (WQ-051: seed and wall of a shared run)
  const dur = rec.t1 && rec.t0 ? ((rec.t1 - rec.t0) / 1000).toFixed(1) + ' s' : '';
  console.log(`\n${rel}  [${rec.label}${rec.synthetic ? ', synthetic' : ''}] ${dur}` +
    `  shots ${sum.shots.length} (${sum.shots.map(s => s.grade[0]).join('') || '-'})  alarms ${sum.alarmsMove}  180s ${sum.b180} (max ${sum.maxDev.toFixed(0)}°)` +
    (sum.drillBeeps || sum.drillEnds || sum.drillCancels ? `  drill: beeps ${sum.drillBeeps} cues ${sum.drillCues} ends ${sum.drillEnds} cancels ${sum.drillCancels}` : ''));

  const check = EXPECT[rec.label];
  if (!check) { console.log(`  WARN  unknown label "${rec.label}" — no expectations`); }
  else for (const [desc, pass] of check(sum)) {
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${desc}`);
    if (!pass) failures++;
  }

  if (!rec.synthetic && Array.isArray(rec.observed)) {
    const live = JSON.stringify(rec.observed), again = JSON.stringify(res.packed);
    const same = live === again;
    if (rec.app === TDT.VERSION) {
      console.log(`  ${same ? 'PASS' : 'FAIL'}  replay reproduces the live run (${rec.observed.length} events)`);
      if (!same) failures++;
    } else {
      console.log(`  INFO  recorded with engine ${rec.app}, now ${TDT.VERSION}: replay ${same ? 'still matches' : 'differs from'} the live run`);
    }
  }

  if (rec.device && typeof rec.device.ua === 'string' && typeof rec.device.ios === 'boolean' &&
      rec.device.ios !== IOS_UA.test(rec.device.ua)) {
    console.log(`  WARN  device.ios is ${rec.device.ios} but the user agent ${rec.device.ios ? 'names no' : 'names an'} iPhone/iPad/iPod`);
  }

  // Advisory run-time axis estimate (D-57): reported only, no pass/fail.
  if (rec.t1 && rec.t0 && rec.t1 - rec.t0 > 5000) {
    const e = res.state.axisEst;
    console.log(`  INFO  axisEst ${e ? `${e.cand} margin ${e.margin > 999 ? '>999' : e.margin.toFixed(2)} after ${e.motionS.toFixed(1)} s motion, ${e.windows} windows` : 'null'}`);
  }

  if (rec.label === 'axis-up' || rec.label === 'axis-right') {
    const ok = axisDiagnosis(rec);
    console.log(`  INFO  mappings that read this correctly: ${ok.join(', ') || 'none'}`);
    const dev = `${path.basename(path.dirname(f))}: ${(rec.device && rec.device.ua) || 'unknown'}`;
    (byDevice[dev] = byDevice[dev] || []).push({ label: rec.label, ok, rec, rel });
  }
}

// WQ-027: the synthetic Bill Drill replays deterministically; the seed in the 'r' row decides the beep time;
// first / splits / total are the shot times minus the beep time.
const billFile = files.find(f => f.endsWith(path.join('synthetic', 'drill-bill.json')));
if (billFile) {
  console.log('\nBill Drill determinism (synthetic/drill-bill.json, in memory)');
  const t = (desc, pass) => { console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${desc}`); if (!pass) failures++; };
  const rec = JSON.parse(fs.readFileSync(billFile, 'utf8'));
  const a = TDT.replay(rec), b = TDT.replay(rec);
  t('replaying twice gives identical packed events', JSON.stringify(a.packed) === JSON.stringify(b.packed) && a.packed.length > 0);
  const rIdx = rec.log.findIndex(r => r[0] === 'r');
  t('the log carries one r row, right after the opening p row', rec.log.filter(r => r[0] === 'r').length === 1 && rIdx === 1 && rec.log[rIdx][2] === 'bill');
  const beepOf = res => (res.events.find(e => e.type === 'drillBeep') || {}).t;
  // The seeded due time can fall inside the finger-off window (the beep is then deferred to the same time), so
  // try seeds until one gives a beep; require one that differs from the original and several distinct beep times.
  const tries = [rec.log[rIdx][3] + 12345, 1, 2, 3, 4, 5, 99, 1234].map(sd => { const o = JSON.parse(JSON.stringify(rec)); o.log[rIdx][3] = sd >>> 0; return beepOf(TDT.replay(o)); });
  t(`a different seed gives a different beep time (original ${beepOf(a)}; others ${tries.map(Math.round).join(', ')})`,
    beepOf(a) !== undefined && tries.every(x => x !== undefined) && tries.some(x => x !== beepOf(a)) && new Set(tries).size >= 3);
  const run = a.state.drillRuns[0], shots = a.events.filter(e => e.type === 'shot').map(e => e.t), beep = beepOf(a);
  t('one finished run in state.drillRuns', a.state.drillRuns.length === 1 && !!run);
  const near = (x, y) => Math.abs(x - y) < 0.01;   // result values are rounded to 4 decimals (r4)
  t(`result.first equals shot 1 minus the beep (${run && run.first})`, !!run && near(run.first, shots[0] - beep));
  t('result.splits equal the five shot gaps', !!run && run.splits.length === 5 && run.splits.every((x, i) => near(x, shots[i + 1] - shots[i])));
  t(`result.total equals shot 6 minus the beep (${run && run.total}) and first + splits`, !!run && near(run.total, shots[5] - beep) && near(run.total, run.first + run.splits.reduce((x, y) => x + y, 0)));
  const endEv = a.events.find(e => e.type === 'drillEnd');
  t('drillEnd carries the same total', !!endEv && near(endEv.result.total, run.total));
  // WQ-027 stage 4: the seed is coerced with >>> 0 (0, 2^32 - 1, 1.5 and -1 behave as their unsigned 32-bit values).
  const beepWithSeed = sd => { const r2 = JSON.parse(JSON.stringify(rec)); r2.log[rIdx][3] = sd; return beepOf(TDT.replay(r2)); };
  for (const [raw, coerced] of [[0, 0], [4294967295, 4294967295], [1.5, 1], [-1, 4294967295], [4294967296, 0]]) {
    const x = beepWithSeed(raw), y = beepWithSeed(coerced);
    t(`seed ${raw} gives the same beep time as ${coerced} (${x})`, x !== undefined && x === y);
  }
  // Engine-level: startDrill while live cancels once; startDrill in ended cancels nothing; one without a started delay cancels nothing.
  {
    const evs = [], eng = TDT.createEngine(Object.assign({}, TDT.DEFAULTS), { onEvent: e => evs.push(e) });
    const cancels = () => evs.filter(e => e.type === 'drillCancel').length;
    eng.setPaused(false, 0);
    t('startDrill on an engine with no run returns true and emits no cancel', eng.startDrill(0, 'bill', 5) === true && cancels() === 0);
    eng.startDrill(1, 'bill', 6);
    t('startDrill over a standby run whose delay never started emits no drillCancel (D-102)', cancels() === 0);
    eng.touches(10, [{ id: 1, cx: (TDT.ZONES.rest.x + TDT.ZONES.rest.w / 2) * 844, cy: (TDT.ZONES.rest.y + TDT.ZONES.rest.h / 2) * 390, rx: 0, ry: 0 }], 844, 390);
    let T = 10; while (T < 6000 && eng.state.drill.phase === 'standby') { T += 17; eng.motion({ t: T, rot: [0, 0, 0], acc: [0, 0, 0] }); eng.tick(T); }
    t(`the beep came (phase ${eng.state.drill.phase})`, eng.state.drill.phase === 'live' && evs.filter(e => e.type === 'drillBeep').length === 1);
    eng.startDrill(T + 1, 'bill', 7);
    t('startDrill while live emits exactly one drillCancel', cancels() === 1 && evs.filter(e => e.type === 'drillCancel')[0].drill === 'bill');
    eng.state.drill.phase = 'ended';   // a finished run (state poked directly: the result path is covered by the recordings)
    eng.startDrill(T + 2, 'bill', 8);
    t('startDrill over an ended run emits no further drillCancel', cancels() === 1);
  }
  const seeds = [1, 2, 3, 4, 5, 99, 123456, 4294967295].map(sd => { const r2 = JSON.parse(JSON.stringify(rec)); r2.log[rIdx][3] = sd; return beepOf(TDT.replay(r2)) - a.events.find(e => e.type === 'armed').t; });
  t(`beep falls 1000-4000 ms (+1 frame) after arming for 8 seeds (${seeds.map(x => Math.round(x)).join(', ')})`, seeds.every(x => x >= 1000 && x <= 4000 + 17));
}

// WQ-028: the synthetic Low Ready run replays deterministically; the seed in the 'r' row decides every beep time.
const lrFile = files.find(f => f.endsWith(path.join('synthetic', 'drill-low-ready.json')));
if (lrFile) {
  console.log('\nLow Ready determinism (synthetic/drill-low-ready.json, in memory)');
  const t = (desc, pass) => { console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${desc}`); if (!pass) failures++; };
  const rec = JSON.parse(fs.readFileSync(lrFile, 'utf8'));
  const withSeed = sd => { const o = JSON.parse(JSON.stringify(rec)); o.log[o.log.findIndex(r => r[0] === 'r')][3] = sd >>> 0; return o; };
  const beepsOf = res => res.events.filter(e => e.type === 'drillBeep').map(e => e.t);
  const a = TDT.replay(rec), b = TDT.replay(rec);
  t('replaying twice gives identical packed events', JSON.stringify(a.packed) === JSON.stringify(b.packed) && a.packed.length > 0);
  const rIdx = rec.log.findIndex(r => r[0] === 'r');
  t('the log carries one r row, right after the opening p row, naming lowready', rec.log.filter(r => r[0] === 'r').length === 1 && rIdx === 1 && rec.log[rIdx][2] === 'lowready');
  t('observed is empty (synthetic recordings carry no live events)', rec.synthetic === true && Array.isArray(rec.observed) && rec.observed.length === 0);
  const base = beepsOf(a);
  // The touches are fixed, so another seed's beeps no longer line up with the presses; only the beep times are compared.
  const seeds = [rec.log[rIdx][3] + 12345, 1, 2, 3, 4, 5, 99, 123456, 4294967295];
  const others = seeds.map(sd => beepsOf(TDT.replay(withSeed(sd))));
  t(`a different seed moves at least one beep (original ${base.map(Math.round).join('/')})`,
    base.length === 5 && others.every(o => o.length >= 1) && others.some(o => o.some((x, i) => x !== base[i])) && new Set(others.map(o => o[0])).size >= 4);
  t('seed coercion: -1 behaves as 4294967295 (same beeps)', JSON.stringify(beepsOf(TDT.replay(withSeed(-1)))) === JSON.stringify(beepsOf(TDT.replay(withSeed(4294967295)))));
  // With the finger staying on the frame (no deferral) rep 1's beep falls 2000-5000 ms after arming, for any seed.
  // (The recording's own touches lift the finger for the presses, so other seeds can defer a beep: engine-level here.)
  {
    const rest = [{ id: 1, cx: (TDT.ZONES.rest.x + TDT.ZONES.rest.w / 2) * 844, cy: (TDT.ZONES.rest.y + TDT.ZONES.rest.h / 2) * 390, rx: 0, ry: 0 }];
    const gaps = seeds.map(sd => {
      const evs = [], eng = TDT.createEngine(Object.assign({}, TDT.DEFAULTS), { onEvent: e => evs.push(e) });
      eng.setPaused(false, 0); eng.startDrill(0, 'lowready', sd); eng.touches(10, rest, 844, 390);
      for (let T = 10; T < 8000 && !evs.some(e => e.type === 'drillBeep'); T += 1000 / 60) { eng.motion({ t: T, rot: [0, 0, 0], acc: [0, 0, 0] }); eng.tick(T); }
      const bp = evs.find(e => e.type === 'drillBeep'), ar = evs.find(e => e.type === 'armed');
      return bp && ar ? bp.t - ar.t : NaN;
    });
    t(`finger on the frame throughout: rep 1 beep 2000-5000 ms (+1 frame) after arming for ${seeds.length} seeds (${gaps.map(x => Math.round(x)).join(', ')})`,
      gaps.every(x => x >= 2000 && x <= 5000 + 17));
  }
  // Rep 1 gated by the hold: lift the finger from 200 ms before the seeded beep to 100 ms after it; the beep then waits until the finger has
  // been back DRILL_BEEP_HOLD_MS (350 ms), and the OK tone of the return comes at least 350 ms before it.
  {
    const o = JSON.parse(JSON.stringify(rec)), B = base[0];
    const tpl = o.log.find(r => r[0] === 't'), W = tpl[2], H = tpl[3];
    const restList = TDT.unpackTouchList(tpl[4]);
    const at = (tt) => o.log.findIndex(r => (r[0] === 'm' || r[0] === 'f') && r[1] >= tt);
    const backT = TDT.rt(B + 100), offT = TDT.rt(B - 200);
    o.log.splice(at(backT), 0, TDT.packTouches(backT, restList, W, H));
    o.log.splice(at(offT), 0, TDT.packTouches(offT, [], W, H));
    const g = TDT.replay(o), gb = beepsOf(g)[0];
    const okBack = g.events.filter(e => e.type === 'ok' && e.t > B - 200).map(e => e.t)[0];
    t(`rep 1 beep gated by the hold: finger back at ${Math.round(backT)}, ok at ${Math.round(okBack)}, beep at ${Math.round(gb)} (seeded due ${Math.round(B)})`,
      gb !== undefined && okBack !== undefined && gb >= backT + 350 && gb - okBack >= 350 && gb <= backT + 350 + 40);
  }
  // Engine-level: a cancel loses the reps (D-105); resetStats clears the runs.
  {
    const evs = [], eng = TDT.createEngine(Object.assign({}, TDT.DEFAULTS), { onEvent: e => evs.push(e) });
    eng.setPaused(false, 0);
    eng.startDrill(0, 'lowready', 5);
    const rest = [{ id: 1, cx: (TDT.ZONES.rest.x + TDT.ZONES.rest.w / 2) * 844, cy: (TDT.ZONES.rest.y + TDT.ZONES.rest.h / 2) * 390, rx: 0, ry: 0 }];
    eng.touches(10, rest, 844, 390);
    let T = 10; while (T < 7000 && eng.state.drill.phase === 'standby') { T += 17; eng.motion({ t: T, rot: [0, 0, 0], acc: [0, 0, 0] }); eng.tick(T); }
    t('Low Ready beep came and the run is live at rep 1', eng.state.drill.phase === 'live' && eng.state.drill.rep === 1);
    eng.setPaused(true, T + 1);
    t('pausing a live Low Ready run emits one drillCancel and restarts at rep 0 in standby with no reps (D-105)',
      evs.filter(e => e.type === 'drillCancel').length === 1 && eng.state.drill.phase === 'standby' && eng.state.drill.rep === 0 && eng.state.drill.reps.length === 0 && eng.state.drill.cur === null);
  }
  // An alarm that spans two beeps counts once (D-105): a 180 alarm (muzzle swung 97 deg off downrange before the finger
  // touches the frame) sounds through rep 1's beep, rep 1's shots, the cue and rep 2's beep; the run counts one alarm,
  // and both reps are marked with it.
  {
    const W = 844, H = 390, mid = z => [(z.x + z.w / 2) * W, (z.y + z.h / 2) * H];
    const REST = [{ id: 1, cx: mid(TDT.ZONES.rest)[0], cy: mid(TDT.ZONES.rest)[1], rx: 0, ry: 0 }], TR = mid(TDT.zoneFor('trigger', W));
    const evs = [], eng = TDT.createEngine(Object.assign({}, TDT.DEFAULTS), { onEvent: e => evs.push(e) });
    let T = 0; const step = (a = 0) => { T += 1000 / 60; eng.motion({ t: T, a, b: 0, g: 0, angle: 90 }); eng.tick(T); };
    const run = ms => { const e = T + ms; while (T < e) step(); };
    const press = () => {
      eng.touches(T, [{ id: 2, cx: TR[0], cy: TR[1], rx: 0, ry: 0 }], W, H); run(60);
      for (const dx of [20, 45, 70]) { eng.touches(T, [{ id: 2, cx: TR[0] - dx, cy: TR[1], rx: 0, ry: 0 }], W, H); run(40); }
      run(30); eng.touches(T, [], W, H); run(50);
    };
    const until = (cond, maxMs) => { const e = T + maxMs; while (!cond() && T < e) run(17); return cond(); };
    const d = () => eng.state.drill;
    eng.setPaused(false, 0); eng.startDrill(0, 'lowready', 3);
    run(100); eng.setDownrange(T); run(100);
    for (let n = 0; eng.state.dev180 < 95 && n < 400; n++) step(-120);   // finger off the frame: unarmed, no alarm yet
    t(`180 setup: muzzle ${eng.state.dev180.toFixed(0)} deg off downrange, no alarm yet`, eng.state.dev180 > 95 && !eng.state.alarmActive);
    eng.touches(T, REST, W, H);
    t('rep 1 beep with the 180 alarm sounding: run alarms 1, rep 1 marked', until(() => d().rep === 1, 7000) && eng.state.alarmActive && d().alarms === 1 && d().cur.alarms === 1);
    press(); press(); eng.touches(T, REST, W, H);
    t('cue 1 with the alarm still sounding: run alarms still 1', until(() => d().reps.length === 1, 3000) && eng.state.alarmActive && d().alarms === 1 && d().reps[0].alarms === 1);
    t('rep 2 beep with the same alarm still sounding: run alarms still 1 (once per episode), rep 2 marked', until(() => d().rep === 2, 7000) && eng.state.alarmActive && d().alarms === 1 && d().cur.alarms === 1);
    press(); press(); eng.touches(T, REST, W, H);
    t('cue 2: both reps marked with one alarm each; the run counts one alarm episode; only one alarmStart event',
      until(() => d().reps.length === 2, 3000) && d().alarms === 1 && d().reps.every(r => r.alarms === 1 && r.withAlarm) && evs.filter(e => e.type === 'alarmStart').length === 1,
      d().reps.map(r => r.alarms));
    t('shots fired in the alarm are not graded (unsafe)', d().reps.every(r => r.shots.every(x => x.unsafe)));
  }
}

// WQ-051: shared Low Ready (class code). The beep schedule is a pure function of the wall clock and the seed; the engine only
// learns the wall clock through startDrill's fourth argument and syncWall. Engine-level checks (no browser, no Date.now()).
const lrcFile = files.find(f => f.endsWith(path.join('synthetic', 'drill-low-ready-class.json')));
if (lrcFile) {
  console.log('\nShared Low Ready determinism (synthetic/drill-low-ready-class.json, in memory)');
  const t = (desc, pass) => { console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${desc}`); if (!pass) failures++; };
  const rec = JSON.parse(fs.readFileSync(lrcFile, 'utf8'));
  const W = 1_700_000_000_000, SEED = 20261028, CYC = TDT.DEFAULTS.classCycleMs, STEP = 16;
  const mid = z => [(z.x + z.w / 2) * 844, (z.y + z.h / 2) * 390];
  const REST = [{ id: 1, cx: mid(TDT.ZONES.rest)[0], cy: mid(TDT.ZONES.rest)[1], rx: 0, ry: 0 }], TR = mid(TDT.zoneFor('trigger', 844));
  // A scripted shooter on a 16 ms grid of local time u (engine time t = base + u, wall = W0 + u): finger on the frame;
  // after each beep two presses, then the frame again. `off(u)` (optional) lifts the finger entirely while true.
  function play(base, seed, o = {}) {
    const W0 = o.W0 === undefined ? W : o.W0, shared = o.shared !== false;
    const evs = [], eng = TDT.createEngine(Object.assign({}, TDT.DEFAULTS, o.S || {}), { onEvent: e => evs.push(e) });
    let u = 0; const now = () => base + u;
    const step = () => { u += STEP; eng.motion({ t: now(), a: 0, b: 0, g: 0, angle: 90 }); eng.tick(now()); };
    const run = ms => { const e = u + ms; while (u < e) step(); };
    const frame = () => eng.touches(now(), o.off && o.off(u) ? [] : REST, 844, 390);
    const press = () => {
      eng.touches(now(), [{ id: 2, cx: TR[0], cy: TR[1], rx: 0, ry: 0 }], 844, 390); run(60);
      for (const dx of [20, 45, 70]) { eng.touches(now(), [{ id: 2, cx: TR[0] - dx, cy: TR[1], rx: 0, ry: 0 }], 844, 390); run(40); }
      run(30); eng.touches(now(), [], 844, 390); run(50);
    };
    eng.setPaused(false, now());
    if (shared) eng.startDrill(now(), 'lowready', seed, W0 + u); else eng.startDrill(now(), 'lowready', seed);
    const d = () => eng.state.drill;
    const until = (cond, maxMs) => { const e = u + maxMs; while (!cond() && u < e) { frame(); step(); } return cond(); };
    frame(); run(50);
    const wallOff = shared ? W0 - base : null;
    if (o.manual) return { eng, evs, step, run, frame, now, d, until, wallOff, uNow: () => u };
    for (let k = 1; k <= 5; k++) {
      if (!until(() => d().rep === k, 40000)) break;
      press(); press(); eng.touches(now(), REST, 844, 390);
      if (!until(() => k < 5 ? d().reps.length === k : d().phase === 'ended', 6000)) break;
    }
    return { eng, evs, wallOff, d: d() };
  }
  const beepWalls = r => r.evs.filter(e => e.type === 'drillBeep').map(e => e.t + r.wallOff);
  const A = play(0, SEED), B = play(4321, SEED);
  t(`engines A (t from 0) and B (t from 4321) at the same wall clock: five beeps each (${beepWalls(A).length}, ${beepWalls(B).length})`,
    beepWalls(A).length === 5 && beepWalls(B).length === 5);
  t('the five beeps fall at identical wall times (to the ms) in both engines', JSON.stringify(beepWalls(A)) === JSON.stringify(beepWalls(B)));
  t('both runs end with shared results with the same slots', !!A.d.result && !!B.d.result && A.d.result.shared === true &&
    JSON.stringify(A.d.result.reps.map(p => p.slot)) === JSON.stringify(B.d.result.reps.map(p => p.slot)));
  t('every beep wall time equals slotAt of its rep slot', A.d.result.reps.every((p, i) => beepWalls(A)[i] >= TDT.slotAt(SEED, CYC, p.slot) && beepWalls(A)[i] - TDT.slotAt(SEED, CYC, p.slot) < STEP));
  t('the run generator is not consumed for delays (its first draw is still the seed\'s first draw)', A.d.rng() === TDT.mulberry32(SEED)());
  // Different seeds: different jitter.
  {
    const slotsFor = sd => [3, 4, 5, 6, 7, 8].map(k => TDT.slotAt(sd, CYC, k) - k * CYC);
    const s1 = slotsFor(SEED), s2 = slotsFor(SEED + 1);
    t('slotAt with seeds differing by one gives different jitter (at least 5 of 6 slots)', s1.filter((x, i) => x !== s2[i]).length >= 5 && s1.every(x => x >= 0 && x < 3000));
    const C = play(0, SEED + 12345);
    t('a run with another seed beeps at different wall times (at least one differs)', beepWalls(C).length === 5 && beepWalls(C).some((w, i) => w !== beepWalls(A)[i]));
    t('slotAt is deterministic and depends only on (seed, cycle, k)', TDT.slotAt(SEED, CYC, 7) === TDT.slotAt(SEED, CYC, 7) && TDT.slotAt(SEED, CYC, 7) !== TDT.slotAt(SEED, CYC + 1000, 7));
  }
  // Finger lifted across a slot: that slot passes silently, the next one beeps. Twin run: finger stays => beep at the slot.
  {
    const twin = play(0, SEED, { manual: true });
    twin.until(() => twin.d().rep === 1, 40000);
    const k0 = twin.d().slot, beepWall = twin.evs.find(e => e.type === 'drillBeep').t + twin.wallOff;
    const uBeep = twin.evs.find(e => e.type === 'drillBeep').t;
    t(`twin (finger stays on the frame) beeps at slot ${k0} (wall ${Math.round(beepWall)})`, beepWall >= TDT.slotAt(SEED, CYC, k0) && beepWall - TDT.slotAt(SEED, CYC, k0) < STEP);
    const lift = play(0, SEED, { manual: true, off: u => u >= uBeep - 200 && u < uBeep + 100 });
    lift.until(() => lift.uNow() > uBeep + 60, 40000);
    const nb = () => lift.evs.filter(e => e.type === 'drillBeep').length;
    t(`finger lifted across slot ${k0}: no beep at it, still standby, slot advanced to ${lift.d().slot}`,
      nb() === 0 && lift.d().phase === 'standby' && lift.d().slot > k0 && lift.d().slot === TDT.nextSlotAfter(SEED, CYC, uBeep + lift.wallOff, true));
    t('no drillCancel, no alarm from the skipped slot', lift.evs.every(e => e.type !== 'drillCancel' && e.type !== 'alarmStart'));
    const kNext = lift.d().slot;
    lift.until(() => nb() > 0, 40000);
    const w2 = lift.evs.find(e => e.type === 'drillBeep').t + lift.wallOff;
    t(`the next slot (${kNext}) beeps: ${Math.round(w2 - beepWall)} ms after the skipped one`, nb() === 1 && w2 > beepWall && w2 >= TDT.slotAt(SEED, CYC, kNext) && w2 - TDT.slotAt(SEED, CYC, kNext) < STEP && lift.d().rep === 1);
    t('the lifted run recorded the slot it beeped on as rep 1\'s slot', lift.d().cur && lift.d().cur.slot === kNext);
  }
  // Second skip branch: the finger is back on the frame, but for less than DRILL_BEEP_HOLD_MS (350 ms) when the slot is due.
  {
    const twin = play(0, SEED, { manual: true });
    twin.until(() => twin.d().rep === 1, 40000);
    const k0 = twin.d().slot, uBeep = twin.evs.find(e => e.type === 'drillBeep').t;
    const lift = play(0, SEED, { manual: true, off: u => u >= uBeep - 700 && u < uBeep - 200 });
    lift.until(() => lift.uNow() > uBeep + 60, 40000);
    const nb = () => lift.evs.filter(e => e.type === 'drillBeep').length;
    t(`finger back 200 ms before slot ${k0} (hold not met): no beep at it, slot advanced to ${lift.d().slot}`,
      nb() === 0 && lift.d().phase === 'standby' && lift.d().slot > k0 && lift.d().slot === TDT.nextSlotAfter(SEED, CYC, uBeep + lift.wallOff, true));
    const kNext = lift.d().slot;
    lift.until(() => nb() > 0, 40000);
    const w2 = nb() ? lift.evs.find(e => e.type === 'drillBeep').t + lift.wallOff : NaN;
    t(`... and the later slot (${kNext}) beeps`, nb() === 1 && w2 >= TDT.slotAt(SEED, CYC, kNext) && w2 - TDT.slotAt(SEED, CYC, kNext) < STEP);
  }
  // A skip in rep 2 (after a cue, back in standby): compare with the full twin run.
  {
    const full = play(0, SEED), fw = beepWalls(full), fb = full.evs.filter(e => e.type === 'drillBeep').map(e => e.t);
    const lift = play(0, SEED, { off: u => u >= fb[1] - 200 && u < fb[1] + 100 });
    const lw = beepWalls(lift), ls = lift.d.result ? lift.d.result.reps.map(p => p.slot) : [];
    t(`rep 2: finger lifted across its slot: that wall time has no beep, rep 2 beeps on a later slot (${ls[1]} vs ${full.d.result.reps[1].slot})`,
      lw.length === 5 && Math.abs(lw[0] - fw[0]) < 1e-9 && !lw.some(w => Math.abs(w - fw[1]) < STEP) && ls[1] > full.d.result.reps[1].slot &&
      ls[1] === TDT.nextSlotAfter(SEED, CYC, fb[1] + full.wallOff, true) && lift.d.result.shared === true);
  }
  // Class cycle setting: engine-level runs on a 6 s cycle and the 1 s setting (floored to 3 s = CLASS_JITTER_MS).
  for (const [setting, eff] of [[6000, 6000], [1000, 3000], [30000, 30000]]) {
    const R = play(0, SEED, { S: { classCycleMs: setting } });
    const bw = beepWalls(R), reps = R.d.result ? R.d.result.reps : [];
    t(`classCycleMs ${setting}: five beeps on slots of a ${eff} ms cycle (beep = slotAt(seed, ${eff}, slot) within a frame; jitter below 3000)`,
      bw.length === 5 && reps.length === 5 && reps.every((p, i) => bw[i] >= TDT.slotAt(SEED, eff, p.slot) && bw[i] - TDT.slotAt(SEED, eff, p.slot) < STEP && TDT.slotAt(SEED, eff, p.slot) - p.slot * eff < 3000));
    if (setting !== 30000) t(`classCycleMs ${setting}: the beeps differ from the default 10 s cycle's`, bw.some((w, i) => w !== beepWalls(A)[i]));
  }
  // Golden values: phones on different versions must not desync silently, so the formula is pinned (computed once).
  t('golden: slotAt(20261028, 10000, 170000001) === 1700000011113.033 (to 1 ms resolution)', Math.abs(TDT.slotAt(20261028, 10000, 170000001) - 1700000011113.033) < 0.001);
  t('golden: slotAt(1, 10000, 0) === 1881.221821764484 and slotAt(4294967295, 6000, 283333333) === 1699999998679.1484',
    Math.abs(TDT.slotAt(1, 10000, 0) - 1881.221821764484) < 1e-9 && Math.abs(TDT.slotAt(4294967295, 6000, 283333333) - 1699999998679.1484) < 0.001);
  // An ordinary run has no shared / slot keys anywhere (byte identity of the result object).
  {
    const O = play(0, SEED, { shared: false });
    const res = O.d.result;
    t('ordinary startDrill (no wall): five reps done, result has no shared key, reps have no shared or slot key',
      !!res && res.reps.length === 5 && !('shared' in res) && res.reps.every(p => !('shared' in p) && !('slot' in p)));
    t('ordinary run: state.drill.shared is false and the generator drew the delays (rng advanced)', O.d.shared === false && O.d.rng() !== TDT.mulberry32(SEED)());
    const evs = [], eng = TDT.createEngine(Object.assign({}, TDT.DEFAULTS), { onEvent: e => evs.push(e) });
    eng.setPaused(false, 0);
    t('a wall passed to a drill that is not shareable (bill) is ignored: not shared', eng.startDrill(0, 'bill', 3, W) === true && eng.state.drill.shared === false);
    t('a non-finite wall on Low Ready gives an ordinary run', eng.startDrill(0, 'lowready', 3, NaN) === true && eng.state.drill.shared === false &&
      eng.startDrill(0, 'lowready', 3, undefined) === true && eng.state.drill.shared === false);
  }
  // syncWall re-anchors the pending due time.
  {
    const m = play(0, SEED, { manual: true });
    const d0 = m.d().dueAt, k0 = m.d().slot, off0 = m.eng.state.drill.wallOff;
    const delta = 7000;
    m.eng.syncWall(m.now(), W + m.uNow() + delta);   // the wall clock is 7 s ahead of what it was
    t(`syncWall with a wall ${delta} ms ahead moves dueAt by exactly -${delta} ms and keeps the slot (${d0} -> ${m.d().dueAt})`,
      m.d().slot === k0 && Math.abs((m.d().dueAt - d0) + delta) < 1e-6 && Math.abs(m.d().wallOff - off0 - delta) < 1e-6);
    m.eng.syncWall(m.now(), W + m.uNow());
    t('syncWall back to the original wall restores dueAt', Math.abs(m.d().dueAt - d0) < 1e-6);
    const dueBefore = m.d().dueAt, wo = m.d().wallOff;
    m.eng.syncWall(m.now(), NaN);
    t('syncWall with a non-finite wall changes nothing', m.d().dueAt === dueBefore && m.d().wallOff === wo);
    const o = play(0, SEED, { shared: false, manual: true }), od = o.d().dueAt;
    o.eng.syncWall(o.now(), W + 5000);
    t('syncWall on an ordinary run changes nothing', o.d().dueAt === od && !o.d().shared);
  }
  // nextSlotAfter boundaries and a brute-force cross-check.
  {
    const k = 6, w = TDT.slotAt(SEED, CYC, k);
    t('nextSlotAfter(w = slot k exactly, not strict) returns k', TDT.nextSlotAfter(SEED, CYC, w, false) === k);
    const brute = (w2, strict) => { for (let kk = 0; kk < 400; kk++) { const s = TDT.slotAt(SEED, CYC, kk); if (strict ? s > w2 : s >= w2) { /* earliest by time */ let best = kk, bw = s; for (let j = Math.max(0, kk - 1); j <= kk + 2; j++) { const sj = TDT.slotAt(SEED, CYC, j); if ((strict ? sj > w2 : sj >= w2) && sj < bw) { best = j; bw = sj; } } return best; } } return null; };
    const nxt = TDT.nextSlotAfter(SEED, CYC, w, true);
    t(`nextSlotAfter(w = slot ${k} exactly, strict) returns a later slot (${nxt}) whose time is > w`, nxt === brute(w, true) && TDT.slotAt(SEED, CYC, nxt) > w && nxt !== k);
    t('nextSlotAfter(w just below slot k) returns k; (w just above, not strict) does not', TDT.nextSlotAfter(SEED, CYC, w - 1e-6, false) === k && TDT.nextSlotAfter(SEED, CYC, w + 1e-6, false) !== k);
    let bad = 0;
    for (let i = 0; i < 300; i++) for (const strict of [false, true]) {
      const wq = 1000 + i * 977.3; const g = TDT.nextSlotAfter(SEED, CYC, wq, strict), s = TDT.slotAt(SEED, CYC, g);
      let okk = strict ? s > wq : s >= wq;
      for (let j = 0; j <= Math.ceil(wq / CYC) + 3; j++) { const sj = TDT.slotAt(SEED, CYC, j); if ((strict ? sj > wq : sj >= wq) && sj < s) okk = false; }
      if (!okk) bad++;
    }
    t('nextSlotAfter is the earliest qualifying slot for 600 query times (strict and not)', bad === 0);
    t('nextSlotAfter at w = 0 (not strict) is a slot at or after 0', TDT.slotAt(SEED, CYC, TDT.nextSlotAfter(SEED, CYC, 0, false)) >= 0);
  }
  // replay(): the five-element r row and the w row are honoured.
  {
    const a = TDT.replay(rec), b = TDT.replay(rec);
    t('replaying the shared recording twice gives identical packed events', JSON.stringify(a.packed) === JSON.stringify(b.packed) && a.packed.length > 0);
    const rIdx = rec.log.findIndex(r => r[0] === 'r');
    t('the log carries one five-element r row naming lowready right after the opening p row', rIdx === 1 && rec.log[rIdx].length === 5 && rec.log[rIdx][2] === 'lowready' && rec.log.filter(r => r[0] === 'r').length === 1);
    const o = JSON.parse(JSON.stringify(rec)); o.log[rIdx] = o.log[rIdx].slice(0, 4);
    const ordinary = TDT.replay(o);
    t('the same log with the wall dropped replays as an ordinary run (one run of five reps, state.drill.shared false, no shared or slot key, different beeps)',
      ordinary.state.drillRuns.length === 1 && ordinary.state.drillRuns[0].reps.length === 5 && ordinary.state.drill.shared === false &&
      !('shared' in ordinary.state.drillRuns[0]) && ordinary.state.drillRuns[0].reps.every(p => !('shared' in p) && !('slot' in p)) &&
      a.state.drillRuns.length === 1 && a.state.drillRuns[0].shared === true && JSON.stringify(ordinary.packed) !== JSON.stringify(a.packed));
    const o2 = JSON.parse(JSON.stringify(rec)), mid2 = o2.log.findIndex(r => r[0] === 'f' && r[1] > 3000);
    const tw = o2.log[mid2][1]; o2.log.splice(mid2, 0, ['w', tw, rec.log[rIdx][4] - rec.log[rIdx][1] + tw]);
    t('a w row that re-states the same wall offset changes no event', JSON.stringify(TDT.replay(o2).packed) === JSON.stringify(a.packed));
    const o3 = JSON.parse(JSON.stringify(rec)); const mid3 = o3.log.findIndex(r => r[0] === 'f' && r[1] > 3000);
    o3.log.splice(mid3, 0, ['w', o3.log[mid3][1], rec.log[rIdx][4] - rec.log[rIdx][1] + o3.log[mid3][1] + 2000]);
    const r3 = TDT.replay(o3);
    t('a w row that shifts the wall by 2 s while a slot is pending changes the replay (it is read)', a.events.filter(e => e.type === 'drillBeep')[0].t > o3.log[mid3][1] && JSON.stringify(r3.packed) !== JSON.stringify(a.packed));
  }
}

// WQ-029: the synthetic Box Drill replays deterministically; the seed in the 'r' row decides the beep time (the only random
// draw: later positions open at the cue). Engine-level checks cover what the recording cannot: cancel, no beep after a cue,
// alarms at the beep and in one position.
const boxFile = files.find(f => f.endsWith(path.join('synthetic', 'drill-box.json')));
if (boxFile) {
  console.log('\nBox Drill determinism (synthetic/drill-box.json, in memory)');
  const t = (desc, pass) => { console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${desc}`); if (!pass) failures++; };
  const rec = JSON.parse(fs.readFileSync(boxFile, 'utf8'));
  const withSeed = sd => { const o = JSON.parse(JSON.stringify(rec)); o.log[o.log.findIndex(r => r[0] === 'r')][3] = sd >>> 0; return o; };
  const beepsOf = res => res.events.filter(e => e.type === 'drillBeep').map(e => e.t);
  const a = TDT.replay(rec), b = TDT.replay(rec);
  t('replaying twice gives identical packed events', JSON.stringify(a.packed) === JSON.stringify(b.packed) && a.packed.length > 0);
  const rIdx = rec.log.findIndex(r => r[0] === 'r');
  t('the log carries one r row, right after the opening p row, naming box', rec.log.filter(r => r[0] === 'r').length === 1 && rIdx === 1 && rec.log[rIdx][2] === 'box');
  t('observed is empty (synthetic recordings carry no live events)', rec.synthetic === true && Array.isArray(rec.observed) && rec.observed.length === 0);
  t('the packed events carry the cues as [t, "drillCue", "move", rep] for reps 1-4',
    a.packed.filter(x => x[1] === 'drillCue').map(x => x.slice(2).join()).join('|') === 'move,1|move,2|move,3|move,4');
  const base = beepsOf(a);
  const seeds = [rec.log[rIdx][3] + 12345, 1, 2, 3, 4, 5, 99, 123456, 4294967295];
  const others = seeds.map(sd => beepsOf(TDT.replay(withSeed(sd))));
  t(`a different seed moves the beep (original ${base.map(Math.round).join('/')}; others ${others.map(o => o.map(Math.round).join('/')).join(', ')})`,
    base.length === 1 && others.every(o => o.length >= 1) && new Set(others.map(o => o[0])).size >= 4 && others.some(o => o[0] !== base[0]));
  t('seed coercion: -1 behaves as 4294967295 (same beeps)', JSON.stringify(beepsOf(TDT.replay(withSeed(-1)))) === JSON.stringify(beepsOf(TDT.replay(withSeed(4294967295)))));

  // Engine-level harness: a Box run driven by hand.
  const W = 844, H = 390, mid = z => [(z.x + z.w / 2) * W, (z.y + z.h / 2) * H];
  const REST = [{ id: 1, cx: mid(TDT.ZONES.rest)[0], cy: mid(TDT.ZONES.rest)[1], rx: 0, ry: 0 }], TR = mid(TDT.zoneFor('trigger', W));
  const mk = seed => {
    const evs = [], eng = TDT.createEngine(Object.assign({}, TDT.DEFAULTS), { onEvent: e => evs.push(e) });
    const c = { evs, eng, T: 0 };
    c.step = (a = 0) => { c.T += 1000 / 60; eng.motion({ t: c.T, a, b: 0, g: 0, angle: 90 }); eng.tick(c.T); };
    c.run = ms => { const e = c.T + ms; while (c.T < e) c.step(); };
    c.press = () => {
      eng.touches(c.T, [{ id: 2, cx: TR[0], cy: TR[1], rx: 0, ry: 0 }], W, H); c.run(60);
      for (const dx of [20, 45, 70]) { eng.touches(c.T, [{ id: 2, cx: TR[0] - dx, cy: TR[1], rx: 0, ry: 0 }], W, H); c.run(40); }
      c.run(30); eng.touches(c.T, [], W, H); c.run(50);
    };
    c.until = (cond, maxMs) => { const e = c.T + maxMs; while (!cond() && c.T < e) c.run(17); return cond(); };
    c.d = () => eng.state.drill;
    c.of = type => evs.filter(e => e.type === type);
    eng.setPaused(false, 0); eng.startDrill(0, 'box', seed);
    return c;
  };
  // Finger on the frame throughout: the beep falls 1000-4000 ms (+1 frame) after arming for any seed.
  {
    const gaps = seeds.map(sd => { const c = mk(sd); c.eng.touches(10, REST, W, H); c.until(() => c.of('drillBeep').length === 1, 6000);
      const bp = c.of('drillBeep')[0], ar = c.of('armed')[0]; return bp && ar ? bp.t - ar.t : NaN; });
    t(`finger on the frame throughout: the beep falls 1000-4000 ms (+1 frame) after arming for ${seeds.length} seeds (${gaps.map(x => Math.round(x)).join(', ')})`,
      gaps.every(x => x >= 1000 && x <= 4000 + 17));
  }
  // Positions after the cue open at the cue time: live at once, no beep, no delay, however long the walk takes.
  {
    const c = mk(5), d = c.d; c.eng.touches(10, REST, W, H);
    t('beep came: position 1 live', c.until(() => d().rep === 1, 6000) && d().phase === 'live' && d().cur.startT === c.of('drillBeep')[0].t && d().cur.beepT === c.of('drillBeep')[0].t);
    c.press(); c.eng.touches(c.T, REST, W, H); c.run(1500);
    t('one shot and the finger back on the frame for 1.5 s: no cue, still position 1, live with one shot', c.of('drillCue').length === 0 && d().rep === 1 && d().phase === 'live' && d().cur.shots.length === 1);
    c.press(); c.eng.touches(c.T, REST, W, H);
    t('second shot, finger back: the cue (move, rep 1) comes in the tick of the ok and position 2 is live at once',
      c.until(() => c.of('drillCue').length === 1, 500) && d().rep === 2 && d().phase === 'live' && d().cur.shots.length === 0);
    const cue = c.of('drillCue')[0], okEv = c.of('ok').filter(e => e.t === cue.t);
    t('cue event {drill box, cue move, rep 1} at the same t as an ok, emitted after it', cue.drill === 'box' && cue.cue === 'move' && cue.rep === 1 && okEv.length === 1 && c.evs.indexOf(okEv[0]) < c.evs.indexOf(cue));
    t('position 2 opens at the cue time with no beep time', d().cur.startT === cue.t && d().cur.beepT === null && d().cur.rep === 2);
    c.run(8000);
    t('eight seconds of walking with the finger on the frame: no second beep, no early shot, no alarm, still position 2 live',
      c.of('drillBeep').length === 1 && d().phase === 'live' && d().rep === 2 && d().early === 0 && c.of('alarmStart').length === 0);
    c.press(); c.press(); c.eng.touches(c.T, REST, W, H); c.until(() => d().reps.length === 2, 500);
    const p2 = d().reps[1];
    t(`position 2 time is the first shot minus the cue, not the beep (${p2 && p2.time})`, !!p2 && Math.abs(p2.time - (c.of('shot')[2].t - cue.t)) < 0.01 && p2.time > 8000 && p2.beepT === null && p2.startT === cue.t);
  }
  // A full run, to the end and a second consecutive run via startDrill; then resetStats clears the runs.
  {
    const c = mk(7), d = c.d; c.eng.touches(10, REST, W, H); c.until(() => d().rep === 1, 6000);
    for (let n = 1; n <= 5; n++) { c.press(); c.press(); c.eng.touches(c.T, REST, W, H); c.run(300); c.run(500); }
    t('five positions of two shots each: one end, four cues, phase ended, one run', c.of('drillEnd').length === 1 && c.of('drillCue').length === 4 && d().phase === 'ended' && c.eng.state.drillRuns.length === 1);
    const run = c.eng.state.drillRuns[0], sh = c.of('shot').map(e => e.t);
    t(`total = shot 10 minus the beep (${run.total}), not the end`, Math.abs(run.total - (sh[9] - c.of('drillBeep')[0].t)) < 0.01 && c.of('drillEnd')[0].t > sh[9]);
    c.eng.resetStats(); t('resetStats clears the runs', c.eng.state.drillRuns.length === 0);
  }
  // A pause in position 3 cancels the run once, loses the positions, and the run restarts at position 0 with a fresh beep.
  {
    const c = mk(9), d = c.d; c.eng.touches(10, REST, W, H); c.until(() => d().rep === 1, 6000);
    for (let n = 1; n <= 2; n++) { c.press(); c.press(); c.eng.touches(c.T, REST, W, H); c.until(() => d().rep === n + 1, 500); c.run(800); }
    t('position 3 live after two cues', d().rep === 3 && d().phase === 'live' && d().reps.length === 2);
    c.press();
    c.eng.setPaused(true, c.T + 1);
    t('pausing a live Box run emits one drillCancel (drill box) and restarts at rep 0 in standby with no positions and no current one',
      c.of('drillCancel').length === 1 && c.of('drillCancel')[0].drill === 'box' && d().phase === 'standby' && d().rep === 0 && d().reps.length === 0 && d().cur === null && d().dueAt === null);
    c.eng.setPaused(false, c.T + 2); c.eng.touches(c.T + 2, REST, W, H);
    t('after the cancel the run restarts: a new beep (rep 1) comes and the old shots do not count',
      c.until(() => c.of('drillBeep').length === 2, 7000) && c.of('drillBeep')[1].rep === 1 && d().rep === 1 && d().cur.shots.length === 0 && d().early === 0);
  }
  // An alarm sounding at the beep marks position 1 (the 180 alarm, as in the Low Ready block): the run counts it once.
  {
    const c = mk(3), d = c.d, eng = c.eng;
    c.run(100); eng.setDownrange(c.T); c.run(100);
    for (let n = 0; eng.state.dev180 < 95 && n < 400; n++) c.step(-120);
    t(`180 setup: muzzle ${eng.state.dev180.toFixed(0)} deg off downrange, no alarm yet`, eng.state.dev180 > 95 && !eng.state.alarmActive);
    eng.touches(c.T, REST, W, H);
    t('beep with the 180 alarm sounding: run alarms 1, position 1 marked', c.until(() => d().rep === 1, 7000) && eng.state.alarmActive && d().alarms === 1 && d().cur.alarms === 1);
    c.press(); c.press(); eng.touches(c.T, REST, W, H);
    t('cue 1: position 1 carries the alarm (withAlarm), the run counts one episode, shots unsafe',
      c.until(() => d().reps.length === 1, 3000) && d().alarms === 1 && d().reps[0].alarms === 1 && d().reps[0].withAlarm === true && d().reps[0].shots.every(x => x.unsafe) && c.of('alarmStart').length === 1);
  }
  // A move alarm in position 3 only (finger off the frame, phone swung, finger back) marks that position, not the others.
  {
    const c = mk(11), d = c.d, eng = c.eng; eng.touches(10, REST, W, H); c.until(() => d().rep === 1, 6000);
    for (let n = 1; n <= 4; n++) {
      if (n === 3) { eng.touches(c.T, [], W, H); c.run(200); for (let k = 0; k < 15; k++) c.step(80); eng.touches(c.T, REST, W, H); c.run(500); }
      c.press(); c.press(); eng.touches(c.T, REST, W, H); c.until(() => d().reps.length === n, 500); c.run(800);
    }
    c.press(); c.press(); eng.touches(c.T, REST, W, H); c.until(() => c.of('drillEnd').length === 1, 800);
    const run = eng.state.drillRuns[0];
    t(`one alarm during position 3: that position has alarms 1 / withAlarm, the other four none; the run has 1 alarm (${run && run.reps.map(p => p.alarms)})`,
      !!run && run.alarms === 1 && run.withAlarm === true && run.reps.map(p => p.withAlarm).join() === 'false,false,true,false,false' && run.reps[2].alarms === 1);
  }
  // Early shots: before the beep only, counted in the run and position 1.
  {
    const c = mk(13), d = c.d; c.eng.touches(10, REST, W, H); c.run(100); c.press(); c.eng.touches(c.T, REST, W, H);
    c.until(() => d().rep === 1, 7000); c.press(); c.press(); c.eng.touches(c.T, REST, W, H); c.until(() => d().reps.length === 1, 500);
    t('a shot before the beep is early: counted in the run and in position 1, not in the position\'s shots', d().early === 1 && d().reps[0].early === 1 && d().reps[0].shots.length === 2);
  }
  // A 180 alarm that spans cue 1 (D-107): position 1 and position 2 are marked, position 3 (after the alarm cleared) is not;
  // the run counts the one episode once.
  {
    const c = mk(3), d = c.d, eng = c.eng;
    c.run(100); eng.setDownrange(c.T); c.run(100);
    for (let n = 0; eng.state.dev180 < 95 && n < 400; n++) c.step(-120);
    eng.touches(c.T, REST, W, H);
    c.until(() => d().rep === 1, 7000);
    c.press(); c.press(); eng.touches(c.T, REST, W, H);
    t('cue 1 with the 180 alarm still sounding: position 2 opens already marked (cur.alarms 1), the run still counts 1',
      c.until(() => d().reps.length === 1, 1000) && eng.state.alarmActive && d().rep === 2 && d().cur.alarms === 1 && d().alarms === 1);
    for (let n = 0; eng.state.dev180 > 30 && n < 600; n++) c.step(120);        // back downrange with the finger on the frame: the alarm clears
    c.run(200);
    t(`the alarm clears once back downrange (dev ${eng.state.dev180.toFixed(0)} deg)`, !eng.state.alarmActive);
    c.press(); c.press(); eng.touches(c.T, REST, W, H); c.until(() => d().reps.length === 2, 1000);
    c.run(500); c.press(); c.press(); eng.touches(c.T, REST, W, H); c.until(() => d().reps.length === 3, 1000);
    const rp = d().reps;
    t(`spanning alarm: positions 1 and 2 withAlarm, position 3 not; the run counts one alarm, one alarmStart (${rp.map(x => x.alarms)})`,
      rp.length === 3 && rp[0].withAlarm && rp[1].withAlarm && !rp[2].withAlarm && d().alarms === 1 && c.of('alarmStart').length === 1);
  }
  // A third shot at position 5 before the finger returns joins the position and the total runs to that third shot.
  {
    const c = mk(21), d = c.d; c.eng.touches(10, REST, W, H); c.until(() => d().rep === 1, 6000);
    for (let n = 1; n <= 4; n++) { c.press(); c.press(); c.eng.touches(c.T, REST, W, H); c.until(() => d().reps.length === n, 1000); c.run(300); }
    c.press(); c.press(); c.press(); c.eng.touches(c.T, REST, W, H); c.until(() => c.of('drillEnd').length === 1, 1000);
    const run = c.eng.state.drillRuns[0], sh = c.of('shot').map(e => e.t), beep = c.of('drillBeep')[0].t;
    t(`third shot at position 5: 11 shots, position 5 has 3, total = shot 11 minus the beep (${run && run.total}), not shot 10`,
      !!run && sh.length === 11 && run.reps[4].shots.length === 3 && Math.abs(run.total - (sh[10] - beep)) < 0.01 && run.total > sh[9] - beep + 100);
  }
  // A cancel in finishing: two shots fired at position 3, finger not yet back, then a pause.
  {
    const c = mk(23), d = c.d; c.eng.touches(10, REST, W, H); c.until(() => d().rep === 1, 6000);
    for (let n = 1; n <= 2; n++) { c.press(); c.press(); c.eng.touches(c.T, REST, W, H); c.until(() => d().reps.length === n, 1000); c.run(300); }
    c.eng.touches(c.T, [], W, H); c.run(100); c.press(); c.press();
    t('position 3 finishing (two shots, finger off the frame), two positions done', d().rep === 3 && d().phase === 'finishing' && d().reps.length === 2 && d().cur.shots.length === 2);
    c.eng.setPaused(true, c.T + 1);
    t('pausing in finishing: one drillCancel, standby at rep 0, positions and current position lost, no cue after the pause',
      c.of('drillCancel').length === 1 && d().phase === 'standby' && d().rep === 0 && d().reps.length === 0 && d().cur === null && d().cueDueAt === null && c.of('drillCue').length === 2 && c.of('drillEnd').length === 0);
  }
}

// WQ-030: the synthetic Transitions drill replays deterministically; the seed in the 'r' row decides the beep time. Engine-level
// checks cover the alarm window (D-112 d: first shot to tenth shot, finger on the trigger), the drift-reference re-takes (f, g),
// the 180 rule inside the window (e), grading from the press start (i), and what must NOT change (Bill, Freestyle, a pause).
// Every "no alarm" check is paired with the same stimulus alarming outside the window.
const trFile = files.find(f => f.endsWith(path.join('synthetic', 'drill-transitions.json')));
if (trFile) {
  console.log('\nTransitions determinism and window (synthetic/drill-transitions.json, in memory)');
  const t = (desc, pass) => { console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${desc}`); if (!pass) failures++; };
  const rec = JSON.parse(fs.readFileSync(trFile, 'utf8'));
  const withSeed = sd => { const o = JSON.parse(JSON.stringify(rec)); o.log[o.log.findIndex(r => r[0] === 'r')][3] = sd >>> 0; return o; };
  const withDrill = id => { const o = JSON.parse(JSON.stringify(rec)); const r = o.log.find(x => x[0] === 'r'); if (id) r[2] = id; else o.log.splice(o.log.indexOf(r), 1); return o; };
  const beepsOf = res => res.events.filter(e => e.type === 'drillBeep').map(e => e.t);
  const a = TDT.replay(rec), b = TDT.replay(rec);
  t('replaying twice gives identical packed events', JSON.stringify(a.packed) === JSON.stringify(b.packed) && a.packed.length > 0);
  const rIdx = rec.log.findIndex(r => r[0] === 'r');
  t('the log carries one r row, right after the opening p row, naming transitions', rec.log.filter(r => r[0] === 'r').length === 1 && rIdx === 1 && rec.log[rIdx][2] === 'transitions');
  t('observed is empty (synthetic recordings carry no live events)', rec.synthetic === true && Array.isArray(rec.observed) && rec.observed.length === 0);
  t('packed: one drillBeep, one drillEnd naming transitions with the run total, no drillCancel, no alarmStart, no drillCue',
    a.packed.filter(x => x[1] === 'drillBeep').length === 1 && a.packed.filter(x => x[1] === 'drillEnd').length === 1
    && a.packed.find(x => x[1] === 'drillEnd')[2] === 'transitions' && a.packed.find(x => x[1] === 'drillEnd')[3] === a.state.drillRuns[0].total
    && !a.packed.some(x => x[1] === 'drillCancel' || x[1] === 'alarmStart' || x[1] === 'drillCue'));
  // The window is what keeps this recording quiet: the same log as Bill or as Freestyle alarms in the swings.
  {
    const asBill = TDT.replay(withDrill('bill')), asFree = TDT.replay(withDrill(null));
    const ab = asBill.events.filter(e => e.type === 'alarmStart'), af = asFree.events.filter(e => e.type === 'alarmStart');
    t(`vacuity: the same recording as a Bill run alarms in a swing (${ab.length} alarms), as Freestyle too (${af.length}); as Transitions none`,
      ab.length >= 1 && af.length >= 1 && ab.every(e => e.reason === 'move') && a.events.filter(e => e.type === 'alarmStart').length === 0);
  }
  const base = beepsOf(a);
  const seeds = [rec.log[rIdx][3] + 12345, 1, 2, 3, 4, 5, 99, 123456, 4294967295];
  const others = seeds.map(sd => beepsOf(TDT.replay(withSeed(sd))));
  t(`a different seed moves the beep (original ${base.map(Math.round).join('/')}; others ${others.map(o => o.map(Math.round).join('/')).join(', ')})`,
    base.length === 1 && others.every(o => o.length >= 1) && new Set(others.map(o => o[0])).size >= 4 && others.some(o => o[0] !== base[0]));
  t('seed coercion: -1 behaves as 4294967295 (same beeps)', JSON.stringify(beepsOf(TDT.replay(withSeed(-1)))) === JSON.stringify(beepsOf(TDT.replay(withSeed(4294967295)))));

  // ---- engine-level harness: a Transitions run driven by hand ----
  const W = 844, H = 390, mid = z => [(z.x + z.w / 2) * W, (z.y + z.h / 2) * H];
  const REST = [{ id: 1, cx: mid(TDT.ZONES.rest)[0], cy: mid(TDT.ZONES.rest)[1], rx: 0, ry: 0 }], TR = mid(TDT.zoneFor('trigger', W));
  const TOUCH = dx => [{ id: 2, cx: TR[0] - dx, cy: TR[1], rx: 0, ry: 0 }];
  const mk = (seed, id = 'transitions') => {
    const evs = [], eng = TDT.createEngine(Object.assign({}, TDT.DEFAULTS), { onEvent: e => evs.push(e) });
    const c = { evs, eng, T: 0, freeSeen: [] };
    c.step = (a = 0) => { c.T += 1000 / 60; eng.motion({ t: c.T, a, b: 0, g: 0, angle: 90 }); eng.tick(c.T); c.freeSeen.push(eng.state.drillFree); };
    c.run = ms => { const e = c.T + ms; while (c.T < e) c.step(); };
    c.rate = (dps, ms) => { const e = c.T + ms; while (c.T < e) c.step(dps); };                  // a turn at dps for ms (dps * ms / 1000 deg)
    c.swing = (deg, dps = 80) => c.rate(Math.sign(deg) * dps, Math.abs(deg) / dps * 1000);       // a fast swing through deg degrees
    c.on = () => eng.touches(c.T, TOUCH(0), W, H);                                                // finger onto the trigger, no pull
    c.frame = () => eng.touches(c.T, REST, W, H);
    c.lift = () => eng.touches(c.T, [], W, H);
    // one pull and reset with the touch kept on the trigger (the finger stays prepped)
    c.fire = () => { for (const dx of [20, 45, 70]) { eng.touches(c.T, TOUCH(dx), W, H); c.run(40); } c.on(); c.run(120); };
    c.until = (cond, maxMs) => { const e = c.T + maxMs; while (!cond() && c.T < e) c.run(17); return cond(); };
    c.d = () => eng.state.drill;
    c.of = type => evs.filter(e => e.type === type);
    c.alarms = () => c.of('alarmStart');
    c.go = () => { eng.touches(10, REST, W, H); return c.until(() => c.d().phase === 'live', 7000); };   // to the beep
    eng.setPaused(false, 0); eng.startDrill(0, id, seed);
    return c;
  };
  // (a) + (b): the same swing, before the first shot and after it.
  {
    const c = mk(5); t('beep came, run live with no shots, window closed', c.go() && c.d().shots.length === 0 && !c.eng.state.drillFree);
    c.on(); c.run(600);
    t('finger on the trigger before the first shot, no pull, phone still: off the frame, no alarm, window closed', !c.eng.state.onRest && c.alarms().length === 0 && c.eng.state.drillFree === false);
    c.swing(40);
    t('(a) a fast 40 deg swing with the finger on the trigger BEFORE the first shot alarms (move)', c.alarms().length === 1 && c.alarms()[0].reason === 'move' && c.eng.state.alarmActive && c.eng.state.drillFree === false);
  }
  {
    const c = mk(5); c.go(); c.on(); c.run(600); c.fire(); c.run(600);
    t('(b) first shot fired: one shot in the run, window open (drillFree true), no alarm', c.d().shots.length === 1 && c.eng.state.drillFree === true && c.alarms().length === 0);
    c.freeSeen.length = 0; c.swing(40);
    t('(b) the same 40 deg swing after shot 1 raises no alarm, and drillFree is true on every tick of it', c.alarms().length === 0 && !c.eng.state.alarmActive && c.freeSeen.length > 20 && c.freeSeen.every(x => x === true));
    c.freeSeen.length = 0; c.swing(-40); c.run(300); c.rate(10, 800);
    t('(b) the swing back, a slow 8 deg drift and a standstill: still no alarm (rate, drift and press jerk tests all suspended)', c.alarms().length === 0 && c.freeSeen.every(x => x === true) && c.eng.state.devOff > 5);
    c.fire();
    t('(b) a second press in the window: shot 2, no alarm, window still open', c.d().shots.length === 2 && c.alarms().length === 0 && c.eng.state.drillFree === true);
    // drill frozen-in: with the finger back on the frame the window closes
    c.frame(); c.run(100);
    t('(b) finger back on the frame mid-window: window closed (no trigger touch), on rest', c.eng.state.onRest && c.eng.state.drillFree === false && c.alarms().length === 0);
  }
  // Same stimulus in Freestyle and in Bill alarms (the window is Transitions-only) (h).
  for (const [name, id] of [['Bill', 'bill'], ['Freestyle', null]]) {
    const c = mk(5, id || 'bill'); if (!id) c.eng.cancelDrill(0);
    c.eng.touches(10, REST, W, H); if (id) c.until(() => c.d().phase === 'live', 7000); else c.run(300);
    c.on(); c.run(600); c.fire(); c.run(600);
    t(`(h) ${name}: one shot fired with the finger kept on the trigger; drillFree is false`, c.of('shot').length === 1 && c.eng.state.drillFree === false);
    c.swing(40);
    t(`(h) ${name}: the same swing after the first shot alarms (move)`, c.alarms().length === 1 && c.alarms()[0].reason === 'move');
  }
  // (c) lifted off the trigger mid-window, not onto the frame: normal rules, drift reference re-taken at the lift.
  {
    const c = mk(5); c.go(); c.on(); c.run(600); c.fire(); c.run(600); c.swing(40); c.run(200);
    c.lift(); c.run(700);                                                    // past graceMs (300): the swing already made is not counted
    t('(c) trigger touch lifted mid-window, finger off everything: window closed, no alarm at the lift, drift reference re-taken (devOff ~0)',
      c.eng.state.drillFree === false && c.alarms().length === 0 && c.eng.state.devOff < 0.5 && !c.eng.state.onRest, c.eng.state.devOff);
    c.rate(10, 400);
    t(`(c) 4 deg of slow drift after the lift does not alarm even though 44 deg have passed since the finger left the frame (devOff ${c.eng.state.devOff.toFixed(1)})`,
      c.alarms().length === 0 && c.eng.state.devOff > 3 && c.eng.state.devOff < 5);
    c.rate(10, 400);
    t(`(c) a further 4 deg (devOff ${c.eng.state.devOff.toFixed(1)}) alarms (move): the off-frame rules are back`, c.alarms().length === 1 && c.alarms()[0].reason === 'move' && c.eng.state.devOff > 5);
  }
  {
    const c = mk(5); c.go(); c.on(); c.run(600); c.fire(); c.run(600); c.swing(40); c.run(200);
    c.lift(); c.run(700);
    c.swing(40);
    t('(c) a fast swing with the trigger lifted mid-window alarms (move)', c.alarms().length === 1 && c.alarms()[0].reason === 'move');
  }
  // (d) after the tenth shot, finger still on the trigger: the normal rules, press movement restarted at the tenth shot.
  {
    const c = mk(5); c.go(); c.on(); c.run(600);
    for (let n = 1; n <= 8; n++) { c.fire(); if (n % 2 === 0) { c.run(300); c.swing(n % 4 ? -40 : 40); c.run(400); } else c.run(150); }
    c.run(300);
    t('eight shots, four swings, no alarm; window open', c.d().shots.length === 8 && c.alarms().length === 0 && c.eng.state.drillFree === true);
    c.fire(); c.run(300);
    // tenth press with ~200 ms of movement during the pull, before the break
    c.eng.touches(c.T, TOUCH(20), W, H); c.run(100); c.rate(60, 200); c.run(150);
    const before = c.eng.state.trig.moveMs;
    c.eng.touches(c.T, TOUCH(70), W, H);
    t(`the movement count of the press had reached ${Math.round(before)} ms (>= 150) before shot 10, and is 0 at shot 10`,
      before >= 150 && c.d().phase === 'finishing' && c.d().shots.length === 10 && c.eng.state.trig.moveMs === 0);
    // the finger stays pulled through the break (the press runs on for 500 ms after it); a 150 ms jerk right after shot 10
    c.rate(60, 75); c.rate(-60, 75);                            // back and forth: well inside offFrameDeg
    const jerk = c.eng.state.trig.moveMs;
    t(`a 150 ms jerk right after shot 10 (press movement ${Math.round(before)} + ${Math.round(jerk)} ms would pass jerkMs 300 without the restart; it is ${Math.round(jerk)}): no alarm`,
      c.alarms().length === 0 && c.eng.state.drillFree === false && c.eng.state.inPress && jerk > 100 && jerk < 300 && before + jerk > 300);
    c.on(); c.run(900);
    c.swing(40);
    t('(d) after shot 10, finger still on the trigger: the same fast swing alarms (move); window closed (phase finishing)',
      c.alarms().length === 1 && c.alarms()[0].reason === 'move' && c.eng.state.drillFree === false && c.d().phase === 'finishing');
    c.frame(); c.run(100);
    t('finger to the frame: alarm clears, drillEnd with the alarm counted (withAlarm true, alarms 1)', !c.eng.state.alarmActive && c.of('drillEnd').length === 1 && c.eng.state.drillRuns[0].withAlarm === true && c.eng.state.drillRuns[0].alarms === 1);
  }
  // (d2) the drift reference is re-taken at the tenth shot: a slow drift after it is judged from there.
  {
    const c = mk(5); c.go(); c.on(); c.run(600);
    for (let n = 1; n <= 9; n++) { c.fire(); c.run(n % 2 ? 150 : 300); if (n % 2 === 0) { c.swing(n % 4 ? -40 : 40); c.run(400); } }
    c.swing(40); c.run(400);
    t(`before shot 10: nine shots, ~40 deg of drift since the finger left (devOff ${c.eng.state.devOff.toFixed(0)}), no alarm`, c.d().shots.length === 9 && c.eng.state.devOff > 20 && c.alarms().length === 0);
    c.fire();
    t('shot 10: phase finishing, drift reference re-taken (devOff ~0)', c.d().phase === 'finishing' && c.eng.state.devOff < 1, c.eng.state.devOff);
    c.run(1100); c.rate(10, 400);
    t(`(g) 4 deg of slow drift after shot 10 does not alarm (judged from the tenth shot; devOff ${c.eng.state.devOff.toFixed(1)})`, c.alarms().length === 0 && c.eng.state.devOff > 3 && c.eng.state.devOff < 5);
    c.rate(10, 400);
    t(`(g) 8 deg after shot 10 alarms (move; devOff ${c.eng.state.devOff.toFixed(1)}): the drift rule is live again`, c.alarms().length === 1 && c.alarms()[0].reason === 'move');
  }
  // (e) the 180 rule stays inside the window.
  {
    const c = mk(5), eng = c.eng; c.run(100); eng.setDownrange(c.T); c.run(100); c.go(); c.on(); c.run(600); c.fire(); c.run(600);
    t('downrange set, shot 1 fired, window open, no alarm', c.d().shots.length === 1 && eng.state.drillFree === true && c.alarms().length === 0);
    c.swing(60); c.run(100);
    t('a swing within 90 deg of downrange: no alarm (inside the window)', c.alarms().length === 0 && eng.state.dev180 > 50 && eng.state.dev180 < 90);
    c.swing(60);
    t(`(e) past 90 deg of downrange (${eng.state.dev180.toFixed(0)} deg) with the finger on the trigger, inside the window: the 180 alarm fires`,
      eng.state.drillFree === true && c.alarms().length === 1 && c.alarms()[0].reason === '180' && eng.state.alarmActive);
  }
  {
    const c = mk(5), eng = c.eng; c.run(100); eng.setDownrange(c.T); c.run(100); c.go(); c.on(); c.run(600); c.fire(); c.run(600);
    c.swing(-120); c.run(200);
    t('(e) the same swing the other way round also trips the 180 rule inside the window', c.alarms().some(e => e.reason === '180'));
  }
  // (f) an alarm latched before the window is not cleared by it; shots fired in it are unsafe and the run is withAlarm.
  {
    const c = mk(5); c.go(); c.on(); c.run(600); c.swing(40);
    t('alarm latched before the first shot (move)', c.alarms().length === 1 && c.eng.state.alarmActive);
    for (let n = 0; n < 10; n++) { c.fire(); c.run(200); }
    t('ten shots fired with the alarm latched: the swing did not clear it, one alarmStart, window ended the run at shot 10', c.eng.state.alarmActive && c.alarms().length === 1 && c.d().phase === 'finishing' && c.d().shots.length === 10);
    c.frame(); c.run(100);
    const run = c.eng.state.drillRuns[0];
    t('(f) every shot of the run is unsafe (not graded), the run is withAlarm with alarms 1', !!run && run.shots.length === 10 && run.shots.every(x => x.unsafe) && run.withAlarm === true && run.alarms === 1);
  }
  // (g) a pause in live cancels the run; the window is closed afterwards.
  {
    const c = mk(5); c.go(); c.on(); c.run(600); c.fire(); c.run(300); c.fire(); c.run(300); c.swing(40);
    t('three-quarters through a pair swing: window open', c.eng.state.drillFree === true && c.d().shots.length === 2);
    c.eng.setPaused(true, c.T + 1);
    t('pause: one drillCancel (transitions), fresh standby with no shots', c.of('drillCancel').length === 1 && c.of('drillCancel')[0].drill === 'transitions' && c.d().phase === 'standby' && c.d().shots.length === 0 && c.d().dueAt === null);
    c.eng.setPaused(false, c.T + 2); c.eng.touches(c.T + 2, REST, W, H); c.run(100);
    t('resumed: window closed (drillFree false) and no alarm', c.eng.state.drillFree === false && c.alarms().length === 0);
    t('and a new beep comes (rep 1) with the old shots gone', c.until(() => c.of('drillBeep').length === 2, 7000) && c.d().shots.length === 0 && c.d().early === 0);
  }
  // (i) Bill's result keeps exactly its keys; (j) the seed is coerced like the others.
  {
    const c = mk(5, 'bill'); c.go(); c.on(); c.run(600);
    for (let n = 0; n < 6; n++) { c.fire(); c.run(200); }
    c.frame(); c.run(100);
    const run = c.eng.state.drillRuns[0];
    t('(i) a Bill result has no pairSplits / transitions / avgTransition and six shots', !!run && run.shots.length === 6 && !('pairSplits' in run) && !('transitions' in run) && !('avgTransition' in run));
    const tr = mk(5); tr.go(); tr.on(); tr.run(600); for (let n = 0; n < 10; n++) { tr.fire(); tr.run(200); } tr.frame(); tr.run(100);
    const rr = tr.eng.state.drillRuns[0];
    t('(i) the Transitions result of the same kind of run has the three keys', !!rr && Array.isArray(rr.pairSplits) && Array.isArray(rr.transitions) && typeof rr.avgTransition === 'number');
    const s1 = mk('7'), s2 = mk(7);
    s1.eng.touches(10, REST, W, H); s2.eng.touches(10, REST, W, H); s1.until(() => s1.of('drillBeep').length, 7000); s2.until(() => s2.of('drillBeep').length, 7000);
    t(`(j) startDrill(0, "transitions", "7") is seed 7 (${s1.d().seed}) and beeps exactly when numeric 7 does`, s1.d().seed === 7 && s1.of('drillBeep')[0].t === s2.of('drillBeep')[0].t);
  }
  // Grading from the press start (D-112 i): a swing that finishes before the pull reaches 15 % is not in the shot's deviation.
  {
    const run = id => {
      const c = mk(5, id); c.go(); c.on(); c.run(600); c.fire(); c.run(600);
      c.swing(40); c.run(300);                                              // the swing to the next target, then still
      c.eng.touches(c.T, TOUCH(20), W, H); c.run(100);                      // pull passes 15 % (9 px) with the phone still
      c.eng.touches(c.T, TOUCH(45), W, H); c.run(50); c.eng.touches(c.T, TOUCH(70), W, H); c.run(60);
      return c.of('shot')[1];
    };
    const tshot = run('transitions'), bshot = run('bill');
    t(`grading: Transitions grades the shot after the 40 deg swing from the press start: Clean, dev ${tshot && tshot.shot.dev}`, !!tshot && tshot.shot.grade === 'Clean' && tshot.shot.dev < 0.5);
    t(`grading: the same sequence in Bill counts the swing: dev ${bshot && bshot.shot.dev.toFixed(1)} deg, not Clean (${bshot && bshot.shot.grade})`, !!bshot && bshot.shot.dev > 5 && bshot.shot.grade !== 'Clean');
  }
  // (F) the stimulus itself: the recording's four swings are real (>= 80 deg/s for >= 0.45 s, >= 35 deg) and nothing else moves
  {
    const ms = rec.log.filter(r => r[0] === 'm'), mag = r => Math.hypot(r[2], r[3], r[4]);
    const stretches = []; let cur = null;
    ms.forEach((r, i) => {
      const hi = mag(r) >= 79.9;
      if (hi) { if (!cur) { cur = { t0: r[1], t1: r[1], deg: 0 }; stretches.push(cur); } const dt = i ? (r[1] - ms[i - 1][1]) / 1000 : 0; cur.deg += mag(r) * dt; cur.t1 = r[1]; }
      else cur = null;
    });
    t(`(F) the recording holds exactly four swings (${stretches.length}), each >= 80 deg/s for >= 0.45 s and integrating to >= 35 deg (${stretches.map(x => `${((x.t1 - x.t0) / 1000 + 1 / 60).toFixed(2)} s/${x.deg.toFixed(0)} deg`).join(', ')})`,
      stretches.length === 4 && stretches.every(x => (x.t1 - x.t0) / 1000 + 1 / 60 >= 0.45 && x.deg >= 35));
    t('(F) no other stretch of the recording exceeds moveDps (25 deg/s): the only fast turning is the four swings',
      ms.every(r => mag(r) >= 79.9 || mag(r) <= TDT.DEFAULTS.moveDps));
  }
  // (A) grading origin follows the muzzle until the pull has risen 15 % above its lowest point of the attempt
  {
    const pull2 = c => { for (const dx of [20, 45, 70]) { c.eng.touches(c.T, TOUCH(dx), W, H); c.run(40); } };   // a pull with no return: the touch stays at 70 px
    const seq = (id, how, ride) => {
      const c = mk(5, id); c.go(); c.on(); c.run(600); c.fire(); c.run(300);                              // shot 1, touch kept at base
      if (ride) { pull2(c); c.run(100); } else { c.fire(); c.run(300); }                                  // shot 2: held at 70 px (ride) or returned to base
      how(c);
      c.eng.touches(c.T, TOUCH(45), W, H); c.run(40); c.eng.touches(c.T, TOUCH(70), W, H); c.run(60);
      return c;
    };
    const ride = c => { c.eng.touches(c.T, TOUCH(25), W, H);   // the broken trigger rides forward to 25 px: that is the reset, minPull 25
      c.run(100); c.swing(40); c.run(300); };      // hold the reset at ~40 % pull, swing, the phone still
    const abort = c => { c.eng.touches(c.T, TOUCH(18), W, H); c.run(100); c.eng.touches(c.T, TOUCH(0), W, H); c.run(100); c.swing(40); c.run(300); };   // 30 % and back
    for (const [name, how, rd] of [['A1 reset-ride (held at 25 px = 42 %)', ride, true], ['A2 aborted press (30 % and back to 0)', abort, false]]) {
      const tc = seq('transitions', how, rd), bc = seq('bill', how, rd);
      const ts = tc.d().shots[2], bs = bc.d().shots[2];
      t(`(${name}) Transitions: shot 3 grades from the press start: dev ${ts && ts.dev.toFixed(2)} (< 1), Clean, no alarm`, tc.d().shots.length === 3 && ts.grade === 'Clean' && ts.dev < 1 && tc.alarms().length === 0, ts);
      t(`(${name}) vacuity, same sequence in Bill: the swing is in the deviation: dev ${bs && bs.dev.toFixed(1)} (about 40), not Clean`, bc.d().shots.length === 3 && bs.dev > 30 && bs.dev < 50 && bs.grade !== 'Clean', bs);
    }
    // a press that rises through the freeze point and falls back below it re-takes again (the origin follows a hold at the low point only)
    const c = mk(5); c.go(); c.on(); c.run(600); c.fire(); c.run(300);
    c.eng.touches(c.T, TOUCH(30), W, H); c.run(60); c.swing(20); c.run(100);                              // above 15 % of base 0: origin frozen at the 30 px moment
    c.eng.touches(c.T, TOUCH(0), W, H); c.run(100); c.swing(-20); c.run(200);                              // back to the low point, then another swing: origin follows
    c.eng.touches(c.T, TOUCH(45), W, H); c.run(40); c.eng.touches(c.T, TOUCH(70), W, H); c.run(60);
    t(`(A3) press rising, falling back below the freeze point, swinging, then firing: the shot grades from the last low point (dev ${c.d().shots[1] && c.d().shots[1].dev.toFixed(2)} < 1)`, c.d().shots.length === 2 && c.d().shots[1].dev < 1);
  }
  // (B) a run replaced or dropped un-paused inside the window: cancel event, drift reference re-taken, window closed
  for (const [name, act] of [['cancelDrill', c => c.eng.cancelDrill(c.T)], ["startDrill('bill')", c => c.eng.startDrill(c.T, 'bill', 9)]]) {
    const c = mk(5); c.go(); c.on(); c.run(600); c.fire(); c.run(600); c.swing(40); c.run(100);
    t(`(B) ${name}: setup: window open after a 40 deg swing, no alarm`, c.eng.state.drillFree === true && c.alarms().length === 0 && c.eng.state.devOff > 30);
    act(c);
    const freeAtOnce = c.eng.state.drillFree; c.run(20);
    t(`(B) ${name}: one drillCancel (transitions), drillFree false at once, drift reference re-taken (devOff ${c.eng.state.devOff.toFixed(2)} at the next tick)`,
      c.of('drillCancel').length === 1 && c.of('drillCancel')[0].drill === 'transitions' && freeAtOnce === false && c.eng.state.devOff < 1);
    c.run(800);
    t(`(B) ${name}: no alarmStart over the next 800 ms with the phone still (without the re-take the 40 deg drift would alarm); window still closed`, c.alarms().length === 0 && c.eng.state.drillFree === false);
    c.rate(10, 1000);
    t(`(B) ${name}: ... and the normal drift rule is live afterwards (a slow 10 deg alarms)`, c.alarms().length === 1 && c.alarms()[0].reason === 'move');
  }
  // (C) a pause mid-window closes the window at once
  {
    const c = mk(5); c.go(); c.on(); c.run(600); c.fire(); c.run(300);
    t('(C) setup: window open', c.eng.state.drillFree === true);
    c.eng.setPaused(true, c.T + 1);
    t('(C) setPaused(true) mid-window: drillFree is false immediately, with no tick in between', c.eng.state.drillFree === false && c.of('drillCancel').length === 1);
  }
  // (I) a shot before the beep is early and opens no window
  {
    const c = mk(5); c.eng.touches(10, REST, W, H); c.run(700); c.on(); c.run(500); c.fire(); c.run(300);
    t('(I) a shot in standby before the beep: early 1, phase standby, no run shot, drillFree false', c.d().phase === 'standby' && c.d().early === 1 && c.d().shots.length === 0 && c.eng.state.drillFree === false && c.of('shot').length === 1);
    c.swing(40);
    t('(I) ... and a swing then alarms (no window was opened by that shot)', c.alarms().length === 1 && c.alarms()[0].reason === 'move');
    c.frame(); c.run(100);
    c.until(() => c.d().phase === 'live', 7000);
    t('(I) the beep still comes after the early shot; the early shot is not one of the ten (shots 0, early 1)', c.d().phase === 'live' && c.d().shots.length === 0 && c.d().early === 1);
  }
}

for (const [ua, list] of Object.entries(byDevice)) {
  const labels = new Set(list.map(x => x.label));
  if (labels.size < 2) continue;
  const common = list.map(x => new Set(x.ok)).reduce((a, b) => new Set([...a].filter(v => b.has(v))));
  console.log(`\nAxis verdict for ${ua.slice(0, 96)}: ${[...common].join(', ') || 'no single mapping fits both'}`);
  if (list.some(x => x.rec.synthetic)) {
    console.log(`  INFO  synthetic recordings pin their own axisMode; 'auto' check skipped`);
    continue;
  }
  for (const x of list) {
    const chosen = autoResolution(x.rec);
    const pass = chosen !== null && common.has(chosen);
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${x.label}: auto → ${chosen || 'unresolved'}; fits: ${[...common].join(', ') || 'none'}  (${x.rel})`);
    if (!pass) failures++;
  }
}

console.log(failures ? `\n${failures} failed` : `\nall passed (${files.length} recordings)`);
process.exit(failures ? 1 : 0);
