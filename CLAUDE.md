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
(stdlib Python 3) does the mechanical edits. **Numbers (`WQ-`, `D-`,
`Q`, `I-`) are assigned across all branches** (D-116): take them from `python scripts/wq.py next`, never from your
own copy of a file; `check` fails when `next_id` is behind any branch.

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
  above, no timer, the default) or a timed drill; all Freestyle rules stay on during a drill, except the Transitions window (D-111: from the first
  shot to the tenth, movement with the finger on the trigger does not alarm). **Bill Drill**: finger on
  the frame → a random 1–4 s later the start beep → six shots (timer stops at the sixth) → finger back on the frame →
  completion tone and results (first shot, splits, total). **Low Ready** (D-96): five reps from low ready, each a
  start beep → two shots → finger back on the frame → 750 ms later a three-beep cue (back to low ready), the next beep
  2–5 s later; after rep 5 the completion tone. **Box Drill** (D-95): five positions round four marked spots (1, 2, 3,
  4, back to 1); after the beep, two or more shots and the finger back on the frame give the three-beep move cue, the
  student walks to the next spot at their own pace with the finger on the frame, and the last position ends with the
  completion tone. **Transitions** (D-111, D-112): low-ready start, one start beep a random 2–5 s later, then ten
  shots in five pairs at two or three targets (timer stops at the tenth); from the first shot to the tenth, movement
  with the finger on the trigger does not alarm (the 180 rule stays on), before the first and after the tenth the
  normal rules apply; finger back on the frame → completion tone and results (first shot, pair splits, transitions,
  total). A pause cancels the run; results are session-only.
- **Trigger wins** (D-75, WQ-016): a touch that engaged the trigger counts as on the trigger until it is lifted,
  wherever it moves; it never counts as frame contact, even inside the frame strip.
- **One finger** (D-113, D-115): only a touch that lands while no other touch controls can count; a later finger is
  ignored until it is lifted.

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
| `createEngine(S, {onEvent})` | Returns `{motion, touches, tick, setPaused, setDownrange, resetStats, startDrill, cancelDrill, state}`. Emits `armed`, `ok`, `alarmStart` (`reason`: `move` or `180`), `alarmStop`, `trigOn`, `trigOff`, `shot`, `reset`, `downrange`, `downrangeLost`, `drillBeep`, `drillCue`, `drillEnd`, `drillCancel`. Starts paused. |
| `motion(m)` | Rotation-rate magnitude and linear accel (EMA ~80 ms) for the alarm; integrates muzzle pitch/yaw (`aimH`, `aimV`, deg) for the trace (each sample's `dt` clamped to `MAX_DT_S`). The 180 orientation quaternion integrates the mean of the previous and current rates over the raw gap, capped at `ORIENT_BRIDGE_MS` (300 ms), so `devicemotion` gaps are bridged (D-62). Axis mapping per `axisMode`. Also feeds an advisory gyro-axis estimator (E-2, fused gravity; D-57, D-70) that sets `state.axisEst` = `{cand, margin, motionS, windows}` (`null` until the first 0.5 s window counts); it reads raw rates only and changes no output. |
| `touches(t, list, vw, vh)` | Full current touch list in CSS px; drives the trigger (engage on entering the zone, fire at `pullPx` rearward, re-arm at `RESET_FRACTION`). |
| `tick(t)` | State machine: debounced frame contact → armed / safe / off-frame / alarm; trace capture. |
| `fromDeviceMotion`, `fromTouch`, `pack*`, `replay(rec, overrides)` | Capture-time rounding, the recording row format, and deterministic replay (`docs/RECORDINGS.md`). |

### `index.html`

| Piece | What it does |
|---|---|
| `S` | Settings: always the full object (`DEFAULTS` merged with the stored changes). `localStorage['tdt.settings.v2']` holds only the keys whose value differs from `DEFAULTS` (D-64), so a default changed in the code reaches every phone where that setting was never moved; moving a setting back to its default drops its key. **Restore defaults** removes the stored key. A `tdt.settings.v1` whole-object save is migrated once at load (D-66). Bump the key if the schema changes incompatibly. |
| `Snd` | Web Audio: `ok()`, `shot()`, `startAlarm(kind)/stopAlarm()` (`move` beeps, `180` wail); drill sounds `timerBeep()`, `cue3()`, `complete()`. `bindTestSound()` wires the hold-to-test buttons (start screen warning box, Settings). Created/resumed inside the Start tap (iOS unlock). Sets `navigator.audioSession.type='playback'` where available (iOS 17+ silent switch). |
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
`finishing` (the last shot (`def.shots`; six for Bill, ten for Transitions); timer stopped) → `ended` (finger on the frame: `drillEnd`); a pause in live, finishing or a
started standby emits `drillCancel` and returns to a fresh standby. Low Ready loops `standby → live → finishing` once per
rep (finishing: two shots, then 750 ms with the finger on the frame → `drillCue` and the next beep due 2–5 s later, or
`drillEnd` after rep 5); Box Drill uses the same loop with no hold and no new beep (two or more shots, the first tick on
the frame → `drillCue` `move` and the next position live at once, or `drillEnd` after position 5). Transitions is
Bill's single string with ten shots; while it is live with at least one shot and a trigger touch exists
(`st.drillFree`, D-112 d), the off-frame `move` alarm block is skipped; the 180 block is not.

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
holds each drill's start-beep delay range and `ready` flag (all four ready since WQ-030; a not-ready def would be
rejected: the `ready: false` paths in `startDrill` and in the page's picker / stored-selection loader are unused until
a future drill). `startDrill(t, id, seed)` returns `false` and changes nothing for an unknown or not-ready id;
otherwise it cancels a run in progress (`drillCancel`) and sets `st.drill = {id, seed, rng, phase, dueAt, beepT, rep,
shots, early, alarms, result, reps, cur, cueDueAt, earlyPending, alarmsPending, alarmCounted}` (the last six for the
per-rep drills, Low Ready WQ-028 and Box Drill WQ-029; `alarmInPending` too). Phases `standby → live → finishing → ended`, advanced by `tickDrill(t)` at the end of
`tick()` and by `drillShot()` from `fire()`: standby draws the delay (one `rng()` call) at the first tick armed with
the finger on the frame, and emits `drillBeep {drill, rep: 1}` at the first tick at or after the due time with the
finger on the frame for at least `K.DRILL_BEEP_HOLD_MS` (350 ms, clear of the OK tone; `st.restSinceT` is when the
finger last came onto the frame; D-104); live collects the run's shots (a shot in standby is `early`); the last shot (`def.shots`; six for Bill, ten for Transitions) computes `result`
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
(results **Change drill**, summary **New session**) calls `cancelDrill` and logs `x` only when a drill existed. `Snd.timerBeep()` (a sustained tone at
`S.beepHz` for `S.beepMs`, 1650 Hz / 350 ms by default, Settings → Other sliders, D-109, D-110) on `drillBeep`; `Snd.complete(0.35)` (C5–E5–G5–C6) on `drillEnd`, then `showDrillResult()` opens `#drillResOv`,
which pauses the engine while open. `#drillLine` under the status pill shows the run's phase (empty in Freestyle).
`window.__tdt()` adds `drill {id, phase, shots, early, result}`, `drillRuns`, `drillSel`, `drillResOpen`, `pickerOpen`.
Recorder label `drill-bill`.

## WQ-028 — Low Ready (D-96, D-98)

**Behavior.** Low Ready (second in the picker) is competition style: the muzzle stays downrange and the gun is lowered,
so there is no muzzle-angle check and Set downrange is not needed; the ordinary alarms apply. Five reps: start beep →
raise and fire at least two → finger back on the frame → 750 ms later (restarted if the finger leaves before it ends)
the three-beep cue (back to low ready) → 2–5 s after the cue, with the finger on the frame, the next beep. After rep 5
the completion tone plays where the cue would.

**Engine** (`engine.js` 0.14.0). `DRILL_DEFS.lowready = {delayMs: [2000, 5000], reps: 5, shotsPerRep: 2, cueHoldMs: 750,
cue: 'lowready', next: 'standby', ready: true}`; a def with `reps` takes the per-rep branches of `drillShot` / `tickDrill`
(shared with Box since WQ-029, parametrised by `cue` / `next` / `cueHoldMs`), Bill's code paths are unchanged. The run adds `rep` (reps whose beep has played), `reps` (finished rep results), `cur` (the rep in progress
`{rep, startT, beepT, shots, early, alarms}`; `startT` = the beep for Low Ready, WQ-029), `cueDueAt`, `earlyPending`, all reset by `freshRun` (a cancel loses the reps).
Rep 1's delay is drawn as Bill's; each cue draws the next rep's delay (one `rng()` call) and sets `dueAt`; the beep
condition (due, finger on the frame ≥ `DRILL_BEEP_HOLD_MS`) is shared. In `finishing` further shots still join the rep;
the cue timer runs only with `onRest` and is cleared when the finger is off. Rep result `{rep, beepT, reaction, split,
shots: [{grade, dev, unsafe}], early, alarms, withAlarm}`; run result `{drill, seed, beepT, reps, total (rep 1 beep →
end), avgReaction, bestReaction (over reps with no alarm; null if none), early, alarms, withAlarm, endT}`. Shots before
a rep's beep count in the run's `early` and in that rep's `early`. `drillAlarm()` also counts into `cur.alarms`; an alarm
episode that starts between reps (standby, `rep > 0`) counts into the run and, via `alarmsPending`, into the next rep.
One episode counts once into the run: `alarmCounted` is set when it is counted and cleared at the first tick with no
alarm, so a 180 alarm still sounding at a beep marks that rep (unless it is already there from between the reps,
`alarmInPending`) without counting again; the same flag guards Bill's at-beep rule. Event
`drillCue {drill, cue: 'lowready', rep}`, packed `[t, 'drillCue', cue, rep]`.

**Page** (`index.html`). `Snd.cue3()` (three 70 ms 1.76 kHz beeps, 120 ms apart) + `buzz([50, 50, 50, 50, 50])` on
`drillCue`, no delay (750 ms after the OK tone); `drillEnd` plays `Snd.complete(0)` for Low Ready (Bill keeps 0.35 s).
`DRILL_MODES.lowready` is `ready: true`. `drillLineText`: "Rep 1 of 5 · finger on the frame" (no delay started yet),
"Rep n of 5 · wait for the beep", "Go — raise and fire two", "Shot 1 of 2 — fire again", "Finger back on the frame", "Hold…" (cue
timer running). `showDrillResult` → `lowReadyRows(r)`: one row per rep (reaction, split, grades; early / alarm marks),
Total, Average and Best reaction (reps with no alarm), then the shared Early shots / With alarm rows, and "Best average reaction this session
(runs with no alarm)" (min `avgReaction` over this session's Low Ready runs with no alarm; Bill keeps "Best clean total",
since a Low Ready total depends on the seeded delays). `window.__tdt().drill` adds `rep`, `repsDone`, `curShots`,
`cuePending`, `dueSet`. Recorder label `drill-low-ready`.

## WQ-029 — Box Drill (D-95, D-98, D-107)

**Behavior.** Box Drill (third in the picker) is the movement drill: the student marks four spots, starts at spot 1,
goes round and finishes back at spot 1, five shooting positions. Finger on the frame → a random 1–4 s later the start
beep → fire two or more at the spot → finger back on the frame → three beeps (the move cue, at once) → walk to the next
spot with the finger on the frame, at the student's pace → fire two or more → … After position 5 the completion tone
plays where the cue would. One shot and the finger back on the frame gives no cue: fire again (D-98 b).

**Engine** (`engine.js` 0.15.0). `DRILL_DEFS.box = {delayMs: [1000, 4000], reps: 5, shotsPerRep: 2, cueHoldMs: 0,
cue: 'move', next: 'live', ready: true}`. Box and Low Ready share the per-rep code path; `cue` names the `drillCue`,
`next` says what follows it (`'standby'`: Low Ready's next beep due delayMs later; `'live'`: Box's next position live
at once, `cur = {rep, startT: t, beepT: null, …}`, no beep, no `rng()` call). With `cueHoldMs` 0 the cue comes at the
first tick with `onRest` after two or more shots, after that tick's `ok` event, at the same `t`. `cur.startT` is the
beep (position 1, and every Low Ready rep) or the previous cue. Position result `{rep, startT, beepT, time (startT →
first shot: move plus settle), splits, shots: [{grade, dev, unsafe}], early, alarms, withAlarm}` (Low Ready's rep result
is unchanged); run result `{drill, seed, beepT, reps, total (beep → last shot of position 5), early, alarms, withAlarm,
endT}`. Early shots are only possible before the beep; alarms during a position count into it and into the run (Box
has no between-reps standby); a 180 alarm still sounding at a move cue also marks the next position (`cur.alarms = 1`,
not counted again into the run). A pause cancels the run and loses the positions (`freshRun`, D-107). Packed cue
`[t, 'drillCue', 'move', rep]`.

**Page** (`index.html`). `DRILL_MODES.box` is `ready: true`. `drillCue` with `cue: 'move'` plays `Snd.cue3(0.35)` (after
the OK tone of the same tick); Box's `drillEnd` keeps `Snd.complete(0.35)`. `drillLineText` (Box): "Box Drill · finger
on the frame, wait for the beep", "Spot 1 of 5 · fire 2 or more", "Move to spot n · fire 2 or more", "Back at spot 1 ·
fire 2 or more", "Spot n · shot 1 of 2" ("Spot 1 (last) · …" at position 5), "Finger on the frame to move" / "to
finish", "Done". `showDrillResult` branches on `r.drill`; `boxRows(r)`: one row per position ("Spot 1 (last)" for
position 5: time, split(s), grades, alarm / early marks), "Total (beep to last shot)", then the shared rows and "Best
clean total this session" (as Bill: a Box total holds no seeded delay after the beep). Recorder label `drill-box`.

## WQ-030 — Transitions (D-111, D-112)

**Behavior.** Transitions (fifth in the picker, after Bill Drill) starts like Low Ready rep 1 (no muzzle-angle check,
Set downrange not needed; start beep 2–5 s after the finger is on the frame, D-104 hold), then one timed string of ten
shots: two at a target, a swing to the next target with the finger on the trigger, two more, … The timer stops at the
tenth shot; the finger back on the frame gives the completion tone and the results. It is the first drill that changes
the alarm rules: from the first shot to the tenth, the finger on the trigger suspends the `move` alarm.

**Engine** (`engine.js` 0.16.0). `DRILL_DEFS.transitions = {delayMs: [2000, 5000], shots: 10, pairShots: 2,
onTriggerFree: true, ready: true}`: no `reps`, so it takes Bill's single-string path in `drillShot` / `tickDrill`.
- **Window** (D-112 d): `freeOnTrigger()` (closure in `createEngine`) is true when the run's def has `onTriggerFree`,
  phase `live`, at least one run shot, and `st.trig` exists (D-75: until that touch lifts). `tick()` stores it in
  `st.drillFree` (state field, `false` otherwise) after this tick's trigger and press state, and the off-frame alarm
  block runs only when it is false: the rate test, the press `jerkMs` test and the `offFrameDeg` drift test are all
  skipped. The 180 block is unchanged (D-112 e). `finishing` (after the tenth shot) is outside the window by
  construction; an alarm latched before the window stays (D-112 h).
- **Drift reference re-takes** (D-112 f, g; idiom `if (st.qOff) st.qOff = st.q.slice()`, `qOff` is non-null exactly
  while off the frame): in `endTrigger` when the touch ends inside the window (evaluated before `st.trig = null`); in
  `drillShot` at the last shot, which also sets `st.trig.moveMs = 0`, so movement after shot 10 is judged from there;
  and in `startDrill` / `cancelDrill` (`closeWindow()`) when they replace or drop a run inside the window, so the swing
  already made does not alarm at the next tick. `closeWindow()` and `setPaused(true)` also set `st.drillFree = false`.
- **Grading** (D-112 i): each trigger object carries `minPull`, the lowest pull of this press attempt (0 at
  engagement, the pull at the moment of a trigger reset, lowered whenever the pull drops below it). While a run of an
  `onTriggerFree` def is live and the trigger is unfired, `retakeOrigin(tr)` sets `tr.oh`, `tr.ov` to the current aim
  and clears `tr.trace` as long as `tr.pull < tr.minPull + S.pullPx * K.PULL_START_FRACTION`, on every touch update
  (`updateTrigger`) and every tick (a finger held still on the trigger sends no touch events while the phone swings).
  Once the pull has risen 15 % above its lowest point the origin freezes; dropping back resumes the re-take. So a
  reset ridden between targets or an aborted partial press does not put the swing into the grade. Freestyle and the
  other drills: the condition is false, nothing changes.
- **Result**: Bill's keys (`first`, nine `splits`, `total` beep → shot 10, `shots`, `early`, `alarms`, `withAlarm`,
  `endT`) plus, only for a def with `pairShots`, `pairSplits` (splits at even indices: 1→2, 3→4, …; five),
  `transitions` (odd indices: 2→3, 4→5, …; four) and `avgTransition` (r4 mean). Bill's result object is unchanged.
  Packed events unchanged. With `st.drill` null or another drill every recording replays to identical events.

**Page** (`index.html`). `DRILL_SVG.transitions` (verbatim from `docs/mockups/drills/diagrams.js`), fifth `DRILL_MODES`
entry (`Transitions`, "Five pairs, target to target"); a compact picker rule under `@media (orientation: landscape) and (max-height: 430px)` fits the five entries, the
diagram and **Choose** / **Cancel** at 844×390 without scrolling (portrait unchanged).
`drillBeep` / `drillEnd` sounds as Bill (`timerBeep`, `complete(0.35)`). `drillLineText` (D-112 k): "Transitions ·
finger on the frame, wait for the beep", "Go — two at the first target", "Target n · fire again" (n =
`floor(shots / 2) + 1`), "Next target · finger may stay on the trigger", "Finger back on the frame", "Done".
`showDrillResult` → `transitionsRows(r)`: First shot, Pairs, Transitions, Average transition, Total, Shots; then the
shared Early shots / With alarm rows and "Best clean total this session". `window.__tdt().drill.freeOnTrigger` reads
`st.drillFree`. Recorder label `drill-transitions`.
Q18 (whether anything besides the 180 rule should guard the muzzle inside the window, and whether a mid-swing lift
should get a grace) is resolved by D-119: leave as built.

## WQ-031 — one finger controls the engine (D-113, D-114 b–d, D-115, D-120)

**Rule.** At most one touch controls the engine. A touch *wants control* while it is the engaged trigger touch
(`st.trig.id`) or lies in `ZONES.rest` or the trigger zone (raw zone tests, not the debounced `onRest`). The controller
(`st.ctrl`, a touch id or `null`) keeps control while it wants it and is present; a controller that slides out of every
zone gives it up. A touch first seen while a touch controls is **ignored** for its whole life (`st.ignored`, a `Set` of
ids), wherever it moves and after the controller lifts, and so is a touch already down (a finger on the grip) that
enters a zone while another controls. With no controller, the first touch wanting control takes it (a frame touch
before a trigger touch, D-114 d; otherwise list order) and the other new touches of that call are ignored. So a second
finger laid on the frame beside the first does not keep frame contact when the first lifts. One finger sliding from the
strip into the trigger is one touch and engages as before (D-114 b); D-75 stays.

**Engine** (`engine.js` 0.17.0). `touches()` (the only place a new id is first seen) records the previous call's ids,
rebuilds `st.touches` and calls `resolveControl(seen)` before `updateTrigger`; ids no longer present leave
`st.ignored`. The decision runs whether or not the engine is paused, and `setPaused` keeps both fields, so it never
depends on tick timing and replays stay deterministic. `restTouch()` and `updateTrigger()` skip ignored ids, so an ignored
touch never becomes `st.trig` and never sets `onRest`: `freeOnTrigger()` / `st.drillFree` (Transitions) and
`retakeOrigin()` only ever see the controller. The iOS portrait hold (D-68) re-feeds the last landscape touch list:
the same ids, so nothing is new and nothing changes. All 45 recordings replay to byte-identical events (the
multi-touch rows in the three `free` recordings are grip fingers while the frame finger controls).

**Page / tests.** `window.__tdt()` adds `ignored` (`st.ignored.size`) and `restContact`. CDP's
`Input.dispatchTouchEvent` keeps a point down until a `touchEnd` lists it (`touchEnd []` lifts all), so the drill
sections' smoke press helpers and the roundtrip Bill / Low Ready / Box `press()`, whose `touchStart [TRG]` used to add a second finger beside the frame finger, now lift
every point first; the `WQ-031` smoke section covers
the five scenarios of the item.

