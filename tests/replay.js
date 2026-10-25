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
  const sum = summarize(res);
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
