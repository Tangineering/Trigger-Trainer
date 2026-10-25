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
    drillEnds: ev.filter(e => e.type === 'drillEnd').length,
    drillCancels: ev.filter(e => e.type === 'drillCancel').length,
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
    (sum.drillBeeps || sum.drillEnds || sum.drillCancels ? `  drill: beeps ${sum.drillBeeps} ends ${sum.drillEnds} cancels ${sum.drillCancels}` : ''));

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
  const other = JSON.parse(JSON.stringify(rec));
  other.log[rIdx][3] = (rec.log[rIdx][3] + 12345) >>> 0;
  const c = TDT.replay(other);
  const beepOf = res => (res.events.find(e => e.type === 'drillBeep') || {}).t;
  t(`a different seed gives a different beep time (${beepOf(a)} vs ${beepOf(c)})`, beepOf(c) !== undefined && beepOf(a) !== undefined && beepOf(c) !== beepOf(a));
  const run = a.state.drillRuns[0], shots = a.events.filter(e => e.type === 'shot').map(e => e.t), beep = beepOf(a);
  t('one finished run in state.drillRuns', a.state.drillRuns.length === 1 && !!run);
  const near = (x, y) => Math.abs(x - y) < 0.01;   // result values are rounded to 4 decimals (r4)
  t(`result.first equals shot 1 minus the beep (${run && run.first})`, !!run && near(run.first, shots[0] - beep));
  t('result.splits equal the five shot gaps', !!run && run.splits.length === 5 && run.splits.every((x, i) => near(x, shots[i + 1] - shots[i])));
  t(`result.total equals shot 6 minus the beep (${run && run.total}) and first + splits`, !!run && near(run.total, shots[5] - beep) && near(run.total, run.first + run.splits.reduce((x, y) => x + y, 0)));
  const endEv = a.events.find(e => e.type === 'drillEnd');
  t('drillEnd carries the same total', !!endEv && near(endEv.result.total, run.total));
  const seeds = [1, 2, 3, 4, 5, 99, 123456, 4294967295].map(sd => { const r2 = JSON.parse(JSON.stringify(rec)); r2.log[rIdx][3] = sd; return beepOf(TDT.replay(r2)) - a.events.find(e => e.type === 'armed').t; });
  t(`beep falls 1000-4000 ms (+1 frame) after arming for 8 seeds (${seeds.map(x => Math.round(x)).join(', ')})`, seeds.every(x => x >= 1000 && x <= 4000 + 17));
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
