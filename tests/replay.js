// Replays every recording in tests/recordings/ through engine.js (no browser) and checks:
//  1. label expectations (tests/expectations.js)
//  2. live == replay: for recordings made with the current engine version, the replay must
//     reproduce the events the phone produced live, exactly
//  3. for axis-* recordings: which gyro axis mapping / flips would read the motion correctly
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
  else if (p.endsWith('.json')) files.push(p);
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
    finalAlarm: res.state.alarmActive,
    maxDev: Math.max(0, ...res.path.map(p => p[3] || 0)),
    shots: ev.filter(e => e.type === 'shot').map(e => e.shot),
    peak,
  };
}

function axisDiagnosis(rec) {
  const ok = [];
  for (const axisMode of ['spec', 'ios']) for (const flipH of [false, true]) for (const flipV of [false, true]) {
    const r = summarize(TDT.replay(rec, { axisMode, flipH, flipV }));
    if (EXPECT[rec.label](r).every(([, pass]) => pass)) ok.push(`${axisMode}${flipH ? '+flipH' : ''}${flipV ? '+flipV' : ''}`);
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
    `  shots ${sum.shots.length} (${sum.shots.map(s => s.grade[0]).join('') || '-'})  alarms ${sum.alarmsMove}  180s ${sum.b180} (max ${sum.maxDev.toFixed(0)}°)`);

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

  if (rec.label === 'axis-up' || rec.label === 'axis-right') {
    const ok = axisDiagnosis(rec);
    console.log(`  INFO  mappings that read this correctly: ${ok.join(', ') || 'none'}`);
    const dev = (rec.device && rec.device.ua) || 'unknown';
    (byDevice[dev] = byDevice[dev] || []).push({ label: rec.label, ok, ios: rec.device && rec.device.ios });
  }
}

for (const [ua, list] of Object.entries(byDevice)) {
  const labels = new Set(list.map(x => x.label));
  if (labels.size < 2) continue;
  const common = list.map(x => new Set(x.ok)).reduce((a, b) => new Set([...a].filter(v => b.has(v))));
  console.log(`\nAxis verdict for ${ua.slice(0, 80)}: ${[...common].join(', ') || 'no single mapping fits both'}`);
}

console.log(failures ? `\n${failures} failed` : `\nall passed (${files.length} recordings)`);
process.exit(failures ? 1 : 0);
