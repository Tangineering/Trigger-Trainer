# How the trainer works

This is the contributor's version of the "Architecture" part of `CLAUDE.md`, the project's operating manual. Where
the two differ, `CLAUDE.md` is the source of truth. Decisions are referenced as "D-nn"; look them up in
`docs/DECISIONS.md`.

## Two files, one rule

The trainer is static files served as-is: no build step, no framework, no runtime dependencies.

- **`engine.js`** holds every decision: when the finger counts as on the frame, when the trigger breaks, when an
  alarm starts and stops, how a shot is graded, how a drill advances. It never touches the DOM, `window` or
  `performance.now()`. It loads in the browser as the global `TDT` and in Node through `require`.
- **`index.html`** holds the markup, CSS and wiring. It turns browser events (`devicemotion`, touches, the mouse)
  into engine inputs, and engine events into sound, vibration and pixels.

Every engine input carries its own timestamp. That is the point of the split (see DECISIONS.md D-17): a session
recorded on a phone is a list of timestamped inputs, and feeding the same list into a fresh engine in Node gives
exactly the same events. So real phone recordings become regression tests, and a change to the logic can be checked
against every phone session ever recorded. If a change alters the events for the same inputs, bump `VERSION` in
`engine.js` and add a `CHANGELOG.md` section (D-20).

## Files served

Besides `index.html` and `engine.js`, the site serves `manifest.webmanifest` (home-screen install, landscape,
fullscreen), `icon.svg` (the source icon) and the PNG icons rendered from it by `scripts/render-icons.js`:
`icon-180.png`, `icon-192.png`, `icon-512.png` and `icon-maskable-512.png`. Nothing else is fetched; no data leaves
the phone.

## The engine's contract

`createEngine(S, {onEvent})` takes the full settings object (`DEFAULTS` merged with the user's changes) and returns:

| Call | Input |
|---|---|
| `motion(m)` | one motion sample: rotation rates, acceleration, gravity, screen angle, time `t` |
| `touches(t, list, vw, vh)` | the full current touch list in CSS px and the viewport size |
| `tick(t)` | one animation frame; runs the state machine |
| `setPaused(p, t)` | pause (settings open, page hidden, portrait held) or resume |
| `setDownrange(t)` | the student tapped **Set downrange** |
| `startDrill(t, id, seed)`, `cancelDrill(t)` | start or drop a timed drill |
| `resetStats()` | clear the session totals |

`state` is the live state object, read by the page for drawing and never written by it. Events reach `onEvent`:
`armed`, `ok`, `alarmStart` (with `reason` `move` or `180`), `alarmStop`, `trigOn`, `trigOff`, `shot`, `reset`,
`downrange`, `downrangeLost`, and for drills `drillBeep`, `drillCue`, `drillEnd`, `drillCancel`. The engine starts
paused. `summarize(state)` gives the session totals for the summary screen.

The page side: `onMotion`, `onTouch` and `onMouse` convert browser events with `TDT.fromDeviceMotion` and
`TDT.fromTouch` (which round the values exactly as a recording stores them) and feed the engine; the page's
`tick()` runs once per animation frame; `onEvent` plays the sounds (`Snd`) and updates the screen.
`window.__tdt()` is a read-only snapshot for the browser tests.

## The state machine

Not armed → finger on the frame → **safe** (OK tone) → finger lifts → **off frame**. From there either the finger
goes to the trigger → **on trigger** → pull → **shot** → trigger reset or lift → … → back on the frame (OK tone), or
the phone moves past the rate threshold once the grace period after leaving the frame has passed → **alarm**, which
holds until the finger is back on the frame.

The details that matter when changing it:

- **Frame contact is debounced** (`K.REST_LOSS_DEBOUNCE_MS`), so a brief flicker of the finger does not count as a lift.
- **During a press** (pull past 15 % until 500 ms after the break) one short jerk is graded, not alarmed; movement
  that adds up past `jerkMs` alarms (D-34, D-47). A finger resting on the trigger without pulling counts as off the
  frame (D-24).
- **Off-frame drift:** the orientation when the finger left the frame is kept; a muzzle drift past `offFrameDeg`
  from it alarms however slowly it happened. Twist about the barrel is ignored (D-56).
- **180 rule:** after **Set downrange**, the muzzle pointing more than `limit180Deg` from downrange sounds a separate
  alarm in any state, finger on the frame or not (D-26, D-31). The orientation is integrated from the gyro, so it
  drifts slowly; a long gap in the motion data clears downrange.
- **Trigger wins** (D-75): a touch that engaged the trigger stays the trigger touch until lifted, even inside the
  frame strip. **One finger** (D-113, D-115): only one touch controls the engine (`resolveControl()`); a second
  finger is ignored until it lifts.
- Opening settings or the summary, hiding the page, or holding the phone in portrait for 3 s pauses and disarms.

## Zones and axes

`ZONES` gives the screen areas as fractions of the viewport for a right-handed layout (muzzle at the right edge);
left-handed mirrors x. Only `rest` (the frame strip) and `trigger` take touches; the rest are drawing only.
`zoneFor(name, vw)` adds a fixed pixel offset (`K.TRIGGER_FWD_PX`) to the trigger and the guard's front edge; both the
engine's hit test and the page's `rectFor()` use it, so touch and pixels agree (D-72). Pull distance is CSS px
(`pullPx`, about 9–10 mm by default).

Gyro axis order: the spec maps `rotationRate` alpha/beta/gamma to the device z/x/y axes, but every phone measured
(iPhone 15, Pixel 11, Galaxy S20+) delivers x/y/z order. `axisMode: 'auto'` therefore means x/y/z on every platform
(D-52); `spec` is a manual override. The alarm uses the rate magnitude and does not depend on the order; the aim
trace direction and the 180 orientation do. The engine also estimates the order from gravity (`state.axisEst`), for
the debug readout only.

## Recordings are tests

Settings → **Record test data** records one labelled drill as JSON: the settings, the device, and a log of rows
(`m` motion, `t` touches, `p` pause, `f` frame, `d` set downrange, `r` drill start, `x` drill cancel) plus the events
the page observed. `replay(rec, overrides)` runs a recording through a fresh engine. `tests/replay.js` replays every
file in `tests/recordings/`, checks the label's expectations in `tests/expectations.js`, and for recordings made
with the current `VERSION` requires the replayed events to equal the observed ones. How to record and the file
format: `docs/RECORDINGS.md`.

`npm test` runs `tests/replay.js`, `tests/smoke.js` (the page in a headless browser with simulated touch and motion)
and `tests/roundtrip.js` (record in the page, replay in Node, require identical events). Synthetic baseline
recordings come from `tests/make-synthetic.js`. Sensor and touch changes still need a real iPhone and a real
Android phone: the tests prove the state machine, not the sensors.

## Adding a drill

A drill touches both files:

1. **`engine.js`: `DRILL_DEFS`.** One entry per drill: the start-beep delay range and either `shots` (a single
   timed string, like Bill and Transitions) or `reps` with `shotsPerRep`, `cueHoldMs`, `cue` and `next` (a per-rep
   drill, like Low Ready and Box). `startDrill` rejects an unknown id or one with `ready: false`. The run advances in
   `tickDrill()` (end of each `tick`) and `drillShot()` (from each shot); delays come from `mulberry32(seed)`, so a
   recorded run replays to the same beep times. A new kind of behaviour goes into those two functions, guarded by a
   field of its def, so the other drills and every existing recording replay unchanged.
2. **`index.html`.** Add the picker entry to `DRILL_MODES` (with its diagram in `DRILL_SVG`), the status line text
   in `drillLineText()`, the results rows in `showDrillResult()` (the per-drill helpers are `lowReadyRows`,
   `boxRows` and `transitionsRows`), the sounds in `onEvent`, and a recorder label in `DRILLS`.
3. **Tests.** An expectation for the new label in `tests/expectations.js`, a synthetic recording in
   `tests/make-synthetic.js`, a smoke section, and real phone recordings once it runs on a phone.

A new drill is a scope change: it needs a decision from Ricky in `docs/DECISIONS.md` first.
