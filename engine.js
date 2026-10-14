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
  const VERSION = '0.3.0';

  const DEFAULTS = Object.freeze({
    hand: 'right',       // 'right' => muzzle at screen right, rear at left
    moveDps: 25,         // rotation-rate alarm threshold, deg/s
    moveAcc: 1.5,        // linear-acceleration alarm threshold, m/s^2
    graceMs: 300,        // ignore motion this long after the finger leaves the frame
    pullPx: 35,          // rearward finger travel (CSS px) that breaks the shot
    steadyDeg: 0.75,     // aim-drift tolerance for a "clean" shot, deg
    requireFlat: false,  // require contact size >= minContactPx (only where reported)
    minContactPx: 40,
    volume: 0.8,
    debug: false,
    axisMode: 'auto',    // 'auto' | 'spec' | 'ios'
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
    STALE_MOTION_MS: 250,        // sensor stream stalled: drop smoothed motion to zero
    EMA_TAU_S: 0.08,             // motion smoothing time constant
    MAX_DT_S: 0.1,
    TRACE_MAX: 1500,
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

  /**
   * @param S     settings object (read live; the page may mutate it between sessions)
   * @param opts  { ios: bool, onEvent: fn({type, t, ...}) }
   * Events: armed, ok, alarmStart, alarmStop, trigOn, trigOff, shot, reset
   */
  function createEngine(S, opts) {
    opts = opts || {};
    const ios = !!opts.ios;
    const emit = typeof opts.onEvent === 'function' ? opts.onEvent : () => {};
    const st = {
      rotEMA: 0, linEMA: 0, rotNow: 0, linNow: 0, aimH: 0, aimV: 0,
      lastMotionT: 0, motionEvents: 0,
      sizeSupported: false, lastRestSize: 0, restContact: false,
      paused: true, armed: false, onRest: false, wasOnRest: false, restLostAt: null, offSince: 0,
      trigOffAt: -Infinity,
      alarmActive: false, violations: 0,
      trig: null, lastTrace: null, shots: [],
      touches: new Map(),
    };
    let grav = null, vw = 1, vh = 1;

    const axisMode = () => (S.axisMode === 'auto' ? (ios ? 'ios' : 'spec') : S.axisMode);

    /** m = {t, a, b, g, ax, ay, az, gx, gy, gz, angle}; a/b/g = rotationRate alpha/beta/gamma (deg/s) */
    function motion(m) {
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
    }

    /** list = [{id, cx, cy, rx, ry}] in CSS px; w/h = viewport */
    function touches(t, list, w, h) {
      if (w) vw = w; if (h) vh = h;
      st.touches.clear();
      for (const p of list) {
        let x = p.cx / vw;
        if (S.hand === 'left') x = 1 - x;
        st.touches.set(p.id, { x, y: p.cy / vh, cx: p.cx, size: 2 * Math.max(p.rx || 0, p.ry || 0) });
      }
      if (!st.paused) updateTrigger(t);
    }

    function restTouch() {
      let best = null;
      for (const tc of st.touches.values()) {
        if (!inZone(tc, ZONES.rest)) continue;
        if (tc.size > 2) { st.sizeSupported = true; st.lastRestSize = tc.size; }
        if (S.requireFlat && st.sizeSupported && tc.size < S.minContactPx) continue;
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
                        oh: st.aimH, ov: st.aimV, trace: [] };
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
        st.trig = Object.assign({}, tr, { fired: false, breakT: 0, breakIdx: -1, oh: st.aimH, ov: st.aimV, trace: [] });
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
      if (st.shots.length > 200) st.shots.shift();
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

      if (!st.armed) {
        if (st.onRest) { st.armed = true; emit({ type: 'armed', t }); }
      } else {
        if (st.onRest && !st.wasOnRest) {
          if (st.alarmActive) { st.alarmActive = false; emit({ type: 'alarmStop', t }); }
          emit({ type: 'ok', t });
        }
        // No new alarm while the finger is on the trigger (a hard jerk is graded, not alarmed),
        // and the same grace period applies after leaving the trigger as after leaving the frame.
        if (!st.onRest && !st.alarmActive && !st.trig) {
          const moving = st.rotEMA > S.moveDps || st.linEMA > S.moveAcc;
          if (moving && t - st.offSince > S.graceMs && t - st.trigOffAt > S.graceMs) {
            st.alarmActive = true; st.violations++;
            emit({ type: 'alarmStart', t, rot: st.rotEMA, lin: st.linEMA });
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
      if (p) {
        if (st.alarmActive) { st.alarmActive = false; emit({ type: 'alarmStop', t }); }
        st.armed = false; st.onRest = st.wasOnRest = false; st.restLostAt = null; st.restContact = false;
        if (st.trig) endTrigger(t);
      } else if (st.touches.size) {
        updateTrigger(t);
      }
    }

    function resetStats() { st.shots = []; st.violations = 0; st.lastTrace = null; }

    return { motion, touches, tick, setPaused, resetStats, state: st, version: VERSION };
  }

  /* ---------- record / replay helpers ---------- */
  // Log rows (in the order they happened):
  //   ['m', t, a, b, g, ax, ay, az, gx, gy, gz, angle]   motion sample
  //   ['t', t, vw, vh, [[id, cx, cy, rx, ry], ...]]       full touch list after a touch event
  //   ['p', t, 0|1]                                       engine paused (1) / resumed (0)
  //   ['f', t]                                            animation-frame tick
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
    if (e.type === 'alarmStart') return [e.t, 'alarmStart', r4(e.rot), r4(e.lin)];
    return [e.t, e.type];
  }

  /** Replay a recording through a fresh engine. overrides: settings to change (e.g. axisMode). */
  function replay(rec, overrides) {
    const S = Object.assign({}, DEFAULTS, rec.settings || {}, overrides || {});
    const events = [], path = [];
    const eng = createEngine(S, { ios: !!(rec.device && rec.device.ios), onEvent: e => events.push(e) });
    for (const row of rec.log) {
      switch (row[0]) {
        case 'm': eng.motion(unpackMotion(row)); break;
        case 't': eng.touches(row[1], unpackTouchList(row[4]), row[2], row[3]); break;
        case 'p': eng.setPaused(!!row[2], row[1]); break;
        case 'f': eng.tick(row[1]); path.push([row[1], eng.state.aimH, eng.state.aimV]); break;
      }
    }
    return { S, events, packed: events.map(packEvent), path, state: eng.state };
  }

  return {
    VERSION, DEFAULTS, ZONES, K, inZone, gradeShot, createEngine,
    rt, r2, r4, fromDeviceMotion, fromTouch, packMotion, unpackMotion, packTouches, unpackTouchList, packEvent, replay,
  };
});
