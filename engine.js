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
  const VERSION = '0.9.0';

  const DEFAULTS = Object.freeze({
    hand: 'right',       // 'right' => muzzle at screen right, rear at left
    moveDps: 25,         // rotation-rate alarm threshold, deg/s
    moveAcc: 1.5,        // linear-acceleration alarm threshold, m/s^2
    graceMs: 300,        // ignore motion this long after the finger leaves the frame
    jerkMs: 300,         // during a press, total movement longer than this alarms (one short jerk doesn't); D-47
    rule180: true,       // alarm when the muzzle points more than limit180Deg from downrange
    limit180Deg: 90,
    pullPx: 35,          // rearward finger travel (CSS px) that breaks the shot
    steadyDeg: 0.75,     // aim-drift tolerance for a "clean" shot, deg
    volume: 0.8,
    debug: false,
    axisMode: 'auto',    // 'auto' (= 'ios', x/y/z order) | 'spec' | 'ios'
    flipH: false,
    flipV: false,
  });

  // Fractions of the viewport for a RIGHT-handed layout (muzzle at x=1). Left-handed mirrors x.
  // Only 'rest' and 'trigger' are touch-sensitive; the rest are drawing only.
  const ZONES = Object.freeze({
    slide:   { x: .02, y: .03, w: .96, h: .21 },
    frame:   { x: .23, y: .26, w: .75, h: .26 },
    grip:    { x: .00, y: .26, w: .24, h: .74 },
    guard:   { x: .26, y: .51, w: .30, h: .38 },
    rest:    { x: .38, y: .28, w: .58, h: .22 },
    trigger: { x: .28, y: .53, w: .22, h: .30 },
    target:  { x: .58, y: .55, w: .40, h: .43 },   // shot movement indicator, under the muzzle
    debug:   { x: .01, y: .30, w: .22, h: .66 },   // drawn over the grip (grip ignores touches)
  });

  const K = Object.freeze({
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
    HYST_180_DEG: 5,
    ORIENT_GAP_MS: 1000,         // motion data gap this long (page hidden, sensor stall) invalidates downrange             // a 180 alarm can clear only once the muzzle is this far back inside the limit
  });

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

  /* ---------- session totals (never trimmed, unlike st.shots) ---------- */
  const newTally = () => ({ shots: 0, Clean: 0, Moved: 0, Jerked: 0, unsafe: 0, devSum: 0, devN: 0, best: null, dirs: {} });
  function addToTally(ty, shot) {
    ty.shots++; ty[shot.grade]++;
    if (shot.unsafe) ty.unsafe++;
    if (shot.motion) {
      ty.devSum += shot.dev; ty.devN++;
      if (ty.best === null || shot.dev < ty.best) ty.best = shot.dev;
    }
    if (shot.dir) ty.dirs[shot.dir] = (ty.dirs[shot.dir] || 0) + 1;
  }

  /** Session summary from engine state. Pure; reads only st.tally / counters. */
  function summarize(st) {
    const ty = st.tally;
    const dirs = Object.entries(ty.dirs).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    return {
      shots: ty.shots, clean: ty.Clean, moved: ty.Moved, jerked: ty.Jerked,
      cleanPct: ty.shots ? Math.round(100 * ty.Clean / ty.shots) : null,
      unsafeShots: ty.unsafe,
      avgDev: ty.devN ? ty.devSum / ty.devN : null, bestDev: ty.best,
      commonMiss: dirs.length ? { dir: dirs[0][0], n: dirs[0][1] } : null,
      moveAlarms: st.violations, breaks180: st.breaks180,
    };
  }

  /**
   * @param S     settings object (read live; the page may mutate it between sessions)
   * @param opts  { onEvent: fn({type, t, ...}) }
   * Events: armed, ok, alarmStart {reason: 'move'|'180'}, alarmStop, trigOn, trigOff, shot, reset,
   *         downrange (set by the user), downrangeLost (orientation tracking interrupted)
   */
  function createEngine(S, opts) {
    opts = opts || {};
    const emit = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
    const st = {
      rotEMA: 0, linEMA: 0, rotNow: 0, linNow: 0, aimH: 0, aimV: 0,
      lastMotionT: 0, motionEvents: 0,
      restContact: false,
      paused: true, armed: false, onRest: false, wasOnRest: false, restLostAt: null, offSince: 0,
      trigOffAt: -Infinity, inPress: false, pressEndAt: -Infinity, movingSince: null, lastTickT: null,
      alarmActive: false, alarmReason: null, violations: 0, breaks180: 0,
      // Orientation since downrange was set (quaternion w,x,y,z, device frame → reference frame).
      q: [1, 0, 0, 0], dev180: 0, refSet: false,    // 180 check is off until setDownrange()
      trig: null, lastTrace: null, shots: [], tally: newTally(),
      touches: new Map(),
    };
    let grav = null, vw = 1, vh = 1;

    // 'auto' = x/y/z rotationRate order on every platform (the only order real recordings fit; D-52).
    const axisMode = () => (S.axisMode === 'auto' ? 'ios' : S.axisMode);

    /** m = {t, a, b, g, ax, ay, az, gx, gy, gz, angle}; a/b/g = rotationRate alpha/beta/gamma (deg/s) */
    function motion(m) {
      if (st.refSet && st.lastMotionT && m.t - st.lastMotionT > K.ORIENT_GAP_MS) {
        st.refSet = false; st.dev180 = 0;            // orientation since downrange is unknown; must set it again
        emit({ type: 'downrangeLost', t: m.t });
      }
      const dt = st.lastMotionT ? Math.max(0, Math.min((m.t - st.lastMotionT) / 1000, K.MAX_DT_S)) : 0;
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
      const D2R = Math.PI / 180, ox = wx * D2R * dt, oy = wy * D2R * dt, oz = wz * D2R * dt;
      const th = Math.hypot(ox, oy, oz);
      if (th > 0) {
        const sn = Math.sin(th / 2) / th, c = Math.cos(th / 2);
        const [w, x, y, z] = st.q, dx = ox * sn, dy = oy * sn, dz = oz * sn;
        const nq = [w * c - x * dx - y * dy - z * dz, w * dx + x * c + y * dz - z * dy,
                    w * dy - x * dz + y * c + z * dx, w * dz + x * dy - y * dx + z * c];
        const n = Math.hypot(nq[0], nq[1], nq[2], nq[3]);
        st.q = nq.map(v => v / n);
      }
    }

    function deviation180() {
      const [, x, , z] = st.q;
      return Math.acos(Math.max(-1, Math.min(1, 1 - 2 * (x * x + z * z)))) * 180 / Math.PI;
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

    function restTouch() {
      let best = null;
      for (const tc of st.touches.values()) {
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
          if (inZone(tc, ZONES.trigger)) {
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
    }

    function tick(t) {
      if (st.paused) return;
      if (st.lastMotionT && t - st.lastMotionT > K.STALE_MOTION_MS) { st.rotEMA = 0; st.linEMA = 0; }

      const rest = restTouch();
      st.restContact = !!rest;
      if (rest) { st.restLostAt = null; st.onRest = true; }
      else if (st.onRest) {
        if (st.restLostAt == null) st.restLostAt = t;
        if (t - st.restLostAt > K.REST_LOSS_DEBOUNCE_MS) { st.onRest = false; st.offSince = st.restLostAt; }
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
      if (!st.armed) {
        if (st.onRest) { st.armed = true; emit({ type: 'armed', t }); }
      } else {
        if (S.rule180 && st.refSet && st.dev180 > S.limit180Deg && st.alarmReason !== '180') {
          st.alarmActive = true; st.alarmReason = '180'; st.breaks180++;     // also escalates a movement alarm
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
        if (!st.onRest && !st.alarmActive) {
          let alarm;
          if (st.inPress) alarm = st.trig.moveMs > S.jerkMs;
          else alarm = moving && t - st.offSince > S.graceMs && t - st.pressEndAt > S.graceMs && t - st.trigOffAt > S.graceMs
                       && (!st.trig || t - st.movingSince > K.ON_TRIGGER_CONFIRM_MS);
          if (alarm) {
            st.alarmActive = true; st.alarmReason = 'move'; st.violations++;
            emit({ type: 'alarmStart', t, reason: 'move', rot: st.rotEMA, lin: st.linEMA, dev: st.dev180 });
          }
        }
      }
      st.wasOnRest = st.onRest;

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
        if (st.trig) endTrigger(t);
      } else if (st.touches.size) {
        updateTrigger(t);
      }
    }

    /** The user pressed Set downrange: wherever the muzzle points now is downrange. */
    function setDownrange(t) {
      st.q = [1, 0, 0, 0]; st.refSet = true; st.dev180 = 0;
      emit({ type: 'downrange', t });
    }

    function resetStats() { st.shots = []; st.violations = 0; st.breaks180 = 0; st.lastTrace = null; st.tally = newTally(); }

    return { motion, touches, tick, setPaused, setDownrange, resetStats, state: st, version: VERSION };
  }

  /* ---------- record / replay helpers ---------- */
  // Log rows (in the order they happened):
  //   ['m', t, a, b, g, ax, ay, az, gx, gy, gz, angle]   motion sample
  //   ['t', t, vw, vh, [[id, cx, cy, rx, ry], ...]]       full touch list after a touch event
  //   ['p', t, 0|1]                                       engine paused (1) / resumed (0)
  //   ['f', t]                                            animation-frame tick
  //   ['d', t]                                            Set downrange pressed
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
        case 'f': eng.tick(row[1]); path.push([row[1], eng.state.aimH, eng.state.aimV, eng.state.dev180]); break;
      }
    }
    return { S, events, packed: events.map(packEvent), path, state: eng.state };
  }

  return {
    VERSION, DEFAULTS, ZONES, K, inZone, gradeShot, createEngine, summarize,
    rt, r2, r4, fromDeviceMotion, fromTouch, packMotion, unpackMotion, packTouches, unpackTouchList, packEvent, replay,
  };
});
