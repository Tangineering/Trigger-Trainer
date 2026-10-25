# Trigger Discipline Trainer — Operating Manual

A phone-based teaching aid for Ricky Tan's (Tangineering) pistol classes. The phone stands in for the
side of a pistol: the student keeps the index finger flat on the frame while moving, and only goes to the
trigger when the "gun" is still. Free, no accounts, no tracking, nothing sold — ever. An optional Ko-fi tip
link is the only money-related element (D-63): a plain anchor, never an embedded button or widget.

**Ricky owns scope and decisions.** Record anything you decide or propose in `docs/DECISIONS.md` using the
attribution scheme there. Questions that block work go in `OPEN_QUESTIONS.md`. Ideas for later (not
committed to) go in `docs/IDEAS.md`; never build one without a Ricky decision. The workflow is in that file.

**Outstanding work lives in `WORK_QUEUE.md`** — the central planning document: one `WQ-NNN` item per unit
of work, self-contained enough to be an execution agent's whole brief. Finished work lives in
`WORK_COMPLETED.md` (what was done, why, deviations). Add items with the `work-queue-add` skill; run rounds
with `work-queue-run`; size-L code items are implemented with `orchestrated-feature`, whose project specifics
(checks, invariants, protected paths) live in `.claude/skills/orchestrated-feature/PROJECT.md`. Which model
each dispatched agent runs on is fixed by `.claude/skills/work-queue-run/MODELS.md` (overrides, with reasons,
go in that `PROJECT.md`). Never mark an item done inside the queue — it is moved to the archive by the run
skill. Queue edits get their own `queue:` commits, never bundled into feature commits. `scripts/wq.py`
(stdlib Python; on Ricky's PC `C:\Users\ricky\.local\bin\python.exe`) does the mechanical edits.

How the queue and the other documents fit together:
- A queue item is *work*; `OPEN_QUESTIONS.md` holds the *question* behind a `blocked:user` or
  `blocked:owner-machine` item, and the item names the question (`Q-nn`). When the owner answers, the
  answer goes in `docs/DECISIONS.md` and the item is re-queued with the decision folded into its Scope.
- `docs/IDEAS.md` and the queue's parking lot overlap on purpose: an idea stays in `docs/IDEAS.md` until a
  Ricky decision promotes it, and only then becomes a queue item.
- Execution agents log anything they decide as `Claude (proposed)` rows in `docs/DECISIONS.md`.
- Hub files for parallel items (append-only, one block per item id): `CLAUDE.md`, `README.md`,
  `OPEN_QUESTIONS.md`, `docs/DECISIONS.md`, `docs/IDEAS.md`. Items that touch `engine.js` or `index.html`
  never run in parallel with each other.
- "Done" for sensor or touch changes has an owner-verifiable half (a real iPhone and a real Android phone);
  write it as the item's *Owner-verifiable* acceptance lines, and the orchestrator returns the item
  `blocked:owner-machine` for that half.

## Hard constraints (do not change without a logged Ricky decision)

1. **Static files, no build step.** `index.html` (markup, CSS, UI wiring) and `engine.js` (all logic, no DOM)
   are served as-is. No framework, no bundler, no runtime dependencies, no CDN scripts. Other companions:
   `manifest.webmanifest`, `icon.svg`. (Was "one file"; relaxed by D-17, ratified 2026-10-20.)
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
- During a trigger press (from the start of the pull until shortly after the break) a short jerk is graded,
  not alarmed; any other movement during the press alarms (D-34). A finger resting on the trigger without
  pulling counts as off the frame (D-24).
- **Off-frame drift limit** (D-56): while the finger is off the frame (on the trigger and during a press too), the
  muzzle may drift at most `offFrameDeg` (5°) from where it pointed when the finger left; twist about the barrel
  axis is ignored. A larger drift alarms however slowly it happened, and the alarm holds until the finger is back on
  the frame. The rate-based alarm and D-34's jerk allowance stay.
- **180 rule** (D-26, D-31): the student points downrange and taps **Set downrange** (bottom right, next to the
  shot radar). Until then the 180 check is off and everything else works. Once set, if the muzzle points more
  than 90° from downrange (any mix of left/right and up/down), a distinct alarm sounds even with the finger on
  the frame; it clears once the muzzle is back downrange with the finger on the frame.
- Layout (D-21): wide grip at the rear, thin slide, frame strip and trigger high; the shot movement
  indicator sits in the empty area under the muzzle.
- **Drills** (D-93, D-94, D-97, D-98, WQ-027): the start screen's **Drill** picker chooses **Freestyle** (the trainer as
  above, no timer, the default) or a timed drill; all Freestyle rules stay on during a drill. **Bill Drill**: finger on
  the frame → a random 1–4 s later the start beep → six shots (timer stops at the sixth) → finger back on the frame →
  completion tone and results (first shot, splits, total). A pause cancels the run; results are session-only.
- **Trigger wins** (D-75, WQ-016): a touch that engaged the trigger counts as on the trigger until it is lifted,
  wherever it moves; it never counts as frame contact, even inside the frame strip.

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
| `DEFAULTS`, `ZONES`, `K`, `zoneFor` | Settings defaults; normalized zones for a **right-handed** layout (muzzle at x=1, left-handed mirrors x); timing constants. Only `rest` and `trigger` zones are touch-sensitive. `zoneFor(name, vw)` adds the fixed `K.TRIGGER_FWD_PX` offset to the trigger (and the guard's front edge); the engine hit test and `rectFor()` both use it (D-72). |
| `summarize(state)` | Session totals for the summary screen, from `state.tally` (not capped like `state.shots`) and the alarm counters. Grades and movement figures cover only shots fired with no alarm (`graded`, D-45). |
| `createEngine(S, {onEvent})` | Returns `{motion, touches, tick, setPaused, setDownrange, resetStats, startDrill, cancelDrill, state}`. Emits `armed`, `ok`, `alarmStart` (`reason`: `move` or `180`), `alarmStop`, `trigOn`, `trigOff`, `shot`, `reset`, `downrange`, `downrangeLost`, `drillBeep`, `drillEnd`, `drillCancel`. Starts paused. |
| `motion(m)` | Rotation-rate magnitude and linear accel (EMA ~80 ms) for the alarm; integrates muzzle pitch/yaw (`aimH`, `aimV`, deg) for the trace (each sample's `dt` clamped to `MAX_DT_S`). The 180 orientation quaternion integrates the mean of the previous and current rates over the raw gap, capped at `ORIENT_BRIDGE_MS` (300 ms), so `devicemotion` gaps are bridged (D-62). Axis mapping per `axisMode`. Also feeds an advisory gyro-axis estimator (E-2, fused gravity; D-57, D-70) that sets `state.axisEst` = `{cand, margin, motionS, windows}` (`null` until the first 0.5 s window counts); it reads raw rates only and changes no output. |
| `touches(t, list, vw, vh)` | Full current touch list in CSS px; drives the trigger (engage on entering the zone, fire at `pullPx` rearward, re-arm at `RESET_FRACTION`). |
| `tick(t)` | State machine: debounced frame contact → armed / safe / off-frame / alarm; trace capture. |
| `fromDeviceMotion`, `fromTouch`, `pack*`, `replay(rec, overrides)` | Capture-time rounding, the recording row format, and deterministic replay (`docs/RECORDINGS.md`). |

### `index.html`

| Piece | What it does |
|---|---|
| `S` | Settings: always the full object (`DEFAULTS` merged with the stored changes). `localStorage['tdt.settings.v2']` holds only the keys whose value differs from `DEFAULTS` (D-64), so a default changed in the code reaches every phone where that setting was never moved; moving a setting back to its default drops its key. **Restore defaults** removes the stored key. A `tdt.settings.v1` whole-object save is migrated once at load (D-66). Bump the key if the schema changes incompatibly. |
| `Snd` | Web Audio: `ok()`, `shot()`, `startAlarm(kind)/stopAlarm()` (`move` beeps, `180` wail). `bindTestSound()` wires the hold-to-test buttons (start screen warning box, Settings). Created/resumed inside the Start tap (iOS unlock). Sets `navigator.audioSession.type='playback'` where available (iOS 17+ silent switch). |
| `onMotion` / `onTouch` / `onMouse` | Convert events with `TDT.fromDeviceMotion` / `fromTouch`, feed the engine, and log the same row if recording. |
| `tick` (rAF) | Pauses the engine when not running / settings open / hidden, or once portrait has persisted `PORTRAIT_HOLD_MS` (3 s, D-60; the **Rotate to landscape** overlay appears then), logs a frame row, calls `engine.tick`, renders. While portrait is shorter than that, `onMotion` and `feedTouches` keep feeding the last landscape screen angle and touch list (D-68). |
| `onEvent` | Engine events → sound, vibration, flash, alarm overlay; appended to `rec.observed` while recording. |
| Recorder | `startRecording()` makes a fresh engine; `stopRecording(share)` saves (if `share`) and then opens Settings scrolled to the recorder (`openSettings('recorder')`); `saveRecording()` uses the share sheet when it accepts files, else a download. |
| Settings overlay | Built from `SLIDERS`; includes live sensor readout, axis-check canvas, and the recorder. **Finish** opens the summary. |
| Summary overlay | `showSummary()`: `TDT.summarize` table + plot of kept shots (`drawTarget` with no trace). **Keep training** / **New session** (resets stats, back to the start screen). `sessionT0` is the start of the summarized time. |
| Drill picker | `DRILL_MODES` (`{id, name, sub, how, svg, ready}`, D-93 order; diagrams inline in `DRILL_SVG`; not-ready drills hidden). `#drillBtn` on the start screen opens `#drillOv` (**Choose** / **Cancel**). The selection `drillSel` is kept in `localStorage['tdt.drill']`, not in `S` (D-98 i). |
| Drill runs and results | `beginDrillRun(t)` (Start, recorder start, **Again**, Restore defaults while running) seeds `engine.startDrill` and logs `['r', t, drill, seed]`; Freestyle does nothing. `leaveToStart()` (**Change drill**, **New session**) cancels and logs `['x', t]` only if a drill existed. `drillEnd` → `Snd.complete(0.35)` + `showDrillResult()` (`#drillResOv`, pauses the engine while open). `#drillLine` shows the run's phase. |
| `window.__tdt()` | Read-only snapshot used by the browser tests. Keep it. |

### State machine
`not armed` → (finger on frame) → `SAFE` (OK tone) → (finger lifts) → `OFF FRAME`
→ either `ON TRIGGER` → `SHOT` → (reset / lift) … → back to `SAFE` (OK tone),
or (motion > threshold after `graceMs`) → `ALARM` (latched) → (finger on frame) → `SAFE` (OK tone).
During a press (pull ≥ 15% → 500 ms after the break) movement alarms once its total exceeds `jerkMs` (default 300 ms, D-47); resting on
the trigger without pulling is treated as off the frame. `graceMs` applies after leaving the frame, after a press,
and after leaving the trigger.
Off-frame drift (D-56, any off-frame state, press included): the orientation `st.q` at the moment the finger left is
kept as `qOff`; once `graceMs` has passed, a muzzle deviation `devOff` > `offFrameDeg` from it (roll ignored) starts a
`move` alarm. `qOff` is re-captured when `setDownrange` restarts `st.q` and after a motion gap > `ORIENT_GAP_MS`.
180 rule (any state while armed): muzzle > `limit180Deg` from downrange → `ALARM (180)`, which also escalates a movement
alarm; clears when back inside the limit by `HYST_180_DEG` with the finger on the frame. Only active after `setDownrange`;
a motion gap > `ORIENT_GAP_MS` clears downrange (`downrangeLost`).
Opening settings or the summary, backgrounding the page, or a portrait orientation that persists for 3 s (D-60) disarms and silences.
Drills (`st.drill`, only after `startDrill`): `standby` (delay drawn at the first armed tick on the frame; the beep waits
for the due time and for the finger on the frame ≥ `DRILL_BEEP_HOLD_MS` 350 ms) → `live` (beep; shots counted) →
`finishing` (sixth shot; timer stopped) → `ended` (finger on the frame: `drillEnd`); a pause in live, finishing or a
started standby emits `drillCancel` and returns to a fresh standby.

## Known platform facts and unknowns

- **Vibration:** `navigator.vibrate` doesn't exist on iOS Safari. Don't build hacks for it (not required).
  On Android it exists but the shot vibration has not been felt on any phone observed so far (Pixel 11, S20+; Ricky,
  2026-10-24). WQ-023 finds out why; until then nothing on the page promises a vibration.
- **Gyro axis order:** the spec maps `rotationRate` alpha/beta/gamma to z/x/y. Some iOS builds have been
  reported to deliver x/y/z order instead, and so does Chrome 155 on a Pixel 11 (its axis recordings fit only x/y/z).
  `axisMode: 'auto'` therefore means x/y/z order (the `ios` value) on every platform, independent of `isIOS` (D-52);
  `spec` remains a manual override. Verified on all three phones measured: Pixel 11 (D-40, D-52), iPhone 15, iOS 18.7
  (D-58; `tests/recordings/iphone-15/`) and Samsung Galaxy S20+, Chrome 155, left-handed (D-80;
  `tests/recordings/samsung-s20/`). Q1 is closed. The alarm uses magnitude,
  so it's unaffected; only the trace direction and the "low-left" style labels depend on this. Resolve it from `axis-up` and
  `axis-right` recordings: `npm run test:replay` prints the mapping that fits both for each phone. The engine also
  estimates the order at run time from gravity (`state.axisEst`, debug readout line `axis est`, D-57); the estimate is
  advisory only and `axisMode` still decides the mapping. Every Pixel 11, iPhone 15 and S20+ recording longer than 5 s ends with `xyz`.
- **Orientation:** sign of yaw uses `screen.orientation.angle` (or `window.orientation` on iOS): 90 vs 270.
  iOS can't lock orientation from a web page; Start tries fullscreen + `orientation.lock('landscape')` wherever
  `requestFullscreen` exists (D-53). iPhone Safari reports portrait for 1.5–4 s during a hard swing, and the page
  then pauses and disarms the engine; the Pixel 11 did it once. D-60 (WQ-013): the pause waits until portrait has
  persisted for 3 s. `devicemotion` stops for 98–123 ms at each flip; when that fell in a fast swing, the old 100 ms
  gap rule lost up to ~9° of 180 orientation (I-05). Since D-62, `motion()` bridges each gap in the 180 orientation
  with the mean of the rates on both sides, up to `ORIENT_BRIDGE_MS` (300 ms); the iPhone 15 drift drill now ends
  at 1.6° (was 8.6°). The rate EMA and the trace keep the 100 ms clamp.
- **Platform detection:** behavior uses feature checks, never the platform (D-53): Android Chrome also exposes
  `DeviceMotionEvent.requestPermission`, which once made a Pixel 11 look like an iPhone (recordings before D-53 say
  `ios: true`). `isIOS` is a user-agent test that only feeds the recorder's `device.ios` field and the debug readout.
  The S20+ recordings (made after D-53) carry `ios: false`. Chrome sends the same reduced user agent
  (`Linux; Android 10; K`, Chrome 155) on the Pixel 11 and the S20+, so the user agent cannot tell Android phones
  apart; `tests/replay.js` keys its per-phone axis verdict by recordings folder plus user agent (D-80).
- **180 orientation:** integrated from the gyro rates (quaternion, `motion()`), so it depends on the axis mapping
  (Q1) and drifts slowly (Q10: Pixel 11 under 2.5° over 3 minutes; iPhone 15 about 9° after a 93 s jig run, D-61; 3-minute run pending). The muzzle lies along device ±y in both landscape directions and both hands, so
  the deviation is simply the angle between R·ŷ and ŷ (sign-independent; roll-invariant).
- **Motion rate and fields:** all three phones deliver `devicemotion` at about 60 Hz (median 17 ms; S20+ longest
  gap 48 ms). The iPhone 15 and the S20+ report `acceleration` alongside `accelerationIncludingGravity`, so the fused
  gravity source (D-55) works there too. Chrome on both Android phones reports rates and accelerations in 0.1 steps;
  the iPhone gives full precision.
- **Touch contact size:** iPhone 15 Safari reports a non-zero `radiusX`/`radiusY` on every touch; Chrome 155 on the
  Pixel 11 reports 0, and on the S20+ a constant 0.8–0.9 px that carries no contact size. Nothing reads it since D-46; the recorder keeps `rx`/`ry` in the row format (D-18).
- **Units:** pull distance is CSS px (~160 px per inch on most phones, so the default 60 px pull ≈ 9–10 mm; D-71). Drift is degrees
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
- When you notice something worth exploring that's out of scope for the current task, add it to
  `docs/IDEAS.md` instead of building it or leaving it in chat.
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
docs/IDEAS.md           ideas for later exploration (not committed to)
docs/CLASS_USE.md       how to run it in a class (student-facing steps)
docs/PROPOSAL_2026-10-20.md  rationale behind the first queue items (axis order, platform check, estimators)
OPEN_QUESTIONS.md       blocking/pending questions for Ricky
WORK_QUEUE.md           outstanding work, one WQ-NNN item per unit (the planning document)
WORK_COMPLETED.md       archive of finished queue items
scripts/wq.py           queue invariant check, claim/unclaim/archive
.claude/skills/         work-queue-add, work-queue-run (+ BRIEF_RULES.md for execution agents, MODELS.md
                        for agent models), orchestrated-feature (+ PROJECT.md for this repo's specifics)
README.md               short public description + deploy steps
LICENSE                 MIT (Tangineering)
```

## WQ-024 — trigger zone to the guard front (D-87, D-88)

The trigger touch zone (`ZONES.trigger.w` .28) now ends at the trigger guard's front edge (both carry
`K.TRIGGER_FWD_PX`), so the trigger engages anywhere from its rear edge to the guard's front bar. In `index.html` the
blade's front face and the label are placed in px from the zone's muzzle-side edge by `sizeBlade()` (CSS custom
properties `--bladeOff`, `--gapMid` on `#trigZone`), not as percentages of the zone; the label is centred between the
blade face and the guard bar's inner edge.

## WQ-025 / WQ-026 — overall sensitivity presets (D-89, D-91, D-92)

There is no `sensitivity` setting and no engine multiplier (WQ-025's `limitsFor` factor was replaced by D-91 in
WQ-026); `tick()` reads `S.moveDps`, `S.moveAcc`, `S.offFrameDeg` directly. The Settings → Movement alarm drop-down is a UI preset in `index.html`:
Low / Default / High write `DEFAULTS` × 1.3 / 1 / 0.7 (rounded to the slider step: 32.5 / 1.95 / 6.5,
25 / 1.5 / 5, 17.5 / 1.05 / 3.5) into the three sliders (`SENS_PRESETS`, `sensPreset`, `applySensitivity`), and
`sensitivityFor(S)` shows the matching preset or the code-only, disabled **Custom** option while sliding. Only the
changed slider keys are stored (D-64), never a preset key. Steps: `moveDps` 0.5, `moveAcc` 0.05, `offFrameDeg` 0.5;
their outputs drop trailing zeros (`trim: true`). Slider order is unchanged (moveDps, moveAcc, offFrameDeg, graceMs,
jerkMs).

## WQ-027 — drill framework and Bill Drill (D-93, D-94, D-97, D-98)

**Engine** (`engine.js` 0.13.0). `mulberry32(seed)` is the drill generator (exported, D-98 h); `DRILL_DEFS` (exported)
holds each drill's start-beep delay range and `ready` flag (`bill` ready; `lowready`, `box` reserved and rejected
until WQ-028 / WQ-029). `startDrill(t, id, seed)` returns `false` and changes nothing for an unknown or not-ready id;
otherwise it cancels a run in progress (`drillCancel`) and sets `st.drill = {id, seed, rng, phase, dueAt, beepT, rep,
shots, early, alarms, result}`. Phases `standby → live → finishing → ended`, advanced by `tickDrill(t)` at the end of
`tick()` and by `drillShot()` from `fire()`: standby draws the delay (one `rng()` call) at the first tick armed with
the finger on the frame, and emits `drillBeep {drill, rep: 1}` at the first tick at or after the due time with the
finger on the frame for at least `K.DRILL_BEEP_HOLD_MS` (350 ms, clear of the OK tone; `st.restSinceT` is when the
finger last came onto the frame; D-104); live collects the run's shots (a shot in standby is `early`); the sixth shot computes `result`
(`first`, five `splits`, `total`, per-shot `{grade, dev, unsafe}`, `early`) and moves to finishing; the first tick
with the finger on the frame then fills `alarms`/`withAlarm` (alarm episodes from the beep to the end, a move alarm escalating to 180 counted
once, plus an alarm already sounding at the beep), pushes the result
to `st.drillRuns` and emits `drillEnd {drill, result}`. A run is "active" (`drillActive`) when live, finishing,
or in standby with its delay started (D-102); `setPaused(true)` on an active run emits `drillCancel {drill}` and
resets it to a fresh standby (the generator carries on); `startDrill` and `cancelDrill(t)` emit `drillCancel` only
for an active run, and `cancelDrill` sets `st.drill = null`. `resetStats()` clears `st.drillRuns`. With `st.drill === null`
(Freestyle) nothing changes: every existing recording replays to identical events.
Rows: `['r', t, drill, seed]` → `startDrill`, `['x', t]` → `cancelDrill`. Packed events: `[t, 'drillBeep', rep]`,
`[t, 'drillEnd', drill, r4(total)]`, `[t, 'drillCancel']`.

**Page** (`index.html`). `DRILL_SVG` (the four diagrams from `docs/mockups/drills/diagrams.js`, inline) and
`DRILL_MODES` (`{id, name, sub, how, svg, ready}` in D-93 order; not-ready modes are not listed). The selection is
`drillSel`, kept in `localStorage['tdt.drill']` (not a setting). Start screen: `#drillBtn` → picker `#drillOv`
(`openPicker`, `renderPicker`; **Choose** stores, **Cancel** reverts; landscape list left / diagram right, portrait
diagram on top). `beginDrillRun(t)` (from `start()`, `startRecording()`, **Again**, Restore defaults while running)
calls `engine.startDrill` with a `Math.random` seed and logs the `r` row; Freestyle does nothing. `leaveToStart()`
(results **Change drill**, summary **New session**) calls `cancelDrill` and logs `x` only when a drill existed. `Snd.timerBeep()` (2.6 kHz,
0.3 s) on `drillBeep`; `Snd.complete(0.35)` (C5–E5–G5–C6) on `drillEnd`, then `showDrillResult()` opens `#drillResOv`,
which pauses the engine while open. `#drillLine` under the status pill shows the run's phase (empty in Freestyle).
`window.__tdt()` adds `drill {id, phase, shots, early, result}`, `drillRuns`, `drillSel`, `drillResOpen`, `pickerOpen`.
Recorder label `drill-bill`.
