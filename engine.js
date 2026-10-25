/*
 * Trigger Discipline Trainer — core engine.
 * No DOM access. Shared by index.html (browser global `TDT`) and the Node tests (require).
 * Every input carries its own timestamp, so a recorded session replays deterministically.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TDT = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Bump when a change alters engine outputs for the same inputs. Recordings store this;
  // replay.js only demands live == replay for recordings made with the current version.
  const VERSION = '0.15.0';

  const DEFAULTS = Object.freeze({
    hand: 'right',       // 'right' => muzzle at screen right, rear at left
    moveDps: 25,         // rotation-rate alarm threshold, deg/s
    moveAcc: 1.5,        // linear-acceleration alarm threshold, m/s^2
    graceMs: 300,        // ignore motion this long after the finger leaves the frame
    offFrameDeg: 5,      // off the frame, muzzle drift (deg, roll ignored) past this from where it pointed
                         // when the finger left alarms, however slow; D-56, 5° (D-81)
    jerkMs: 300,         // during a press, total movement longer than this alarms (one short jerk doesn't); D-47
    rule180: true,       // alarm when the muzzle points more than limit180Deg from downrange
    limit180Deg: 90,
    pullPx: 60,          // rearward finger travel (CSS px) that breaks the shot (D-71)
    steadyDeg: 0.75,     // aim-drift tolerance for a "clean" shot, deg
    volume: 0.8,
    debug: false,
    axisMode: 'auto',    // 'auto' (= 'ios', x/y/z order) | 'spec' | 'ios'
    flipH: false,
    flipV: false,
  });

  // Fractions of the viewport for a RIGHT-handed layout (muzzle at x=1). Left-handed mirrors x.
  // Only 'rest' and 'trigger' are touch-sensitive; the rest are drawing only.
  // 'trigger' and 'guard' also take a fixed pixel offset toward the muzzle: use zoneFor(name, vw) (D-71, D-72).
  const ZONES = Object.freeze({
    slide:   { x: .02, y: .03, w: .96, h: .21 },
    frame:   { x: .23, y: .26, w: .75, h: .304 },
    grip:    { x: .00, y: .26, w: .24, h: .74 },
    guard:   { x: .24, y: .554, w: .32, h: .38 },   // rear end joins the grip's front edge; front edge + TRIGGER_FWD_PX
    rest:    { x: .31, y: .28, w: .65, h: .264 },
    trigger: { x: .28, y: .574, w: .28, h: .30 },  // + TRIGGER_FWD_PX; front edge = guard's front edge (D-87)
    target:  { x: .60, y: .55, w: .38, h: .43 },   // shot movement indicator, under the muzzle; clear of the guard (D-74)
    debug:   { x: .01, y: .30, w: .22, h: .66 },   // drawn over the grip (grip ignores touches)
  });

  const K = Object.freeze({
    TRIGGER_FWD_PX: 40,          // trigger zone (and the guard's front edge) sit this many CSS px toward the muzzle (D-72, D-82)
    REST_LOSS_DEBOUNCE_MS: 60,   // contact flicker tolerance on the frame strip
    RESET_FRACTION: 0.5,         // trigger re-arms after returning forward to this fraction of travel
    FOLLOW_THROUGH_MS: 350,      // keep tracing aim this long after the break
    PULL_START_FRACTION: 0.15,   // a press starts once the trigger is pulled this fraction of pullPx
    PRESS_AFTER_BREAK_MS: 500,   // a press ends this long after the break
    ON_TRIGGER_CONFIRM_MS: 150,  // finger on trigger, not pulling: movement must last this long to alarm
                                 // (a slap moves the phone and the finger together; let the pull register)
    STALE_MOTION_MS: 250,        // sensor stream stalled: drop smoothed motion to zero
    EMA_TAU_S: 0.08,             // motion smoothing time constant
    MAX_DT_S: 0.1,
    TRACE_MAX: 1500,
    HYST_180_DEG: 5,             // a 180 alarm can clear only once the muzzle is this far back inside the limit
    ORIENT_GAP_MS: 1000,         // motion data gap this long (page hidden, sensor stall) invalidates downrange
    ORIENT_BRIDGE_MS: 300,       // longest motion gap bridged in the 180 orientation (mean of the rates before and
                                 // after); longer gaps are credited 300 ms, and gaps over ORIENT_GAP_MS clear downrange
    DRILL_BEEP_HOLD_MS: 350,     // a drill start beep waits until the finger has been on the frame this long, so it
                                 // never overlaps the OK tone (D-98 g, D-104)
  });

  /** Zone `name` in right-handed viewport fractions for a viewport `vw` CSS px wide, with the fixed
   *  pixel offsets applied: the trigger moves TRIGGER_FWD_PX toward the muzzle, and the guard's
   *  front edge moves with it (its rear end stays at the grip). Used by the engine's hit test and
   *  by index.html's drawing, so touch and pixels match. */
  function zoneFor(name, vw) {
    const z = ZONES[name], d = vw > 1 ? K.TRIGGER_FWD_PX / vw : 0;
    if (name === 'trigger') return { x: z.x + d, y: z.y, w: z.w, h: z.h };
    if (name === 'guard') return { x: z.x, y: z.y, w: z.w + d, h: z.h };
    return z;
  }
  const inZone = (p, z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h;
  const norm360 = a => ((a % 360) + 360) % 360;
  const rnd = (x, q) => (x == null || !isFinite(x)) ? null : Math.round(x * q) / q;
  const rt = t => rnd(t, 1000);   // timestamps: 1 µs
  const r4 = x => rnd(x, 1e4);    // sensor values
  const r2 = x => rnd(x, 100);    // touch coordinates

  function gradeShot(h, v, tol) {
    const dev = Math.hypot(h, v);
    const grade = dev <= tol ? 'Clean' : dev <= 2.5 * tol ? 'Moved' : 'Jerked';
    let dir = '';
    if (dev > tol) {
      const vv = v < -0.4 * dev ? 'low' : v > 0.4 * dev ? 'high' : '';
      const hh = h < -0.4 * dev ? 'left' : h > 0.4 * dev ? 'right' : '';
      dir = [vv, hh].filter(Boolean).join('-');
    }
    return { dev, grade, dir };
  }

  /* ---------- drills (D-93, D-97, D-98) ---------- */
  // Deterministic generator for drill delays (D-98 h): the page passes a seed when a run starts (row 'r'),
  // so a recording replays to the same beep times. mulberry32: 32-bit state, returns [0, 1).
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // delayMs: random start-beep delay [lo, hi] once the finger is on the frame (D-98 a). A def with ready: false
  // would be rejected by startDrill().
  // Per-rep drills (a def with `reps`): `reps` reps of at least `shotsPerRep` shots; the cue (or, after the last rep,
  // the end) comes `cueHoldMs` after the finger is back on the frame. `cue` names the drillCue; `next` says what
  // follows it: 'standby' (Low Ready, D-96: the next rep's beep is delayMs after the cue) or 'live' (Box Drill, D-95:
  // the next position is live at once, no beep). In Box data a "rep" is a shooting position.
  const DRILL_DEFS = Object.freeze({
    bill:     Object.freeze({ delayMs: Object.freeze([1000, 4000]), shots: 6, ready: true }),
    lowready: Object.freeze({ delayMs: Object.freeze([2000, 5000]), reps: 5, shotsPerRep: 2, cueHoldMs: 750,
                              cue: 'lowready', next: 'standby', ready: true }),
    box:      Object.freeze({ delayMs: Object.freeze([1000, 4000]), reps: 5, shotsPerRep: 2, cueHoldMs: 0,
                              cue: 'move', next: 'live', ready: true }),
  });
  // A run a pause or cancel interrupts: live, finishing, or standby once the delay has started (D-102).
  const drillActive = d => !!d && (d.phase === 'live' || d.phase === 'finishing' || (d.phase === 'standby' && d.dueAt != null));

  /* ---------- session totals (never trimmed, unlike st.shots) ---------- */
  // D-45: shots fired during an alarm count in `shots`, `unsafe` and `dirs` only; the grade counts
  // and the movement stats (devSum, devN, best) cover shots fired with no alarm.
  const newTally = () => ({ shots: 0, Clean: 0, Moved: 0, Jerked: 0, unsafe: 0, devSum: 0, devN: 0, best: null, dirs: {} });
  function addToTally(ty, shot) {
    ty.shots++;
    if (shot.dir) ty.dirs[shot.dir] = (ty.dirs[shot.dir] || 0) + 1;
    if (shot.unsafe) { ty.unsafe++; return; }
    ty[shot.grade]++;
    if (shot.motion) {
      ty.devSum += shot.dev; ty.devN++;
      if (ty.best === null || shot.dev < ty.best) ty.best = shot.dev;
    }
  }

  /**
   * Session summary from engine state. Pure; reads only st.tally / counters.
   * `shots` and `unsafeShots` count every shot; `graded` (shots with no alarm, D-45) is the base for
   * clean/moved/jerked, cleanPct, avgDev and bestDev. cleanPct is null when `graded` is 0.
   */
  function summarize(st) {
    const ty = st.tally;
    const graded = ty.shots - ty.unsafe;
    const dirs = Object.entries(ty.dirs).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    return {
      shots: ty.shots, graded, clean: ty.Clean, moved: ty.Moved, jerked: ty.Jerked,
      cleanPct: graded ? Math.round(100 * ty.Clean / graded) : null,
      unsafeShots: ty.unsafe,
      avgDev: ty.devN ? ty.devSum / ty.devN : null, bestDev: ty.best,
      commonMiss: dirs.length ? { dir: dirs[0][0], n: dirs[0][1] } : null,
      moveAlarms: st.violations, breaks180: st.breaks180,
    };
  }

  /* ---------- run-time gyro-axis estimate (advisory, D-57) ---------- */
  // Port of estimator E-2 with fused gravity from tests/axis-estimate.js (docs/PROPOSAL_2026-10-20.md
  // section 3): for each 0.5 s window (a new one every 0.25 s) integrate the raw rotationRate under all
  // 48 axis candidates (6 permutations x 8 sign combinations), rotate the window's first gravity vector
  // (accelerationIncludingGravity - acceleration) and compare it with the measured one at the window end.
  // The candidate with the smallest residual sum is the estimate. It reads raw alpha/beta/gamma only,
  // never axisMode, and emits no events: it changes no engine output.
  const AXIS_EST = Object.freeze({ WIN_S: 0.5, STEP_S: 0.25, GAP_S: 0.1, MIN_ROT_DEG: 5, MOVING_DPS: 10 });
  const AXIS_CANDS = (() => {
    const RAW = ['a', 'b', 'g'], out = [];
    for (const perm of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) for (let s = 0; s < 8; s++) {
      const sign = [s & 1 ? -1 : 1, s & 2 ? -1 : 1, s & 4 ? -1 : 1];
      const p = perm.join(''), plus = sign.every(v => v > 0);
      const name = plus && p === '012' ? 'xyz' : plus && p === '120' ? 'spec'
        : perm.map((r, j) => (sign[j] > 0 ? '+' : '-') + RAW[r]).join('');
      out.push({ perm, sign, name });
    }
    return out;
  })();

  /** Streaming E-2 estimator. add(m) takes an engine motion input; result is null until a window counts. */
  function createAxisEstimator() {
    const D2R = Math.PI / 180, W = AXIS_EST;
    let buf, startT, res, motionS, windows, lastT, result;
    function reset() {
      buf = []; startT = -Infinity; res = new Float64Array(AXIS_CANDS.length);
      motionS = 0; windows = 0; lastT = null; result = null;
    }
    reset();

    // One window [0, j] of buf: integrate each candidate's rates, rotate g0, compare with g1.
    function score(j) {
      const g0 = buf[0].g, g1 = buf[j].g;
      for (let c = 0; c < AXIS_CANDS.length; c++) {
        const { perm, sign } = AXIS_CANDS[c];
        let w = 1, x = 0, y = 0, z = 0;
        for (let k = 0; k < j; k++) {
          const r = buf[k].raw, dt = Math.min(buf[k + 1].t - buf[k].t, K.MAX_DT_S);
          const ox = sign[0] * r[perm[0]] * D2R * dt, oy = sign[1] * r[perm[1]] * D2R * dt, oz = sign[2] * r[perm[2]] * D2R * dt;
          const th = Math.hypot(ox, oy, oz);
          if (!(th > 0)) continue;
          const sn = Math.sin(th / 2) / th, cs = Math.cos(th / 2), dx = ox * sn, dy = oy * sn, dz = oz * sn;
          const nw = w * cs - x * dx - y * dy - z * dz, nx = w * dx + x * cs + y * dz - z * dy,
                ny = w * dy - x * dz + y * cs + z * dx, nz = w * dz + x * dy - y * dx + z * cs;
          const n = Math.hypot(nw, nx, ny, nz);
          w = nw / n; x = nx / n; y = ny / n; z = nz / n;
        }
        // g0 (reference frame) expressed in the device frame at the window end: R(q)^T g0.
        const R = [[1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
                   [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
                   [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)]];
        let e2 = 0;
        for (let i = 0; i < 3; i++) {
          const e = R[0][i] * g0[0] + R[1][i] * g0[1] + R[2][i] * g0[2] - g1[i];
          e2 += e * e;
        }
        res[c] += e2;
      }
      windows++;
      let best = 0, run = -1;
      for (let c = 1; c < res.length; c++) if (res[c] < res[best]) best = c;
      for (let c = 0; c < res.length; c++) if (c !== best && (run < 0 || res[c] < res[run])) run = c;
      result = { cand: AXIS_CANDS[best].name, margin: res[best] > 0 ? res[run] / res[best] : (res[run] > 0 ? Infinity : 1),
                 motionS, windows };
    }

    function add(m) {
      const t = m.t / 1000, raw = [m.a || 0, m.b || 0, m.g || 0];
      if (lastT != null && Math.hypot(raw[0], raw[1], raw[2]) > W.MOVING_DPS) motionS += Math.min(t - lastT, K.MAX_DT_S);
      lastT = t;
      if (result) result.motionS = motionS;
      let g = null;
      if (m.ax != null && m.gx != null) {
        const v = [m.gx - m.ax, (m.gy || 0) - (m.ay || 0), (m.gz || 0) - (m.az || 0)], n = Math.hypot(v[0], v[1], v[2]) || 1;
        g = [v[0] / n, v[1] / n, v[2] / n];
      }
      if (t >= startT) buf.push({ t, raw, g });
      // Resolve every window that the buffered samples decide; buf[0] is the next window's first sample.
      for (;;) {
        if (!buf.length) break;
        const t0 = buf[0].t;
        let j = 0, ok = true, rot = 0;
        for (; j + 1 < buf.length && buf[j].t - t0 < W.WIN_S; j++) {
          const dt = buf[j + 1].t - buf[j].t;
          if (dt > W.GAP_S) { ok = false; break; }
          rot += Math.hypot(buf[j].raw[0], buf[j].raw[1], buf[j].raw[2]) * dt;
        }
        if (ok && buf[j].t - t0 < W.WIN_S) break;              // window still open: wait for more samples
        if (ok && rot >= W.MIN_ROT_DEG && buf.slice(0, j + 1).every(s => s.g)) score(j);
        startT = t0 + W.STEP_S;                                // next window starts 0.25 s later
        let k = 1;
        while (k < buf.length && buf[k].t < startT) k++;
        buf = buf.slice(k);
      }
      return result;
    }

    return { add, reset, get result() { return result; } };
  }

  /**
   * @param S     settings object (read live; the page may mutate it between sessions)
   * @param opts  { onEvent: fn({type, t, ...}) }
   * Events: armed, ok, alarmStart {reason: 'move'|'180', devOff on 'move'}, alarmStop, trigOn, trigOff, shot, reset,
   *         downrange (set by the user), downrangeLost (orientation tracking interrupted),
   *         drillBeep {drill, rep} (start beep), drillCue {drill, cue, rep} (cue 'lowready': back to low ready after rep;
   *         cue 'move': Box Drill, move to the next spot after position rep),
   *         drillEnd {drill, result} (run complete), drillCancel {drill}
   */
  function createEngine(S, opts) {
    opts = opts || {};
    const emit = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
    const st = {
      rotEMA: 0, linEMA: 0, rotNow: 0, linNow: 0, aimH: 0, aimV: 0,
      lastMotionT: 0, motionEvents: 0,
      restContact: false,
      paused: true, armed: false, onRest: false, wasOnRest: false, restLostAt: null, offSince: 0,
      restSinceT: null,                            // when the finger last came onto the frame (drill beep hold, D-104)
      trigOffAt: -Infinity, inPress: false, pressEndAt: -Infinity, movingSince: null, lastTickT: null,
      alarmActive: false, alarmReason: null, violations: 0, breaks180: 0,
      // Orientation since downrange was set (quaternion w,x,y,z, device frame → reference frame).
      q: [1, 0, 0, 0], dev180: 0, refSet: false,    // 180 check is off until setDownrange()
      prevW: null,                                 // previous body-frame rates [wx, wy, wz] (deg/s) for the gap bridge
      qOff: null, devOff: 0,                       // orientation when the finger left the frame; drift from it (deg, D-56)
      trig: null, lastTrace: null, shots: [], tally: newTally(),
      touches: new Map(),
      axisEst: null,                               // advisory gyro-axis estimate {cand, margin, motionS, windows} (D-57)
      drill: null,                                 // current drill run (null = Freestyle); see startDrill()
      drillRuns: [],                               // results of the runs finished this session (resetStats clears)
    };
    let grav = null, vw = 1, vh = 1;
    const axisEstimator = createAxisEstimator();

    // 'auto' = x/y/z rotationRate order on every platform (the only order real recordings fit; D-52).
    const axisMode = () => (S.axisMode === 'auto' ? 'ios' : S.axisMode);

    /** m = {t, a, b, g, ax, ay, az, gx, gy, gz, angle}; a/b/g = rotationRate alpha/beta/gamma (deg/s) */
    function motion(m) {
      if (st.refSet && st.lastMotionT && m.t - st.lastMotionT > K.ORIENT_GAP_MS) {
        st.refSet = false; st.dev180 = 0; st.prevW = null;   // orientation since downrange is unknown; must set it again
        emit({ type: 'downrangeLost', t: m.t });
      }
      // A long gap restarts the advisory axis estimate too (D-57); it never feeds back into the engine.
      if (st.lastMotionT && m.t - st.lastMotionT > K.ORIENT_GAP_MS) axisEstimator.reset();
      st.axisEst = axisEstimator.add(m);
      // Rotation during a long gap is unknown: restart the off-frame drift reference after this step (D-56).
      const reOff = !!st.qOff && st.lastMotionT > 0 && m.t - st.lastMotionT > K.ORIENT_GAP_MS;
      const gapS = st.lastMotionT ? Math.max(0, (m.t - st.lastMotionT) / 1000) : 0;
      const dt = Math.min(gapS, K.MAX_DT_S);           // rate EMA and aim trace
      st.lastMotionT = m.t; st.motionEvents++;

      const a = m.a || 0, b = m.b || 0, g = m.g || 0;
      // Device axes: x = short edge (portrait right), y = long edge (portrait up), z = out of screen.
      // Spec: alpha about z, beta about x, gamma about y. Some iOS builds report x, y, z order instead.
      let wx, wy, wz;
      if (axisMode() === 'ios') { wx = a; wy = b; wz = g; } else { wx = b; wy = g; wz = a; }
      st.rotNow = Math.hypot(wx, wy, wz);

      let lin = 0;
      if (m.ax != null) {
        lin = Math.hypot(m.ax, m.ay || 0, m.az || 0);
      } else if (m.gx != null) {
        if (!grav) grav = { x: m.gx, y: m.gy, z: m.gz };
        grav.x += (m.gx - grav.x) * 0.1; grav.y += (m.gy - grav.y) * 0.1; grav.z += (m.gz - grav.z) * 0.1;
        lin = Math.hypot(m.gx - grav.x, m.gy - grav.y, m.gz - grav.z);
      }
      st.linNow = lin;
      const k = dt > 0 ? 1 - Math.exp(-dt / K.EMA_TAU_S) : 1;
      st.rotEMA += (st.rotNow - st.rotEMA) * k;
      st.linEMA += (lin - st.linEMA) * k;

      // Muzzle = screen-right (RH) or screen-left (LH); screen normal points to the shooter's side.
      // Screen-up is device +x at orientation angle 90 and device -x at 270.
      const upSign = norm360(m.angle == null ? 90 : m.angle) === 270 ? -1 : 1;
      let pitchUp = wz * (S.hand === 'left' ? -1 : 1);
      let yawRight = -wx * upSign;
      if (S.flipV) pitchUp = -pitchUp;
      if (S.flipH) yawRight = -yawRight;
      st.aimH += yawRight * dt;
      st.aimV += pitchUp * dt;

      // 180 rule: integrate full 3-D orientation (body-frame rates). In landscape the muzzle lies
      // along device ±y for either hand and either landscape direction, and the angle between two
      // vectors doesn't depend on sign, so deviation = angle between R·ŷ and ŷ. Roll (canting,
      // rotation about the muzzle axis) correctly leaves it unchanged.
      // Each step integrates the mean of the previous and current rates over the raw gap (capped at
      // ORIENT_BRIDGE_MS), so a sensor stall (iOS stops devicemotion ~100-120 ms at a portrait flip) is
      // bridged instead of losing rotation. No previous rates (first sample, after setDownrange): no step.
      const pw = st.prevW, dtQ = pw ? Math.min(gapS, K.ORIENT_BRIDGE_MS / 1000) : 0;
      const mx = pw ? (pw[0] + wx) / 2 : wx, my = pw ? (pw[1] + wy) / 2 : wy, mz = pw ? (pw[2] + wz) / 2 : wz;
      st.prevW = [wx, wy, wz];
      const D2R = Math.PI / 180, ox = mx * D2R * dtQ, oy = my * D2R * dtQ, oz = mz * D2R * dtQ;
      const th = Math.hypot(ox, oy, oz);
      if (th > 0) {
        const sn = Math.sin(th / 2) / th, c = Math.cos(th / 2);
        const [w, x, y, z] = st.q, dx = ox * sn, dy = oy * sn, dz = oz * sn;
        const nq = [w * c - x * dx - y * dy - z * dz, w * dx + x * c + y * dz - z * dy,
                    w * dy - x * dz + y * c + z * dx, w * dz + x * dy - y * dx + z * c];
        const n = Math.hypot(nq[0], nq[1], nq[2], nq[3]);
        st.q = nq.map(v => v / n);
      }
      if (reOff) st.qOff = st.q.slice();
    }

    // Angle between R·ŷ and ŷ for a unit quaternion (roll about the muzzle axis ŷ leaves it unchanged).
    function muzzleAngle(q) {
      const x = q[1], z = q[3];
      return Math.acos(Math.max(-1, Math.min(1, 1 - 2 * (x * x + z * z)))) * 180 / Math.PI;
    }

    function deviation180() { return muzzleAngle(st.q); }

    /** Muzzle angle (deg, roll ignored) between orientation qRef and now: qRel = conj(qRef) · st.q. */
    function deviationFrom(qRef) {
      const [aw, ax, ay, az] = qRef, [bw, bx, by, bz] = st.q;
      return muzzleAngle([aw * bw + ax * bx + ay * by + az * bz, aw * bx - ax * bw - ay * bz + az * by,
                          aw * by + ax * bz - ay * bw - az * bx, aw * bz - ax * by + ay * bx - az * bw]);
    }

    /** list = [{id, cx, cy, rx, ry}] in CSS px; w/h = viewport */
    function touches(t, list, w, h) {
      if (w) vw = w; if (h) vh = h;
      st.touches.clear();
      for (const p of list) {
        let x = p.cx / vw;
        if (S.hand === 'left') x = 1 - x;
        st.touches.set(p.id, { x, y: p.cy / vh, cx: p.cx });
      }
      if (!st.paused) updateTrigger(t);
    }

    // D-75: the touch that engaged the trigger never counts as frame contact, wherever it moves.
    function restTouch() {
      let best = null;
      for (const [id, tc] of st.touches) {
        if (st.trig && id === st.trig.id) continue;
        if (!inZone(tc, ZONES.rest)) continue;
        best = tc;
      }
      return best;
    }

    const rearPx = tc => (S.hand === 'left' ? tc.cx : -tc.cx);   // larger = further rearward

    function updateTrigger(t) {
      if (st.trig && !st.touches.has(st.trig.id)) endTrigger(t);
      if (!st.trig) {
        for (const [id, tc] of st.touches) {
          if (inZone(tc, zoneFor('trigger', vw))) {
            st.trig = { id, base: rearPx(tc), pull: 0, fired: false, breakT: 0, breakIdx: -1,
                        oh: st.aimH, ov: st.aimV, trace: [], moveMs: 0 };
            emit({ type: 'trigOn', t });
            break;
          }
        }
      }
      const tr = st.trig;
      if (!tr) return;
      const tc = st.touches.get(tr.id);
      let pull = rearPx(tc) - tr.base;
      if (pull < 0 && !tr.fired) { tr.base = rearPx(tc); pull = 0; }   // slid forward: re-zero
      tr.pull = Math.max(0, pull);
      if (!tr.fired && pull >= S.pullPx) fire(t);
      else if (tr.fired && pull <= S.pullPx * K.RESET_FRACTION) {      // trigger reset -> follow-up
        st.lastTrace = tr;
        st.trig = Object.assign({}, tr, { fired: false, breakT: 0, breakIdx: -1, oh: st.aimH, ov: st.aimV, trace: [], moveMs: 0 });
        emit({ type: 'reset', t });
      }
    }

    function endTrigger(t) {
      if (st.trig && st.trig.trace.length) st.lastTrace = st.trig;
      st.trig = null;
      st.trigOffAt = t;
      emit({ type: 'trigOff', t });
    }

    function fire(t) {
      const tr = st.trig;
      const h = st.aimH - tr.oh, v = st.aimV - tr.ov;
      const g = gradeShot(h, v, S.steadyDeg);
      const shot = { t, h, v, dev: g.dev, grade: g.grade, dir: g.dir, unsafe: st.alarmActive, motion: st.motionEvents > 0 };
      st.shots.push(shot);
      if (st.shots.length > 200) st.shots.shift();       // drawing only; totals live in st.tally
      addToTally(st.tally, shot);
      tr.fired = true; tr.breakT = t; tr.breakIdx = tr.trace.length;
      emit({ type: 'shot', t, shot });
      if (st.drill) drillShot(t, shot);
    }

    /* Drill run (D-97, D-98). Phases: standby (waiting for the frame, then the random delay) → live (beep given,
       counting shots) → finishing (sixth shot fired, timer stopped, waiting for the finger on the frame) → ended.
       Per-rep drills loop live → finishing once per rep: finishing waits cueHoldMs with the finger on the frame,
       then emits drillCue (reps 1–4) or drillEnd (last rep). After the cue Low Ready (D-96, next: 'standby') goes
       back to standby with the next beep due delayMs after it; Box Drill (D-95, next: 'live', cue 'move') makes the
       next position live at once. */
    function drillShot(t, shot) {
      const d = st.drill;
      const def = DRILL_DEFS[d.id];
      if (d.phase === 'standby') {                        // before the beep: counted, not timed (D-98 d)
        d.early++;
        if (def.reps) d.earlyPending++;                   // per-rep: carried into the next rep's result
        return;
      }
      if (def.reps) {                                     // per-rep (Low Ready, Box): shots of the rep in progress
        if (d.phase !== 'live' && d.phase !== 'finishing') return;
        d.cur.shots.push({ t, grade: shot.grade, dev: shot.dev, unsafe: shot.unsafe });
        if (d.phase === 'live' && d.cur.shots.length >= def.shotsPerRep) d.phase = 'finishing';
        return;
      }
      if (d.phase !== 'live') return;                     // finishing / ended: an ordinary Freestyle shot
      d.shots.push({ t, grade: shot.grade, dev: shot.dev, unsafe: shot.unsafe });
      if (d.shots.length < def.shots) return;
      const ts = d.shots.map(x => x.t), splits = [];
      for (let i = 1; i < ts.length; i++) splits.push(r4(ts[i] - ts[i - 1]));
      d.result = {
        drill: d.id, seed: d.seed, beepT: d.beepT, first: r4(ts[0] - d.beepT), splits, total: r4(ts[ts.length - 1] - d.beepT),
        shots: d.shots.map(x => ({ grade: x.grade, dev: x.dev, unsafe: x.unsafe })),
        early: d.early, alarms: 0, withAlarm: false, endT: null,
      };
      d.phase = 'finishing';
    }

    function tickDrill(t) {
      const d = st.drill;
      const def = DRILL_DEFS[d.id];
      if (!st.alarmActive) { d.alarmCounted = false; d.alarmInPending = false; }   // the episode is over
      if (d.phase === 'standby') {
        // Rep 1 (and Bill): the delay starts at the first armed tick on the frame. Later Low Ready reps: the cue set it.
        if (d.dueAt == null && st.armed && st.onRest) {
          const [lo, hi] = def.delayMs;
          d.dueAt = t + lo + d.rng() * (hi - lo);
        }
        // The beep only plays with the finger on the frame: if it is off when due, at the first tick back on.
        // It also waits until the finger has been on the frame DRILL_BEEP_HOLD_MS, clear of the OK tone (D-104).
        if (d.dueAt != null && t >= d.dueAt && st.onRest && t - st.restSinceT >= K.DRILL_BEEP_HOLD_MS) {
          if (def.reps) {
            d.rep++; d.phase = 'live';
            if (d.rep === 1) d.beepT = t;
            d.cur = { rep: d.rep, startT: t, beepT: t, shots: [], early: d.earlyPending, alarms: d.alarmsPending };
            d.earlyPending = 0; d.alarmsPending = 0;
            // An alarm still sounding at the beep marks the rep; it counts into the run only once per episode, and
            // into this rep only if it is not already there from between the reps.
            if (st.alarmActive) {
              if (!d.alarmCounted) d.alarms++;
              if (!d.alarmInPending) d.cur.alarms++;
              d.alarmCounted = true;
            }
            d.alarmInPending = false;
            emit({ type: 'drillBeep', t, drill: d.id, rep: d.rep });
            return;
          }
          d.beepT = t; d.rep = 1; d.phase = 'live';
          // an alarm (180) still sounding at the beep marks the run (once per episode)
          if (st.alarmActive) { if (!d.alarmCounted) d.alarms++; d.alarmCounted = true; }
          emit({ type: 'drillBeep', t, drill: d.id, rep: 1 });
        }
      } else if (d.phase === 'finishing' && def.reps) {
        // Per-rep: cueHoldMs with the finger on the frame after at least shotsPerRep shots (D-98 b); the finger
        // leaving the frame before it ends restarts it (D-98 c). Box's cueHoldMs is 0: cueDueAt = t, so the cue
        // comes at the FIRST tick with the finger on the frame, after that tick's OK event (same t, D-95).
        if (!st.onRest) { d.cueDueAt = null; return; }
        if (d.cueDueAt == null) d.cueDueAt = t + def.cueHoldMs;
        if (t < d.cueDueAt) return;
        const c = d.cur, s = c.shots;
        const shots = s.map(x => ({ grade: x.grade, dev: x.dev, unsafe: x.unsafe }));
        if (def.next === 'live') {                        // Box: time = previous cue (or the beep) → first shot here
          const splits = [];
          for (let i = 1; i < s.length; i++) splits.push(r4(s[i].t - s[i - 1].t));
          d.reps.push({
            rep: c.rep, startT: c.startT, beepT: c.beepT, time: r4(s[0].t - c.startT), splits, shots,
            early: c.early, alarms: c.alarms, withAlarm: c.alarms > 0,
          });
        } else {
          d.reps.push({
            rep: c.rep, beepT: c.beepT, reaction: r4(s[0].t - c.beepT), split: r4(s[1].t - s[0].t), shots,
            early: c.early, alarms: c.alarms, withAlarm: c.alarms > 0,
          });
        }
        const lastShotT = s[s.length - 1].t;
        d.cur = null; d.cueDueAt = null;
        if (d.rep < def.reps) {
          emit({ type: 'drillCue', t, drill: d.id, cue: def.cue, rep: d.rep });
          if (def.next === 'live') {                      // Box: the next position is live now, no beep (D-95)
            d.rep++;
            d.cur = { rep: d.rep, startT: t, beepT: null, shots: [], early: 0, alarms: 0 };
            d.phase = 'live';
          } else {
            const [lo, hi] = def.delayMs;
            d.dueAt = t + lo + d.rng() * (hi - lo);       // Low Ready: next beep 2–5 s after the cue (D-96)
            d.phase = 'standby';
          }
          return;
        }
        let res;
        if (def.next === 'live') {                        // Box: total = beep → last shot at position 5
          res = {
            drill: d.id, seed: d.seed, beepT: d.beepT, reps: d.reps, total: r4(lastShotT - d.beepT),
            early: d.early, alarms: d.alarms, withAlarm: d.alarms > 0, endT: t,
          };
        } else {
          const clean = d.reps.filter(x => !x.withAlarm).map(x => x.reaction);
          res = {
            drill: d.id, seed: d.seed, beepT: d.reps[0].beepT, reps: d.reps, total: r4(t - d.reps[0].beepT),
            avgReaction: clean.length ? r4(clean.reduce((a, b) => a + b, 0) / clean.length) : null,
            bestReaction: clean.length ? Math.min.apply(null, clean) : null,
            early: d.early, alarms: d.alarms, withAlarm: d.alarms > 0, endT: t,
          };
        }
        d.result = res;
        d.phase = 'ended';
        st.drillRuns.push(res);
        emit({ type: 'drillEnd', t, drill: d.id, result: res });
      } else if (d.phase === 'finishing' && st.onRest) {
        const res = d.result;
        res.alarms = d.alarms; res.withAlarm = d.alarms > 0; res.endT = t;
        d.phase = 'ended';
        st.drillRuns.push(res);
        emit({ type: 'drillEnd', t, drill: d.id, result: res });
      }
    }

    // Counts alarm episodes from the beep to the end (a move alarm escalating to 180 is one episode).
    // Per-rep drills also count into the rep in progress, and (Low Ready) an episode that starts between reps (standby
    // after rep 1's beep) into the run and the next rep (carried in alarmsPending to its beep). Box has no standby
    // after the beep.
    const drillAlarm = () => {
      const d = st.drill;
      if (!d) return;
      if (d.phase === 'live' || d.phase === 'finishing') { d.alarms++; if (d.cur) d.cur.alarms++; d.alarmCounted = true; }
      else if (d.phase === 'standby' && d.rep > 0 && DRILL_DEFS[d.id].reps) {
        d.alarms++; d.alarmsPending++; d.alarmCounted = true; d.alarmInPending = true;
      }
    };

    function freshRun(d) {
      d.phase = 'standby'; d.dueAt = null; d.beepT = null; d.rep = 0; d.shots = []; d.early = 0; d.alarms = 0; d.result = null;
      d.reps = []; d.cur = null; d.cueDueAt = null; d.earlyPending = 0;   // per-rep (a cancel loses the reps, D-98 e, D-107)
      d.alarmsPending = 0; d.alarmCounted = false; d.alarmInPending = false;
      return d;
    }

    /** Start a run of drill `id` (a ready DRILL_DEFS key) with generator seed `seed`. Returns false and changes
     *  nothing for an unknown or not-yet-built drill. A run already in progress is cancelled first. */
    function startDrill(t, id, seed) {
      const def = Object.prototype.hasOwnProperty.call(DRILL_DEFS, id) ? DRILL_DEFS[id] : null;
      if (!def || !def.ready) return false;
      if (drillActive(st.drill)) emit({ type: 'drillCancel', t, drill: st.drill.id });
      st.drill = freshRun({ id, seed: seed >>> 0, rng: mulberry32(seed) });
      return true;
    }

    /** Back to Freestyle: cancel any run in progress (event) and drop the drill. */
    function cancelDrill(t) {
      if (!st.drill) return;
      if (drillActive(st.drill)) emit({ type: 'drillCancel', t, drill: st.drill.id });
      st.drill = null;
    }

    function tick(t) {
      if (st.paused) return;
      if (st.lastMotionT && t - st.lastMotionT > K.STALE_MOTION_MS) { st.rotEMA = 0; st.linEMA = 0; }

      const rest = restTouch();
      st.restContact = !!rest;
      if (rest) { if (!st.onRest) st.restSinceT = t; st.restLostAt = null; st.onRest = true; st.qOff = null; }
      else if (st.onRest) {
        if (st.restLostAt == null) st.restLostAt = t;
        if (t - st.restLostAt > K.REST_LOSS_DEBOUNCE_MS) { st.onRest = false; st.offSince = st.restLostAt; st.qOff = st.q.slice(); }
      }

      const moving = st.rotEMA > S.moveDps || st.linEMA > S.moveAcc;
      if (!moving) st.movingSince = null;
      else if (st.movingSince == null) st.movingSince = t;

      const tr0 = st.trig;
      const inPress = !!tr0 && (tr0.fired ? t - tr0.breakT <= K.PRESS_AFTER_BREAK_MS
                                          : tr0.pull >= S.pullPx * K.PULL_START_FRACTION);
      if (st.inPress && !inPress) st.pressEndAt = t;
      st.inPress = inPress;
      // Total time moving during this press (each follow-up shot starts its own count), so a wobble
      // broken into short bursts adds up instead of restarting the clock.
      const dtMs = st.lastTickT == null ? 0 : Math.max(0, Math.min(t - st.lastTickT, K.MAX_DT_S * 1000));
      st.lastTickT = t;
      if (inPress && moving) tr0.moveMs += dtMs;

      st.dev180 = st.refSet ? deviation180() : 0;     // live readout even before arming
      st.devOff = st.qOff ? deviationFrom(st.qOff) : 0;
      if (!st.armed) {
        if (st.onRest) { st.armed = true; emit({ type: 'armed', t }); }
      } else {
        if (S.rule180 && st.refSet && st.dev180 > S.limit180Deg && st.alarmReason !== '180') {
          const wasActive = st.alarmActive;
          st.alarmActive = true; st.alarmReason = '180'; st.breaks180++;     // also escalates a movement alarm
          if (!wasActive) drillAlarm();
          emit({ type: 'alarmStart', t, reason: '180', rot: st.rotEMA, lin: st.linEMA, dev: st.dev180 });
        }
        if (st.alarmActive) {
          const back = st.alarmReason !== '180' || !S.rule180 || !st.refSet || st.dev180 < S.limit180Deg - K.HYST_180_DEG;
          if (st.onRest && back) {
            st.alarmActive = false; st.alarmReason = null;
            emit({ type: 'alarmStop', t }); emit({ type: 'ok', t });
          }
        } else if (st.onRest && !st.wasOnRest) {
          emit({ type: 'ok', t });
        }
        // Off the frame, movement alarms after the grace period. A finger resting on the trigger
        // counts as off the frame. During a press (pull started → shortly after the break) one short
        // jerk is graded, not alarmed, but more than jerkMs of movement in total still alarms.
        // Grace also applies after a press ends and after the finger leaves the trigger.
        // In every off-frame state (trigger and press included) the muzzle may also drift at most
        // offFrameDeg from where it pointed when the finger left, however slowly (D-56).
        if (!st.onRest && !st.alarmActive) {
          let alarm;
          if (st.inPress) alarm = st.trig.moveMs > S.jerkMs;
          else alarm = moving && t - st.offSince > S.graceMs && t - st.pressEndAt > S.graceMs && t - st.trigOffAt > S.graceMs
                       && (!st.trig || t - st.movingSince > K.ON_TRIGGER_CONFIRM_MS);
          if (!alarm && st.qOff && st.devOff > S.offFrameDeg && t - st.offSince > S.graceMs) alarm = true;
          if (alarm) {
            st.alarmActive = true; st.alarmReason = 'move'; st.violations++;
            drillAlarm();
            emit({ type: 'alarmStart', t, reason: 'move', rot: st.rotEMA, lin: st.linEMA, dev: st.dev180, devOff: st.devOff });
          }
        }
      }
      st.wasOnRest = st.onRest;
      if (st.drill) tickDrill(t);

      const tr = st.trig;
      if (tr && (!tr.fired || t - tr.breakT < K.FOLLOW_THROUGH_MS) && tr.trace.length < K.TRACE_MAX) {
        tr.trace.push([st.aimH - tr.oh, st.aimV - tr.ov]);
      }
    }

    function setPaused(p, t) {
      p = !!p;
      if (p === st.paused) return;
      st.paused = p;
      st.lastTickT = null;
      if (p) {
        if (st.alarmActive) { st.alarmActive = false; st.alarmReason = null; emit({ type: 'alarmStop', t }); }
        st.armed = false; st.onRest = st.wasOnRest = false; st.restLostAt = null; st.restContact = false;
        st.qOff = null; st.devOff = 0;
        if (st.trig) endTrigger(t);
        // A pause cancels a run without the completion tone; the drill waits in a fresh standby (D-98 e).
        // The generator carries on, so the next run's delay is still decided by the seed.
        if (drillActive(st.drill)) {
          emit({ type: 'drillCancel', t, drill: st.drill.id });
          freshRun(st.drill);
        }
      } else if (st.touches.size) {
        updateTrigger(t);
      }
    }

    /** The user pressed Set downrange: wherever the muzzle points now is downrange. */
    function setDownrange(t) {
      st.q = [1, 0, 0, 0]; st.refSet = true; st.dev180 = 0; st.prevW = null;
      if (st.qOff) st.qOff = st.q.slice();           // st.q restarted: restart the off-frame drift reference too
      emit({ type: 'downrange', t });
    }

    function resetStats() { st.shots = []; st.violations = 0; st.breaks180 = 0; st.lastTrace = null; st.tally = newTally();
      axisEstimator.reset(); st.axisEst = null; st.drillRuns = [];
    }

    return { motion, touches, tick, setPaused, setDownrange, resetStats, startDrill, cancelDrill, state: st, version: VERSION };
  }

  /* ---------- record / replay helpers ---------- */
  // Log rows (in the order they happened):
  //   ['m', t, a, b, g, ax, ay, az, gx, gy, gz, angle]   motion sample
  //   ['t', t, vw, vh, [[id, cx, cy, rx, ry], ...]]       full touch list after a touch event
  //   ['p', t, 0|1]                                       engine paused (1) / resumed (0)
  //   ['f', t]                                            animation-frame tick
  //   ['d', t]                                            Set downrange pressed
  //   ['r', t, drill, seed]                               drill run requested (seed for the engine's generator)
  //   ['x', t]                                            drill cancelled (back to the start screen)
  function fromDeviceMotion(e, t, angle) {
    const r = e.rotationRate || {}, a = e.acceleration, g = e.accelerationIncludingGravity;
    const hasA = a && a.x != null, hasG = g && g.x != null;
    return {
      t, a: r4(r.alpha), b: r4(r.beta), g: r4(r.gamma),
      ax: hasA ? r4(a.x) : null, ay: hasA ? r4(a.y) : null, az: hasA ? r4(a.z) : null,
      gx: hasG ? r4(g.x) : null, gy: hasG ? r4(g.y) : null, gz: hasG ? r4(g.z) : null,
      angle: angle == null ? null : norm360(angle),
    };
  }
  const fromTouch = tc => ({ id: tc.identifier, cx: r2(tc.clientX), cy: r2(tc.clientY), rx: r2(tc.radiusX || 0), ry: r2(tc.radiusY || 0) });
  const packMotion = m => ['m', m.t, m.a, m.b, m.g, m.ax, m.ay, m.az, m.gx, m.gy, m.gz, m.angle];
  const unpackMotion = r => ({ t: r[1], a: r[2], b: r[3], g: r[4], ax: r[5], ay: r[6], az: r[7], gx: r[8], gy: r[9], gz: r[10], angle: r[11] });
  const packTouches = (t, list, w, h) => ['t', t, w, h, list.map(p => [p.id, p.cx, p.cy, p.rx, p.ry])];
  const unpackTouchList = rows => rows.map(r => ({ id: r[0], cx: r[1], cy: r[2], rx: r[3], ry: r[4] }));
  function packEvent(e) {
    if (e.type === 'shot') return [e.t, 'shot', e.shot.grade, r4(e.shot.dev)];
    if (e.type === 'alarmStart') return [e.t, 'alarmStart', e.reason, r4(e.rot), r4(e.lin), r4(e.dev)];
    if (e.type === 'drillBeep') return [e.t, 'drillBeep', e.rep];
    if (e.type === 'drillCue') return [e.t, 'drillCue', e.cue, e.rep];
    if (e.type === 'drillEnd') return [e.t, 'drillEnd', e.drill, r4(e.result.total)];
    return [e.t, e.type];
  }

  /** Replay a recording through a fresh engine. overrides: settings to change (e.g. axisMode). */
  function replay(rec, overrides) {
    const S = Object.assign({}, DEFAULTS, rec.settings || {}, overrides || {});
    const events = [], path = [];
    const eng = createEngine(S, { onEvent: e => events.push(e) });
    for (const row of rec.log) {
      switch (row[0]) {
        case 'm': eng.motion(unpackMotion(row)); break;
        case 't': eng.touches(row[1], unpackTouchList(row[4]), row[2], row[3]); break;
        case 'p': eng.setPaused(!!row[2], row[1]); break;
        case 'd': eng.setDownrange(row[1]); break;
        case 'r': eng.startDrill(row[1], row[2], row[3]); break;
        case 'x': eng.cancelDrill(row[1]); break;
        case 'f': eng.tick(row[1]); path.push([row[1], eng.state.aimH, eng.state.aimV, eng.state.dev180]); break;
      }
    }
    return { S, events, packed: events.map(packEvent), path, state: eng.state };
  }

  return {
    VERSION, DEFAULTS, ZONES, K, zoneFor, inZone, gradeShot, createEngine, summarize, DRILL_DEFS, mulberry32,
    rt, r2, r4, fromDeviceMotion, fromTouch, packMotion, unpackMotion, packTouches, unpackTouchList, packEvent, replay,
  };
});
