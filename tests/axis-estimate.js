// Offline gyro-axis estimator harness (docs/PROPOSAL_2026-10-20.md section 3). Not part of `npm test`.
//
// For every recording under tests/recordings/ it estimates which device axis each rotationRate
// component (alpha, beta, gamma) describes, and with which sign, using gravity as the reference:
// for a vector fixed in the world, its device-frame coordinates obey dg/dt = -w x g.
// The search covers all 48 candidates (6 permutations x 8 sign combinations).
//
// Estimators:
//   E-1  derivative fit (baseline): residual of dg/dt + w x g over samples with a large |dg/dt|
//   E-2  window integration: integrate w over ~0.5 s windows (quaternion step copied from engine.js
//        motion()), rotate the window's initial g, compare with the measured g at the window end
//   E-3  correlation matrix between the gyro components and u = -(g x dg/dt)/|g|^2 (= w perpendicular to g)
//
// Gravity: low-passed accelerationIncludingGravity (`lp`, default) or the browser's own split,
// accelerationIncludingGravity - acceleration (`fused`); both are run unless --gravity= picks one.
// Synthetic recordings carry no gravity. For them the harness builds gravity from the generator's
// documented axis order (spec) and a fixed hand-held pose, so they act as a sign-convention control.
// The harness never reads a recording's settings.axisMode.
//
// Usage: node tests/axis-estimate.js [--gravity=both|lp|fused] [file-or-dir ...]
const fs = require('fs');
const path = require('path');
const TDT = require('../engine.js');

const args = process.argv.slice(2);
const gravArg = (args.find(a => a.startsWith('--gravity=')) || '--gravity=both').split('=')[1];
const roots = args.filter(a => !a.startsWith('--'));
if (!roots.length) roots.push(path.join(__dirname, 'recordings'));
const GRAVS = gravArg === 'both' ? ['lp', 'fused'] : [gravArg];

// ---- parameters ------------------------------------------------------------------------------
const D2R = Math.PI / 180;
const MAX_DT_S = 0.1;           // engine.js K.MAX_DT_S
const GAP_S = 0.1;              // a larger sample gap breaks derivatives and windows
const LP_HALF_S = 0.05;         // `lp` gravity: centred moving average of +-50 ms
const MOVING_DPS = 10;          // |w| above this counts as "motion" (decision timing, E-3 samples)
const E1_MIN_DG = 0.15;         // E-1: |d(unit g)/dt| threshold, rad/s (~9 deg/s of tilt)
const E2_WIN_S = 0.5, E2_STEP_S = 0.25, E2_MIN_ROT_DEG = 5;
const MARGIN_OK = 1.5, DECIDE_OK_S = 3;

// ---- candidates ------------------------------------------------------------------------------
// A candidate maps raw [a, b, g] to device [wx, wy, wz]: w[j] = sign[j] * raw[perm[j]].
const RAW = ['a', 'b', 'g'];
const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
const CANDS = [];
for (const perm of PERMS) for (let s = 0; s < 8; s++) {
  const sign = [s & 1 ? -1 : 1, s & 2 ? -1 : 1, s & 4 ? -1 : 1];
  CANDS.push({ perm, sign, name: candName(perm, sign) });
}
function candName(perm, sign) {
  const p = perm.join(''), plus = sign.every(v => v > 0);
  if (plus && p === '012') return 'xyz';      // engine axisMode 'ios'
  if (plus && p === '120') return 'spec';     // engine axisMode 'spec'
  return perm.map((r, j) => (sign[j] > 0 ? '+' : '-') + RAW[r]).join('');
}
const applyCand = (c, raw) => [c.sign[0] * raw[c.perm[0]], c.sign[1] * raw[c.perm[1]], c.sign[2] * raw[c.perm[2]]];

// ---- vector / quaternion helpers -----------------------------------------------------------
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const norm = v => Math.hypot(v[0], v[1], v[2]);
const unit = v => { const n = norm(v) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
const sub = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];

// Copied from engine.js motion() (180 rule): body-rate step, q maps device frame -> reference frame.
function qStep(q, wx, wy, wz, dt) {
  const ox = wx * D2R * dt, oy = wy * D2R * dt, oz = wz * D2R * dt;
  const th = Math.hypot(ox, oy, oz);
  if (!(th > 0)) return q;
  const sn = Math.sin(th / 2) / th, c = Math.cos(th / 2);
  const [w, x, y, z] = q, dx = ox * sn, dy = oy * sn, dz = oz * sn;
  const nq = [w * c - x * dx - y * dy - z * dz, w * dx + x * c + y * dz - z * dy,
              w * dy - x * dz + y * c + z * dx, w * dz + x * dy - y * dx + z * c];
  const n = Math.hypot(nq[0], nq[1], nq[2], nq[3]);
  return nq.map(v => v / n);
}
// Reference-frame vector v expressed in the device frame: R(q)^T v.
function toDevice(q, v) {
  const [w, x, y, z] = q;
  const R = [
    [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
  ];
  return [0, 1, 2].map(j => R[0][j] * v[0] + R[1][j] * v[1] + R[2][j] * v[2]);
}

// ---- loading ---------------------------------------------------------------------------------
const files = [];
const walk = p => {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) fs.readdirSync(p).sort().forEach(f => walk(path.join(p, f)));
  else if (p.endsWith('.json') || p.endsWith('.txt')) files.push(p);
};
roots.forEach(walk);

// Motion samples: {t (s), raw [a,b,g] deg/s, gi (accelerationIncludingGravity), acc, angle}
function samplesOf(rec) {
  return rec.log.filter(r => r[0] === 'm').map(r => {
    const m = TDT.unpackMotion(r);
    return {
      t: m.t / 1000, raw: [m.a || 0, m.b || 0, m.g || 0], angle: m.angle,
      gi: m.gx == null ? null : [m.gx, m.gy || 0, m.gz || 0],
      acc: m.ax == null ? null : [m.ax, m.ay || 0, m.az || 0],
    };
  });
}

// Gravity reference per sample (unit vector, device frame), or null when the source is missing.
function gravityOf(S, src) {
  if (src === 'fused') {
    if (!S.every(s => s.gi && s.acc)) return null;
    return S.map(s => unit(sub(s.gi, s.acc)));
  }
  if (!S.every(s => s.gi)) return null;
  const out = [];
  let lo = 0, hi = 0, sum = [0, 0, 0];
  for (let i = 0; i < S.length; i++) {
    while (hi < S.length && S[hi].t <= S[i].t + LP_HALF_S) { for (let k = 0; k < 3; k++) sum[k] += S[hi].gi[k]; hi++; }
    while (S[lo].t < S[i].t - LP_HALF_S) { for (let k = 0; k < 3; k++) sum[k] -= S[lo].gi[k]; lo++; }
    out.push(unit(sum));
  }
  return out;
}

// Synthetic control: gravity a spec-order phone would report. Pose: landscape, screen up = device
// +x at angle 90 (-x at 270), tilted ~15 deg back and the muzzle ~5 deg up, so no axis is exactly vertical.
function syntheticGravity(S) {
  const upSign = S.length && ((S[0].angle % 360) + 360) % 360 === 270 ? -1 : 1;
  const g0 = unit([upSign * Math.cos(15 * D2R), Math.sin(5 * D2R), Math.sin(15 * D2R)]);
  const spec = CANDS.find(c => c.name === 'spec');
  let q = [1, 0, 0, 0];
  return S.map((s, i) => {
    if (i) {
      const dt = Math.max(0, Math.min(s.t - S[i - 1].t, MAX_DT_S));
      const w = applyCand(spec, S[i - 1].raw);           // rate held over the interval, as in the engine
      q = qStep(q, w[0], w[1], w[2], dt);
    }
    return toDevice(q, g0);
  });
}

// ---- estimators ------------------------------------------------------------------------------
// Each returns a list of "items" in time order: {mt (motion seconds so far), add(acc)} where acc
// is the per-candidate accumulator; plus score(acc) -> per-candidate score (lower = better) and
// margin(acc, scores).

function motionClock(S) {
  const mt = new Array(S.length).fill(0);
  for (let i = 1; i < S.length; i++) {
    const dt = Math.min(S[i].t - S[i - 1].t, MAX_DT_S);
    mt[i] = mt[i - 1] + (norm(S[i].raw) > MOVING_DPS ? dt : 0);
  }
  return mt;
}

// Central difference of unit gravity; null where the neighbours straddle a gap.
function derivs(S, G) {
  return S.map((s, i) => {
    if (i === 0 || i === S.length - 1) return null;
    const dt = S[i + 1].t - S[i - 1].t;
    if (!(dt > 0) || dt > 2 * GAP_S) return null;
    return sub(G[i + 1], G[i - 1]).map(v => v / dt);
  });
}

const E1 = {
  id: 'E-1',
  init: () => ({ res: new Float64Array(CANDS.length), den: 0, n: 0 }),
  items(S, G, D, MT) {
    const out = [];
    for (let i = 0; i < S.length; i++) {
      const dg = D[i];
      if (!dg || norm(dg) < E1_MIN_DG) continue;
      const g = G[i], rawR = S[i].raw.map(v => v * D2R);
      out.push({ mt: MT[i], add(acc) {
        acc.den += dg[0] * dg[0] + dg[1] * dg[1] + dg[2] * dg[2]; acc.n++;
        for (let c = 0; c < CANDS.length; c++) {
          const r = cross(applyCand(CANDS[c], rawR), g);
          const e0 = dg[0] + r[0], e1 = dg[1] + r[1], e2 = dg[2] + r[2];
          acc.res[c] += e0 * e0 + e1 * e1 + e2 * e2;
        }
      } });
    }
    return out;
  },
  scores: acc => Array.from(acc.res, v => (acc.den ? v / acc.den : NaN)),
  margin: (acc, sc, order) => sc[order[1]] / sc[order[0]],
};

const E2 = {
  id: 'E-2',
  init: () => ({ res: new Float64Array(CANDS.length), den: 0, n: 0 }),
  items(S, G, D, MT) {
    const out = [];
    let j = 0;
    for (let i = 0; i < S.length; ) {
      const t0 = S[i].t;
      // window [i, j]: until E2_WIN_S has elapsed; abandon it at a gap
      let ok = true, rot = 0;
      for (j = i; j + 1 < S.length && S[j].t - t0 < E2_WIN_S; j++) {
        const dt = S[j + 1].t - S[j].t;
        if (dt > GAP_S) { ok = false; break; }
        rot += norm(S[j].raw) * dt;
      }
      if (ok && S[j].t - t0 >= E2_WIN_S * 0.9 && rot >= E2_MIN_ROT_DEG) {
        const a = i, b = j, g0 = G[a], g1 = G[b];
        out.push({ mt: MT[b], add(acc) {
          const d = sub(g1, g0); acc.den += d[0] * d[0] + d[1] * d[1] + d[2] * d[2]; acc.n++;
          for (let c = 0; c < CANDS.length; c++) {
            let q = [1, 0, 0, 0];
            for (let k = a; k < b; k++) {
              const w = applyCand(CANDS[c], S[k].raw);
              q = qStep(q, w[0], w[1], w[2], Math.min(S[k + 1].t - S[k].t, MAX_DT_S));
            }
            const e = sub(toDevice(q, g0), g1);
            acc.res[c] += e[0] * e[0] + e[1] * e[1] + e[2] * e[2];
          }
        } });
      }
      // next window starts E2_STEP_S later
      let k = i + 1;
      while (k < S.length && S[k].t < t0 + E2_STEP_S) k++;
      i = k;
    }
    return out;
  },
  scores: acc => Array.from(acc.res, v => (acc.den ? v / acc.den : NaN)),
  margin: (acc, sc, order) => sc[order[1]] / sc[order[0]],
};

// E-3: C[i][j] = cosine between raw component i and u_j over moving samples. Candidate score is
// -(sum_j sign_j * C[perm_j][j]) / 3, so lower is better like the others. Margin (proposal 3.3):
// for each raw component, |dominant entry| / |next entry| in its row; the smallest over the rows.
const E3 = {
  id: 'E-3',
  init: () => ({ ru: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], rr: [0, 0, 0], uu: [0, 0, 0], n: 0 }),
  items(S, G, D, MT) {
    const out = [];
    for (let i = 0; i < S.length; i++) {
      const dg = D[i];
      if (!dg || norm(S[i].raw) < MOVING_DPS) continue;
      const u = cross(G[i], dg).map(v => -v / D2R);       // deg/s, comparable with raw
      const raw = S[i].raw;
      out.push({ mt: MT[i], add(acc) {
        acc.n++;
        for (let r = 0; r < 3; r++) {
          acc.rr[r] += raw[r] * raw[r]; acc.uu[r] += u[r] * u[r];
          for (let k = 0; k < 3; k++) acc.ru[r][k] += raw[r] * u[k];
        }
      } });
    }
    return out;
  },
  matrix: acc => acc.ru.map((row, r) => row.map((v, k) => v / (Math.sqrt(acc.rr[r] * acc.uu[k]) || 1))),
  scores(acc) {
    const C = E3.matrix(acc);
    return CANDS.map(c => -(c.sign[0] * C[c.perm[0]][0] + c.sign[1] * C[c.perm[1]][1] + c.sign[2] * C[c.perm[2]][2]) / 3);
  },
  margin(acc) {
    const C = E3.matrix(acc);
    return Math.min(...C.map(row => { const s = row.map(Math.abs).sort((x, y) => y - x); return s[0] / (s[1] || 1e-12); }));
  },
};

const ESTIMATORS = [E1, E2, E3];

function run(est, S, G, D, MT) {
  const items = est.items(S, G, D, MT);
  const acc = est.init();
  let winner = null, changedAt = 0;
  for (const it of items) {
    it.add(acc);
    const sc = est.scores(acc);
    let best = 0;
    for (let c = 1; c < sc.length; c++) if (sc[c] < sc[best]) best = c;
    if (best !== winner) { winner = best; changedAt = it.mt; }
  }
  if (!items.length) return { n: 0 };
  const sc = est.scores(acc);
  const order = sc.map((v, i) => i).sort((x, y) => sc[x] - sc[y]);
  const same = (x, y) => Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x));
  const tied = order.filter(c => same(sc[c], sc[order[0]])).map(c => CANDS[c].name);
  return { n: items.length, best: CANDS[order[0]], runner: CANDS[order[1]], score: sc[order[0]],
           margin: est.margin(acc, sc, order), tie: tied.length > 1, tied, decidedAt: changedAt };
}

// ---- axis-drill verdict (same method as tests/replay.js) ------------------------------------
function replaySummary(rec, ov) {
  const res = TDT.replay(rec, ov);
  const p0 = res.path.length ? res.path[0] : [0, 0, 0];
  let peak = { h: 0, v: 0 }, best = -1;
  for (const [, h, v] of res.path) { const m = Math.hypot(h - p0[1], v - p0[2]); if (m > best) { best = m; peak = { h: h - p0[1], v: v - p0[2] }; } }
  const ev = res.events;
  return { armed: ev.filter(e => e.type === 'armed').length, alarms: ev.filter(e => e.type === 'alarmStart').length,
           alarmsMove: ev.filter(e => e.type === 'alarmStart' && e.reason === 'move').length,
           b180: ev.filter(e => e.type === 'alarmStart' && e.reason === '180').length,
           finalAlarm: res.state.alarmActive, maxDev: Math.max(0, ...res.path.map(p => p[3] || 0)),
           shots: ev.filter(e => e.type === 'shot').map(e => e.shot), peak };
}
function drillFits(rec) {
  const EXPECT = require('./expectations.js');
  const ok = [];
  for (const axisMode of ['spec', 'ios']) for (const flipH of [false, true]) for (const flipV of [false, true]) {
    const r = replaySummary(rec, { axisMode, flipH, flipV });
    if (EXPECT[rec.label](r).every(([, pass]) => pass)) ok.push({ axisMode, flipH, flipV });
  }
  return ok;
}
// Does a candidate agree with an engine mapping? The drills fix the permutation and the signs of
// wx (flipH) and wz (flipV); the sign of wy is not observable in the trace, so it is not compared.
function agrees(c, m) {
  const perm = m.axisMode === 'ios' ? '012' : '120';
  return c.perm.join('') === perm && c.sign[0] === (m.flipH ? -1 : 1) && c.sign[2] === (m.flipV ? -1 : 1);
}
const mapName = m => `${m.axisMode === 'ios' ? 'xyz' : 'spec'}${m.flipH ? '+flipH' : ''}${m.flipV ? '+flipV' : ''}`;

// ---- main ------------------------------------------------------------------------------------
const t0 = Date.now();
const recs = [];
for (const f of files) {
  let rec;
  try { rec = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log(`SKIP  ${path.relative(process.cwd(), f)}: unreadable JSON`); continue; }
  if (rec.format !== 'tdt-recording') continue;
  recs.push({ f, rel: path.relative(process.cwd(), f).replace(/\\/g, '/'), rec, ua: (rec.device && rec.device.ua) || 'unknown' });
}

// Verdict per device: mappings that fit both axis drills.
const verdict = {};
const byUa = {};
for (const r of recs) if (r.rec.label === 'axis-up' || r.rec.label === 'axis-right') (byUa[r.ua] = byUa[r.ua] || []).push(r);
for (const [ua, list] of Object.entries(byUa)) {
  if (new Set(list.map(r => r.rec.label)).size < 2) continue;
  const fits = list.map(r => drillFits(r.rec).map(mapName));
  const common = fits.reduce((a, b) => a.filter(v => b.includes(v)));
  verdict[ua] = common;
}
const parseMap = s => ({ axisMode: s.startsWith('xyz') ? 'ios' : 'spec', flipH: s.includes('flipH'), flipV: s.includes('flipV') });

const summary = {};   // key `${grav} ${est}` -> stats
const pad = (s, n) => String(s).padEnd(n);
console.log('Gyro axis estimates (48 candidates). margin: E-1/E-2 runner-up/best residual, E-3 weakest row ratio.');
console.log('decided: seconds of motion (|w| > 10 deg/s) when the running winner last changed / total motion.');
for (const grav of GRAVS) {
  console.log(`\n=== gravity source: ${grav}${grav === 'lp' ? ' (accelerationIncludingGravity, +-50 ms moving average)' : ' (accelerationIncludingGravity - acceleration)'} ===`);
  for (const r of recs) {
    const { rec } = r;
    const S = samplesOf(rec);
    const dur = rec.t1 && rec.t0 ? (rec.t1 - rec.t0) / 1000 : (S.length ? S[S.length - 1].t - S[0].t : 0);
    let G = gravityOf(S, grav), gNote = '';
    if (!G && rec.synthetic) { G = syntheticGravity(S); gNote = ' (gravity simulated, spec order)'; }
    console.log(`\n${r.rel}  [${rec.label}${rec.synthetic ? ', synthetic' : ''}] ${dur.toFixed(1)} s, ${S.length} samples${gNote}`);
    if (!G || S.length < 3) { console.log('  SKIP  no gravity reference in this recording'); continue; }
    const D = derivs(S, G), MT = motionClock(S);
    const v = verdict[r.ua];
    for (const est of ESTIMATORS) {
      const res = run(est, S, G, D, MT);
      const key = `${grav} ${est.id}`;
      const st = summary[key] = summary[key] || { real: [], synth: [] };
      if (!res.n) { console.log(`  ${est.id}  no usable motion`); (rec.synthetic ? st.synth : st.real).push({ rel: r.rel, rec, dur, res }); continue; }
      const agree = !v ? 'no axis-drill verdict'
        : !v.length ? 'axis drills fit no mapping'
        : res.tie ? 'unresolved (tie)'
        : v.some(m => agrees(res.best, parseMap(m))) ? `agrees with drills (${v.join(', ')})` : `DISAGREES with drills (${v.join(', ')})`;
      const best = res.tie ? `tie of ${res.tied.length}${res.tied.includes(rec.synthetic ? 'spec' : 'xyz') ? (rec.synthetic ? ' incl spec' : ' incl xyz') : ''}` : res.best.name;
      const mg = (res.margin > 999 ? '>999' : res.margin.toFixed(2)).padStart(6);
      console.log(`  ${est.id}  ${pad(best, 16)} margin ${mg}` +
        `  runner-up ${pad(res.runner.name, 8)}  decided ${res.decidedAt.toFixed(1).padStart(5)} / ${MT[MT.length - 1].toFixed(1).padStart(5)} s` +
        `  n=${pad(res.n, 5)} ${agree}`);
      (rec.synthetic ? st.synth : st.real).push({ rel: r.rel, rec, dur, res, agree });
    }
  }
}

// ---- acceptance summary (proposal 3.5; WQ-004) ----------------------------------------------
console.log('\n=== acceptance summary ===');
for (const [key, st] of Object.entries(summary)) {
  const real5 = st.real.filter(x => x.dur > 5);
  const realOk = real5.filter(x => x.res.n && !x.res.tie && x.res.best.name === 'xyz').length;
  const synOk = st.synth.filter(x => x.res.n && !x.res.tie && x.res.best.name === 'spec').length;
  const synTied = st.synth.filter(x => x.res.n && x.res.tie && x.res.tied.includes('spec')).length;
  const synBeaten = st.synth.filter(x => x.res.n && !x.res.tied.includes('spec')).length;
  const synNone = st.synth.filter(x => !x.res.n).length;
  const margins = real5.filter(x => x.res.n).map(x => x.res.margin);
  const minM = margins.length ? Math.min(...margins) : NaN;
  const timed = st.real.filter(x => /^(180-|press-wobble)/.test(x.rec.label) && x.res.n);
  const slow = timed.filter(x => x.res.decidedAt > DECIDE_OK_S);
  const dis = st.real.filter(x => x.agree && x.agree.startsWith('DISAGREES')).length;
  console.log(`${key}: real > 5 s ranking xyz first ${realOk}/${real5.length}; synthetic spec first ${synOk}, tied first ${synTied}, beaten ${synBeaten}, no motion ${synNone} (of ${st.synth.length}); ` +
    `drill disagreements ${dis}; min real margin ${minM.toFixed(2)} (>= ${MARGIN_OK}: ${minM >= MARGIN_OK ? 'met' : 'not met'}); ` +
    `decision within ${DECIDE_OK_S} s on 180-*/press-wobble ${timed.length - slow.length}/${timed.length} (${slow.length ? 'not met' : 'met'})`);
}
console.log(`\n${recs.length} recordings, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
