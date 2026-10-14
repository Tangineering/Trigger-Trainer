# Trigger Discipline Trainer — Operating Manual

A phone-based teaching aid for Ricky Tan's (Tangineering) pistol classes. The phone stands in for the
side of a pistol: the student keeps the index finger flat on the frame while moving, and only goes to the
trigger when the "gun" is still. Free, no accounts, no tracking, no money — ever.

**Ricky owns scope and decisions.** Record anything you decide or propose in `docs/DECISIONS.md` using the
attribution scheme there. Questions that block work go in `OPEN_QUESTIONS.md`.

## Hard constraints (do not change without a logged Ricky decision)

1. **Static files, no build step.** `index.html` (markup, CSS, UI wiring) and `engine.js` (all logic, no DOM)
   are served as-is. No framework, no bundler, no runtime dependencies, no CDN scripts. Other companions:
   `manifest.webmanifest`, `icon.svg`. (Was "one file"; relaxed by D-17, pending Ricky's ratification.)
2. **Free static hosting** (GitHub Pages). It must work by opening a URL. HTTPS is required for motion
   sensors on iOS.
3. **No data leaves the phone.** No analytics, no network calls, no cookies. Settings live in
   `localStorage` (wrapped in try/catch; the page must work without it).
4. **Works on iPhone Safari and Android Chrome.** iPhone haptics and true finger-flatness detection are
   explicitly *not* required (Ricky, 2026-10-14). Degrade gracefully when a capability is missing.
5. **Not a firearm product.** It's a dry, phone-only drill aid. Keep imagery generic (no brand or model
   likenesses).

## Behavior spec (as stated by Ricky)

- Screen = side of the handgun. Index finger pressed flat on the screen (frame strip) = **safe**; the phone
  may move freely.
- Phone moves while the trigger finger is off the frame → **alarm** plays, and keeps playing until the
  finger is back flat on the frame.
- A **trigger** near the rear of the screen: press with the fingertip, pull backwards → **shot** signal
  (vibration on Android; click + flash on iPhone). The phone must stay steady during the press.
- Finger back flat on the frame → **OK tone**, and movement is allowed again without the alarm.
- Layout (D-21): wide grip at the rear, thin slide, frame strip and trigger high; the shot movement
  indicator sits in the empty area under the muzzle.

Additions made in the prototype (Claude, proposed — see DECISIONS): aim-drift trace and shot grading on a
mini target, trigger reset for follow-up shots, handedness mirror, grace period, settings panel, axis-check
tool, debug readout, mouse fallback for laptop demos.

## Architecture

**The rule:** every decision lives in `engine.js`, and every engine input carries its own timestamp.
`index.html` only turns browser events into engine inputs and engine events into sound, vibration and
pixels. That's what makes recordings replay exactly. Never read `performance.now()`, `window`, or the DOM
inside the engine.

### `engine.js` (works in the browser as `TDT`, and in Node via `require`)

| Piece | What it does |
|---|---|
| `VERSION` | Bump when outputs change for the same inputs (D-20). |
| `DEFAULTS`, `ZONES`, `K` | Settings defaults; normalized zones for a **right-handed** layout (muzzle at x=1, left-handed mirrors x); timing constants. Only `rest` and `trigger` zones are touch-sensitive. |
| `createEngine(S, {ios, onEvent})` | Returns `{motion, touches, tick, setPaused, resetStats, state}`. Emits `armed`, `ok`, `alarmStart`, `alarmStop`, `trigOn`, `trigOff`, `shot`, `reset`. Starts paused. |
| `motion(m)` | Rotation-rate magnitude and linear accel (EMA ~80 ms) for the alarm; integrates muzzle pitch/yaw (`aimH`, `aimV`, deg) for the trace. Axis mapping per `axisMode`. |
| `touches(t, list, vw, vh)` | Full current touch list in CSS px; drives the trigger (engage on entering the zone, fire at `pullPx` rearward, re-arm at `RESET_FRACTION`). |
| `tick(t)` | State machine: debounced frame contact → armed / safe / off-frame / alarm; trace capture. |
| `fromDeviceMotion`, `fromTouch`, `pack*`, `replay(rec, overrides)` | Capture-time rounding, the recording row format, and deterministic replay (`docs/RECORDINGS.md`). |

### `index.html`

| Piece | What it does |
|---|---|
| `S` | Settings, persisted under `localStorage['tdt.settings.v1']`. Bump the key if the schema changes incompatibly. |
| `Snd` | Web Audio: `ok()`, `shot()`, `startAlarm()/stopAlarm()`. Created/resumed inside the Start tap (iOS unlock). Sets `navigator.audioSession.type='playback'` where available (iOS 17+ silent switch). |
| `onMotion` / `onTouch` / `onMouse` | Convert events with `TDT.fromDeviceMotion` / `fromTouch`, feed the engine, and log the same row if recording. |
| `tick` (rAF) | Pauses the engine when not running / settings open / portrait / hidden, logs a frame row, calls `engine.tick`, renders. |
| `onEvent` | Engine events → sound, vibration, flash, alarm overlay; appended to `rec.observed` while recording. |
| Recorder | `startRecording()` makes a fresh engine; `stopRecording(share)`; `saveRecording()` uses the share sheet when it accepts files, else a download. |
| Settings overlay | Built from `SLIDERS`; includes live sensor readout, axis-check canvas, and the recorder. |
| `window.__tdt()` | Read-only snapshot used by the browser tests. Keep it. |

### State machine
`not armed` → (finger on frame) → `SAFE` (OK tone) → (finger lifts) → `OFF FRAME`
→ either `ON TRIGGER` → `SHOT` → (reset / lift) … → back to `SAFE` (OK tone),
or (motion > threshold after `graceMs`) → `ALARM` (latched) → (finger on frame) → `SAFE` (OK tone).
Opening settings, backgrounding the page, or rotating to portrait disarms and silences.

## Known platform facts and unknowns

- **Contact size:** Android Chrome usually reports `Touch.radiusX/Y`; iOS Safari usually doesn't. The
  flat-finger check is opt-in and auto-skips when size isn't reported.
- **Vibration:** `navigator.vibrate` doesn't exist on iOS Safari. Don't build hacks for it (not required).
- **Gyro axis order:** the spec maps `rotationRate` alpha/beta/gamma to z/x/y. Some iOS builds have been
  reported to deliver x/y/z order instead. `axisMode: 'auto'` assumes iOS-style on iOS. **Unverified on
  hardware** — first thing to check (OPEN_QUESTIONS Q1). The alarm uses magnitude, so it's unaffected; only
  the trace direction and the "low-left" style labels depend on this. Resolve it from `axis-up` and
  `axis-right` recordings: `npm run test:replay` prints the mapping that fits both for each phone.
- **Orientation:** sign of yaw uses `screen.orientation.angle` (or `window.orientation` on iOS): 90 vs 270.
  iOS can't lock orientation from a web page; Android tries fullscreen + `orientation.lock('landscape')`.
- **Units:** pull distance is CSS px (~160 px per inch on most phones, so 35 px ≈ 5–6 mm). Drift is degrees
  of muzzle angle (1° ≈ 6.3" at 10 yd).

## Working rules

- Test on a real iPhone and a real Android phone before calling any sensor or touch change done. Synthetic
  tests prove the state machine, not the sensors.
- Real phone recordings in `tests/recordings/` are the ground truth. Before changing thresholds or logic,
  run `npm run test:replay` and say which recordings change outcome. Don't edit a recording to make it pass;
  re-record it or change the code.
- `npm test` runs all three suites: `tests/replay.js` (Node, every recording), `tests/smoke.js` (browser
  state machine with simulated touch + `DeviceMotionEvent`), `tests/roundtrip.js` (records in the page,
  replays in Node, requires identical events). Run it after every engine or input-wiring change.
- Bump `engine.js` `VERSION` when outputs change; don't bump it for refactors that keep replays identical.
- Don't add features that need a server, accounts, or an app store.
- Keep defaults conservative for beginners; Ricky tunes them in class via Settings.
- Commit messages: imperative, short; one logical change per commit.

## Layout of this repo

```
index.html              UI, audio, input wiring, recorder
engine.js               all trainer logic + record/replay helpers (no DOM)
manifest.webmanifest    home-screen install (landscape, fullscreen)
icon.svg
tests/replay.js         replays every recording; expectations + live==replay + axis diagnosis
tests/expectations.js   what each drill label must produce
tests/recordings/       real phone recordings (one folder per phone) + synthetic/ baseline
tests/make-synthetic.js generates tests/recordings/synthetic/
tests/smoke.js          browser state-machine test
tests/roundtrip.js      browser record → Node replay equality test
docs/RECORDINGS.md      how to record drills; recording file format
package.json            dev-only: playwright for tests
docs/DECISIONS.md       decision log with attribution
docs/CLASS_USE.md       how to run it in a class (student-facing steps)
OPEN_QUESTIONS.md       blocking/pending questions for Ricky
README.md               short public description + deploy steps
LICENSE                 MIT (Tangineering)
```
