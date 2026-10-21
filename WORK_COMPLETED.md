# WORK_COMPLETED.md — archive of finished queue items

Items rotate here from `WORK_QUEUE.md` when they are done (or deliberately
closed). Newest first. Each entry keeps its `WQ-NNN` ID and records **what
was done, why, and any deviation** from the item as written — the deviation
field is the important one: it is where the next session learns that the
plan met reality.

Entry template (copy verbatim; keep every heading even when the answer is
"none"):

```markdown
### WQ-NNN — <title as it stood in the queue>

- **Closed:** YYYY-MM-DD · **Outcome:** done | done-with-deviations | closed-wontdo | superseded-by WQ-MMM
- **Executed by:** <role> on <model>, plus <reviewer role / model, …> when any · **Round:** <orchestration round id, if any>
- **Commits / PR:** <hashes or PR link on the branch>

**What was done.** Two to six sentences. Name files and functions touched.

**Why.** The context the item carried, in one or two sentences, plus anything
learned during execution that changes the reasoning.

**Deviations.** What differs from the item's scope or acceptance text, and
why. "None" if none. A dropped sub-scope goes here AND becomes a new queue
item if it is still wanted.

**Verification.** What was run and its result (test counts, regression-check results,
manual checks). Say "not verified" plainly where that is the truth.

**Follow-ups.** New `WQ-` IDs raised from this work, or "none".
```

---

## Entries

### WQ-007 — Exclude shots fired during an alarm from the summary percentages (D-45)

- **Closed:** 2026-10-21 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261021-3
- **Commits / PR:** b399720 "WQ-007: Grade only shots fired with no alarm in the summary (D-45)" (fast-forwarded to main)

**What was done.** `engine.js` `addToTally()` counts every shot in `shots`, `unsafe` and `dirs`, but adds to the Clean/Moved/Jerked counts and `devSum`/`devN`/`best` only when `shot.unsafe` is false; `summarize()` returns a new `graded` field (`shots − unsafe`) and bases `cleanPct` on it (null when 0). `index.html` `showSummary()` computes the percentages over `graded`, labels the rows "Clean, of N shots with no alarm" (likewise Moved, Jerked), marks the movement rows "(no alarm)", and moves the during-alarm row next to the shot total as "Shots fired during an alarm (not graded below)". `tests/smoke.js`: the sustained-movement press is now completed during the alarm (a third shot) and three checks cover the summary numbers. Docs: D-39 note pointing at D-45, D-69 (`Claude (proposed)`), `docs/CLASS_USE.md` summary paragraph, `CLAUDE.md` `summarize` row. No `VERSION` bump.

**Why.** D-45 (Ricky): shots fired during an alarm stay counted, graded and plotted but leave the percentages and the steadiest-press stat.

**Deviations.** (1) "Most common miss" still counts every shot: D-45 names only the percentages and the steadiest value, so it was left and logged in D-69 for Ricky to confirm or reverse (a one-line change in `addToTally` if reversed). (2) Average movement is excluded together with the steadiest value, as the item's Scope says, although D-45's text names only "steadiest". (3) Summary rows reordered and reworded (D-69).

**Verification.** Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (38 recordings)", smoke "all passed", roundtrip "all passed"). Agent: smoke 57 PASS (54 + 3 new); `npm run test:replay` before/after diff identical. Acceptance numbers from replaying `pixel-11/tdt-press-wobble-2026-10-20-21-50-38.json`: `{"shots":3,"graded":0,"clean":0,"moved":0,"jerked":0,"cleanPct":null,"unsafeShots":3,"avgDev":null,"bestDev":null,"commonMiss":{"dir":"high-left","n":1},"moveAlarms":3,"breaks180":0}`; the sibling `…21-49-46` gives 2 shots, 2 during an alarm, 0 graded; `showSummary()` shows "0 (—)" and "—", not NaN. Not run: a visual check of the overlay on a phone (summary-only change, no sensor or touch part).

**Follow-ups.** Ricky to confirm D-69 (most-common-miss keeps alarmed shots); none otherwise.

---

### WQ-003 — Fail the replay test when `auto` disagrees with a phone's axis verdict

- **Closed:** 2026-10-21 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the replay suite · **Round:** round-20261021-2
- **Commits / PR:** caa5f4b "WQ-003: Fail the replay test when auto disagrees with a phone's axis verdict" (merged to main)

**What was done.** `tests/replay.js` gained `autoResolution(rec)`: it replays a recording with the default settings (`axisMode: 'auto'`, default flips) and finds which explicit mapping (`spec` or `ios`) gives an identical replay (packed events and aim path). After each per-device "Axis verdict" line, every axis recording from a real phone prints a PASS or FAIL line ("axis-up: auto → ios; fits: ios"); a FAIL increments `failures`. A per-recording WARN prints when `device.ios` disagrees with `/iP(hone|ad|od)/` on `device.ua`. A `mappingName()` helper is shared with `axisDiagnosis`. `docs/RECORDINGS.md` documents the FAIL check, the synthetic skip and the WARN.

**Why.** The axis verdict was INFO only; with iPhone recordings now in the repo the test must fail loudly if the `auto` default (D-52) ever stops fitting a phone. Both phones measured so far fit `ios`, so the guard passes today (D-58).

**Deviations.** (1) Synthetic recordings get an INFO line and skip the check: they pin `axisMode: 'spec'` and forcing `auto` (which resolves to `ios`) on them would fail by design. (2) The engine does not expose `axisMode()`, so the test infers what `auto` resolved to by comparing replays rather than reading the engine; `engine.js` is untouched. (3) The check runs only for a user agent with both `axis-up` and `axis-right` recordings, like the existing verdict.

**Verification.** Orchestrator on merged main: `npm run test:replay` "all passed (38 recordings)", with "PASS axis-right/axis-up: auto → ios; fits: ios" for the iPhone 15 and Pixel 11 user agents, "INFO synthetic recordings pin their own axisMode; 'auto' check skipped", and 15 "WARN device.ios is true but the user agent names no iPhone/iPad/iPod" lines (all `pixel-11/`). Agent's forced failure (temporary verdict `{'spec'}` for the Android UA, reverted before committing): "FAIL axis-right: auto → ios; fits: spec", the same for axis-up, "2 failed", exit 1. Agent's `npm test`: all three suites "all passed".

**Follow-ups.** None.

---

### WQ-014 — Bridge `devicemotion` gaps in the 180 orientation integration (D-62)

- **Closed:** 2026-10-21 · **Outcome:** done-with-deviations (agent-verifiable half; the owner-verifiable iPhone 3-minute drift run is deferred by Ricky, 2026-10-21, and tracked under WQ-006)
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261021-2
- **Commits / PR:** 08d0bf6 "WQ-014: Bridge devicemotion gaps in the 180 orientation (D-62)" (merged to main as 040b494)

**What was done.** `engine.js` `K` gains `ORIENT_BRIDGE_MS: 300`. `motion()` keeps the `MAX_DT_S`-clamped `dt` for the rate EMA and the aim trace; the quaternion step uses `dtQ` = raw gap capped at 300 ms and the mean of the previous and current body-frame rates (`st.prevW`, reset in `setDownrange` and when a gap clears `refSet`). `VERSION` and `package.json` 0.9.0 → 0.10.0. `CLAUDE.md` `motion(m)` row and the "Orientation" platform fact describe the bridge. D-65 (`Claude (proposed)`) records the first-sample rule.

**Why.** iOS Safari stops `devicemotion` for 98–123 ms at every portrait flip; crediting the gap with 100 ms of the post-gap rate lost about 9° of pitch/roll in the iPhone 15 drift drill (D-61, I-05). D-62 (Ricky): bridge with the mean rate over the gap, capped at 300 ms. WQ-011's off-frame reference orientation rides on the same integration and benefits from this.

**Deviations.** (1) The first sample after `setDownrange` (or after a gap clears downrange) adds no orientation step, the item's literal wording; before, that sample was integrated over the preceding interval, so "as today" was not exact. The agent tried the other reading: every `dev` figure moved under 0.35° and no event changed. Logged as D-65. (2) Besides the `dev` figures, some 180 `alarmStart`/`alarmStop`/`ok` timestamps in the five changed recordings move by one motion frame (16–25 ms) as the threshold crossing moves; event counts, reasons, grades and expectations are unchanged. (3) A stray comment on the `ORIENT_GAP_MS` line was moved to `HYST_180_DEG`, which it describes.

**Verification.** Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (38 recordings)", smoke "all passed", roundtrip "all passed"). Agent's replay diff before/after: only the five named recordings change (`iphone-15/180-break`, `iphone-15/free`, `pixel-11/180-break`, `pixel-11/free-…23-27-38`, `synthetic/180-break`), now reported as INFO "replay differs from the live run"; header "max" figures: `iphone-15/free` 178° → 175°, `synthetic/180-safe` 71° → 70°. End-of-replay `dev180` (agent's scratch script): `iphone-15/tdt-free-2026-10-21-03-38-03.json` 8.58° → 1.64° (target under 3.5°; equal to the uncapped offline trial, so the 300 ms cap changed nothing for these recordings); `pixel-11/tdt-free-2026-10-20-23-27-38.json` 0.73° → 0.60° (target under 1°). NOT verified: the owner line (iPhone 15 3-minute jig drift drill with engine 0.10.0, every rest under 5°) — deferred by Ricky and folded into WQ-006's remaining owner work.

**Follow-ups.** None new; the owner run is in WQ-006.

---

### WQ-015 — Store only user-changed settings so code defaults reach every phone (D-64)

- **Closed:** 2026-10-21 · **Outcome:** done (agent-verifiable half; the owner check on the Pixel 11 is listed under Verification and tracked under WQ-006's owner work)
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261021-2
- **Commits / PR:** 22f253c "WQ-015: Store only user-changed settings so code defaults reach every phone (D-64)" (fast-forwarded to main)

**What was done.** `index.html` stores settings under `tdt.settings.v2` as the diff against `DEFAULTS` (`changedFrom` helper; keys not in `DEFAULTS` are ignored); `save()` writes the diff or removes the key when it is empty; the load merges the stored diff over `DEFAULTS`, so `S` stays the full object. A `v1` save is migrated once at load when no `v2` key exists: changed keys are kept, `jerkMs` 500 is dropped (the pre-D-47 default), the result is written as `v2` and `v1` is removed. "Restore defaults" calls `clearSaved()`, which removes both keys. `tests/smoke.js` checks the `v2` diff shape and gained five checks (reload keeps the volume; a slider back at its default removes the key; a seeded `v1` migrates to `{"volume":0.35}`; Restore defaults removes the key; a reload after it keeps the default). Docs: `CLAUDE.md` `S` row, a note in `docs/CLASS_USE.md`, D-66 (`Claude (proposed)`, the migration rule).

**Why.** The whole-object `v1` save froze every default on a phone the first time any slider moved, so D-47's `jerkMs` 300 never reached the class Pixel and every future default change would be lost the same way. D-64 (Ricky, Q12 option 3).

**Deviations.** (1) `docs/CLASS_USE.md` had no sentence about saved settings, so a short note was added after the "Pick starting thresholds" bullet instead of editing one. (2) When both `v1` and `v2` exist, `v1` is removed without merging (D-66). (3) The new smoke checks click the hidden `#resetDefaults` button directly rather than opening Settings first; the handler is the same.

**Verification.** Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (38 recordings)", smoke "all passed", roundtrip "all passed"). Agent: smoke 39 PASS lines including the 5 new ones; `npm run test:replay` before/after diff empty; `grep -n "tdt.settings.v1" index.html` finds only the `KEY_V1` constant used by the migration and `clearSaved`. NOT verified (owner, Pixel 11 with its old save): after loading the updated page once, Settings shows `jerkMs` at 300, deliberately moved sliders keep their values, and a reload after "Restore defaults" keeps every slider at the code default.

**Follow-ups.** None.

---

### WQ-011 — Alarm when the muzzle drifts more than 5° while the finger is off the frame (D-56)

- **Closed:** 2026-10-21 · **Outcome:** done-with-deviations (agent-verifiable half; owner lines pending, see Verification; D-67 awaits Ricky)
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff (including the relative-quaternion product) and re-ran the suites · **Round:** round-20261021-2
- **Commits / PR:** 7e5c0da "WQ-011: Alarm when the muzzle drifts more than 5° off the frame (D-56)" (merged to main as ad21af8)

**What was done.** `engine.js`: `DEFAULTS.offFrameDeg = 5`; state `qOff`/`devOff`; `muzzleAngle(q)` shared by `deviation180()` and the new `deviationFrom(qRef)` (`conj(qRef)·st.q`). `tick()` captures `qOff` where `offSince` is set, clears it when the finger is back on the frame, computes `devOff` before the alarm block, and raises a `move` alarm (with `devOff` in the payload) when `devOff > offFrameDeg` after `graceMs` since `offSince`, in every off-frame state including presses. `qOff` is re-captured after `setDownrange()` and after a motion gap over `ORIENT_GAP_MS`, and cleared on pause. `VERSION` and `package.json` 0.10.0 → 0.11.0. `index.html`: "Max muzzle drift off the frame" slider (1–20°), a "drift off frame" debug line, `devOff` in `window.__tdt()`. `tests/smoke.js`: 9 new D-56 checks. Docs: `CLAUDE.md` Behavior spec and State machine, `docs/CLASS_USE.md`, `docs/RECORDINGS.md` drill table, D-67 (`Claude (proposed)`).

**Why.** Slow continuous movement with the finger off the frame never reached the rate thresholds, so it never alarmed (Ricky, 2026-10-20; D-56). Ricky confirmed on 2026-10-21 that the limit applies during trigger presses too.

**Deviations.** (1) `tests/expectations.js`: `jerked-press` no longer requires zero alarms (the synthetic 120 °/s jerk and the iPhone 15 follow-up string both pass 5°, which D-56 now alarms); `safe-move` accepts exactly one alarm still active at the end of the recording (the finger lifting to tap Stop while the phone drifted 5.1° in `iphone-15/safe-move`). Both are in D-67 and need Ricky's acceptance. (2) The existing smoke case "short hard jerk during the press: no alarm" moved about 16° and now alarms; it is now a 60 °/s jerk with recoil that stays under 5°, plus a `devOff < 5` assertion. (3) The drift alarm gates only on `graceMs` since leaving the frame, not the after-press/after-trigger grace. (4) `devOff` is in the event but not in `packEvent`/`observed`, so older recordings compare unchanged. (5) `qOff` is re-captured after any gap over `ORIENT_GAP_MS`, downrange set or not. (6) `qOff` is taken when the rest-loss debounce expires (where `offSince` is set), not at the raw lift instant.

**Verification.** Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (38 recordings)", smoke "all passed", roundtrip "all passed"). Agent: smoke 47 checks, run 4 times without flakes; replay before/after both "all passed (38 recordings)". Recordings whose live-equals-replay status moved from "matches" to "differs" (plain replay; the `{ offFrameDeg: 5 }` override is identical since no recording stores the key): `pixel-11/free-…22-40-27` alarms 2 → 3 (new at 63.57 s, devOff 5.2°, rotEMA 9.1 °/s, finger off 2.2 s); `pixel-11/press-wobble` ×2, `pixel-11/trigger-sweep`, `iphone-15/press-wobble`, `iphone-15/trigger-sweep` same alarm count, first alarm earlier; `iphone-15/jerked-press` alarms 0 → 1 at 2.61 s (devOff 5.1° during a follow-up string on the trigger); `iphone-15/safe-move` alarms 0 → 1 at 10.53 s (finger lifted to stop, drift 5.1°). Shot counts, grades and deviations identical everywhere; no alarm lost. `off-frame-still` gives no alarm on all three devices; `off-frame-move` still alarms. NOT verified (owner, Pixel 11 and iPhone 15): a slow ~10° sweep off the frame alarms within a second of passing 5°; holding still off the frame does not alarm; twisting about the barrel axis alone does not alarm; and whether a jerk past 5° during a press should alarm (it does now).

**Follow-ups.** Ricky to accept or change D-67 (the loosened `jerked-press` and `safe-move` expectations). Parked: give `tests/replay.js`'s summary per-alarm `devOff` so those two drills can assert "no alarm except drift past `offFrameDeg`" instead of a tolerance; optionally re-record iPhone 15 `safe-move` holding still while lifting to stop.

---

### WQ-013 — Pause on portrait only after it has persisted for 3 s (D-60)

- **Closed:** 2026-10-21 · **Outcome:** done-with-deviations (agent-verifiable half; the phone checks are deferred by Ricky and tracked under WQ-006)
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261021-2
- **Commits / PR:** 7a34fa7 "WQ-013: Pause on portrait only after it has persisted for 3 s (D-60)" (merged to main as 57fdbd9)

**What was done.** `index.html`: `PORTRAIT_HOLD_MS = 3000` with `portraitT0`/`portraitHeld` state; `tick()` starts the timer from the frame time on the first portrait frame, sets `portraitHeld` after 3 s, clears both on any landscape frame, and passes `portraitHeld` (not `isPortrait()`) to `setEnginePaused`. While portrait is pending, `onMotion` passes the last landscape `screenAngle()` and `feedTouches()` feeds the last landscape touch list with its landscape viewport while at least one touch is present (empty list once the count reaches zero); the recorder logs rows as fed. The `@media (orientation: portrait)` rule is gone; `tick()` toggles a `portrait` class and CSS shows `#rotateOv.armed.portrait`. `window.__tdt()` gained `paused` and `portraitHeld`. `tests/smoke.js` gained 7 checks. `CLAUDE.md` `tick` row and state-machine sentence updated; D-68 (`Claude (proposed)`, the touch-hold reading) appended. `engine.js` unchanged, no `VERSION` bump.

**Why.** iOS reports portrait for 1.5–3.8 s during a hard swing and the page disarmed at once, so a 180 drill on an iPhone could disarm mid-swing (Q15, D-60).

**Deviations.** (1) `docs/CLASS_USE.md` unchanged: no sentence said the trainer stops as soon as the phone turns portrait. (2) A touch that starts during a pending portrait while the held landscape list is empty is not seen until the next landscape touch event (D-68). (3) The smoke test exits fullscreen before `page.setViewportSize`, since Start requests fullscreen (D-53) and Chromium refuses to resize a fullscreen window. (4) No dedicated "OK tone not replayed" check; the 1.5 s case asserts `armed` and `onRest` stay true throughout.

**Verification.** Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (38 recordings)", smoke "all passed", roundtrip "all passed"). Agent: replay before/after diff empty; smoke 54 checks (47 + 7 new), all PASS, including "portrait for 1.5 s: still running, armed and safe, engine not paused", "portrait for 3.5 s: engine paused and disarmed", "back to landscape: unpaused but not armed until the finger is on the frame". The smoke test changes only `innerWidth`/`innerHeight`, not `screen.orientation.angle`, so the held-angle path is exercised only on a real phone. NOT verified (owner, iPhone 15 then Pixel 11): a swing through vertical with the finger on the frame gives no disarm, no overlay, no repeated OK tone, and `180-break` still alarms past 90°; 4 s of portrait shows the overlay and disarms; re-recorded `180-break` and `free` on the iPhone carry no `p` rows at the flips.

**Follow-ups.** None; the owner checks are listed in WQ-006.

---

### WQ-001 — Default the gyro axis order to x/y/z on every platform

- **Closed:** 2026-10-20 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261020-1
- **Commits / PR:** 5869e81 "WQ-001: Default the gyro axis order to x/y/z on every platform" (merged to main)

**What was done.** `engine.js` `axisMode()` resolves `auto` to `ios` (x/y/z `rotationRate` order) on every platform; `createEngine` no longer takes `opts.ios`, `replay()` no longer passes it, and `index.html` `newEngine()` calls `createEngine(S, { onEvent })`. `VERSION` and `package.json` moved 0.7.0 → 0.8.0. The Settings `axisMode` options read "x/y/z order (Chrome, iOS)" and "Spec order (x = beta, y = gamma, z = alpha)" with stored values unchanged. `tests/make-synthetic.js` writes `axisMode: 'spec'` into every synthetic recording and `tests/recordings/synthetic/` was regenerated. `tests/smoke.js` `swingUntil` now drives `rotationRate.alpha` (device x = yaw under x/y/z order), so the smoke test no longer depends on how the page detects the platform. Docs: `CLAUDE.md` "Gyro axis order" bullet and engine table, `OPEN_QUESTIONS.md` Q1 and Q11, `docs/RECORDINGS.md` format example, `docs/DECISIONS.md` D-52 (`Claude (proposed)`).

**Why.** The only real axis recordings (Pixel 11, Chrome 155) fit only x/y/z order, and the Pixel got that mapping only through the iOS misdetection (Q11). Decoupling the mapping from `isIOS` lets WQ-002 fix the detection without breaking the Pixel trace. Learned during the round: Playwright's headless Chromium 156 also exposes `DeviceMotionEvent.requestPermission`, so `main` had 2 failing smoke checks (the 180 swing assumed the spec mapping) before this item; they pass now.

**Deviations.** `docs/RECORDINGS.md` had no sentence saying replay uses the `auto` default, so the agent annotated the `device.ios` line of the format example instead. The `CLAUDE.md` engine-table row for `createEngine` was corrected in place (outside the bullet the item named) because it was wrong after the change. `index.html` dropped `ios: isIOS` from the `createEngine` call (the option no longer exists); every other `isIOS` use is left to WQ-002. `tests/replay.js` and `tests/roundtrip.js` needed no change.

**Verification.** Orchestrator re-ran `npm test` on merged main: replay "all passed (26 recordings)" with "Axis verdict … Chrome: ios" and "Axis verdict for synthetic (spec axis order): spec"; smoke "all passed"; roundtrip "all passed". All 15 `pixel-11/` recordings report "INFO recorded with engine 0.7.0 (or 0.6.0), now 0.8.0: replay still matches the live run" (none carries app 0.8.0). `grep -n "opts.ios\|ios ?" engine.js` finds nothing. NOT verified: the owner-verifiable Pixel 11 check (Settings → Gyro axis mapping on Auto: muzzle up moves the trace up, swing right moves it right) — behaviour is unchanged for the Pixel, which already resolved to `ios`.

**Follow-ups.** None new; WQ-003 (replay guard) is unblocked, and Q1 (iPhone axis order) stays open until WQ-006's iPhone recordings exist.

---

### WQ-002 — Replace the `isIOS` platform check with feature checks

- **Closed:** 2026-10-20 · **Outcome:** done
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261020-1
- **Commits / PR:** 09bec82 "WQ-002: Replace the isIOS platform check with feature checks" (merged to main)

**What was done.** In `index.html`, `start()` attempts `requestFullscreen` and `screen.orientation.lock('landscape')` whenever `document.documentElement.requestFullscreen` exists; the start-screen `platformNote` shows the iPhone text when `'vibrate' in navigator` is false and the Android text otherwise. `isIOS` is now a user-agent test only (`/iP(hone|ad|od)/`, or `MacIntel` with more than one touch point for iPadOS) and feeds only the recorder's `device.ios` field and the debug readout. `docs/DECISIONS.md` gains D-53 (`Claude (proposed)`) and D-44 reads "superseded by D-53"; `OPEN_QUESTIONS.md` Q11 is marked resolved pending a phone check; `CLAUDE.md` gets a "Platform detection" bullet and a corrected Orientation bullet.

**Why.** Android Chrome 155 exposes `DeviceMotionEvent.requestPermission`, so the Pixel 11 was detected as iOS: no fullscreen, no landscape lock, the wrong start-screen note, and `device.ios: true` in every recording. WQ-001 had already decoupled the axis mapping from `isIOS`, so this fix could not break the Pixel trace.

**Deviations.** None in scope. `createEngine` was untouched because WQ-001 had already removed `ios`. One side effect: headless Chromium (which also exposes `requestPermission`) now attempts fullscreen and the orientation lock at Start; both are in try/catch and the suites report "no page errors".

**Verification.** Orchestrator re-ran `npm test` on merged main: replay "all passed (26 recordings)", smoke "all passed", roundtrip "all passed". `grep -c "isIOS" index.html` returns 3 (definition, recorder field, debug readout). Agent additionally loaded the page in Playwright Chromium 156: Android note shown, 0 page errors. NOT verified (owner-verifiable, remaining): Pixel 11 — Start goes fullscreen and locks landscape, the Android note shows, a new recording carries `device.ios: false`; iPhone — the motion permission prompt still appears and the iPhone note shows.

**Follow-ups.** None; the owner checks above fold into WQ-006's recording session on each phone.

---

### WQ-004 — Build an offline gyro-axis estimator harness over the recordings

- **Closed:** 2026-10-20 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the harness · **Round:** round-20261020-1
- **Commits / PR:** 975ddbc "WQ-004: Add offline gyro-axis estimator harness and report" (merged to main); DECISIONS rows added by the orchestrator in the round's archive commit

**What was done.** `tests/axis-estimate.js` (Node, no dependencies, `npm run axis-estimate`) runs E-1 (derivative fit), E-2 (0.5 s window integration with the quaternion step copied from `engine.js` `motion()`) and E-3 (correlation matrix) over all 48 permutation-and-sign candidates on every recording, each with two gravity sources: `lp` (centred ±50 ms average of `accelerationIncludingGravity`) and `fused` (`accelerationIncludingGravity − acceleration`). Per recording and estimator it prints the winner or tie set, the margin, the runner-up, the motion seconds until the decision last changed, and agreement with the per-UA axis-drill verdict, then an acceptance summary. Results are in `docs/PROPOSAL_2026-10-20.md` section 3.7, the full output in `docs/axis-estimate-2026-10-20.txt`, and a "how to run" section in `docs/RECORDINGS.md`.

**Why.** Before any run-time axis estimation, the estimators had to be measured offline. Result: E-2 with `fused` gravity ranks `xyz` first on all 15 Pixel 11 recordings, minimum margin 11.47, decision within 0.7 s of motion on `180-*` and `press-wobble`; E-3 fails every criterion (**g** × d**g**/dt has no component along gravity, which is device x in landscape); `lp` gravity gives one confidently wrong answer (`axis-up`, margin 7.22), so the gravity source matters more than the estimator.

**Deviations.** (1) Two gravity sources instead of one, because the source decides the result. (2) Synthetic recordings carry no gravity and `tests/make-synthetic.js` belonged to WQ-001 this round, so the harness simulates the gravity a spec-order phone reports in a fixed pose (keyed on `rec.synthetic`, never `settings.axisMode`). (3) The synthetic acceptance line "ranks `spec` first" is met only in the weak form "no candidate above `spec`" (E-2): only `180-safe` rotates about all three axes; on 7–8 others `spec` ties for first and 2 have no motion. (4) E-3's margin uses the proposal 3.3 per-row definition. (5) The agent could not append its proposed decisions to `docs/DECISIONS.md` (file owned by WQ-001 this round); the orchestrator appended them as D-55.

**Verification.** Orchestrator ran `npm run axis-estimate` on merged main: "26 recordings, 0.7 s", 156 estimator lines; summary lines verbatim: "fused E-2: real > 5 s ranking xyz first 14/14; synthetic spec first 1, tied first 8, beaten 0, no motion 2 (of 11); drill disagreements 0; min real margin 11.47 (>= 1.5: met); decision within 3 s on 180-*/press-wobble 4/4 (met)"; "fused E-3: … min real margin 1.02 (>= 1.5: not met); decision within 3 s … 0/4 (not met)". `npm test` passes all three suites on merged main (the agent's own run showed the pre-WQ-001 smoke baseline of 2 failures; it merged after WQ-001 fixed them). Not tested: a clean clone (no `npm install` is needed by the script); any phone other than the Pixel 11.

**Follow-ups.** (a) Synthetic recordings that can identify a mapping (emit `accelerationIncludingGravity` and one three-axis drill in `tests/make-synthetic.js`) — parked in the queue's parking lot. (b) Check on an iPhone that `acceleration` is reported alongside `accelerationIncludingGravity` — folded into WQ-006's analysis half. (c) Ricky decision on proposal 3.6 step 1 (advisory E-2 with `fused` gravity in the debug readout) — raised as Q12 in `OPEN_QUESTIONS.md`.

---

### WQ-009 — Remove the contact-size (flat-finger) check (D-46)

- **Closed:** 2026-10-20 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261020-1
- **Commits / PR:** 2c75bdb "WQ-009: Remove the contact-size (flat-finger) check (D-46)" (merged to main as 3edbb5e)

**What was done.** `engine.js`: `requireFlat` and `minContactPx` left `DEFAULTS`; `sizeSupported` / `lastRestSize` left the state; the two size lines in `restTouch()` (used by `touches()`) and the per-touch `size` field that only they read were removed. `fromTouch` / `packTouches` still carry `rx`/`ry`, so old recordings parse. `index.html`: the whole "Flat-finger check" Settings section (heading, `requireFlat` checkbox, `sliders3` host with the `minContactPx` slider, `liveContact` readout) and its wiring in the checkbox arrays and `renderLive()` are gone. `CLAUDE.md` lost the "Contact size" bullet. `docs/DECISIONS.md` D-54 (`Claude (proposed)`) records the removal of the `size` field.

**Why.** D-46 (Ricky, 2026-10-20): a touch inside the frame strip is "finger on frame"; flatness is taught outside the tool. The check never worked on the Pixel 11 (every touch reports radius 0).

**Deviations.** The per-touch `size` field was also removed (nothing reads it once the check is gone; replay output unchanged). The `touches` row of the `CLAUDE.md` engine table, `docs/CLASS_USE.md`, `tests/smoke.js` and `tests/roundtrip.js` had no reference to the setting and were not edited; `window.__tdt()` never exposed `sizeSupported` / `lastRestSize`. No `VERSION` bump: `grep -rl '"requireFlat":true' tests/recordings` finds no files. Old `tdt.settings.v1` values for the two keys are ignored; the storage key is unchanged.

**Verification.** Agent: `npm run test:replay` output before and after the change diffed identical (125 lines, 26 recordings). Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (26 recordings)", smoke "all passed", roundtrip "all passed"); `grep -rn "requireFlat\|minContactPx\|sizeSupported\|lastRestSize" engine.js index.html tests/*.js` prints nothing. NOT verified (owner-verifiable, remaining): on any phone, Settings no longer shows the "Flat-finger check" section.

**Follow-ups.** None.

---

### WQ-010 — Lower the `jerkMs` default to 300 ms (D-47)

- **Closed:** 2026-10-20 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261020-1
- **Commits / PR:** 052690b "WQ-010: Lower the jerkMs default to 300 ms (D-47)" (merged to main)

**What was done.** `engine.js` `DEFAULTS.jerkMs` 500 → 300 with the comment citing D-47; `VERSION` and `package.json` 0.8.0 → 0.9.0 (the second bump this round; 0.8.0 was WQ-001 and was never deployed). `CLAUDE.md` "State machine" paragraph now reads "exceeds `jerkMs` (default 300 ms, D-47)"; `docs/CLASS_USE.md` says "about a third of a second (300 ms by default)". The `index.html` slider range (100–1500, step 50) is unchanged.

**Why.** D-47 (Ricky, 2026-10-20): reduce the movement allowance during a press to 300 ms "for now". Learned during execution: `index.html` saves the whole settings object to `localStorage['tdt.settings.v1']`, so any phone that has saved settings keeps `jerkMs: 500` and does not pick up the new default — raised as Q12.

**Deviations.** (1) The one-off override replay over all 15 `pixel-11/` recordings changes the same three files the item named, but in the `free` recording the alarm comes earlier (45096 → 43212 ms) rather than being an extra alarm; counts are unchanged (58 events, 2 move alarms, 19 shots). D-47's note says "one extra alarm" and was left as written (Ricky row); this entry is the correction. (2) The folder has 15 recordings, not 14 as the item implied (the 2026-10-20 drift recording was added after the item was written); the extra one is identical under 300 ms. (3) The acceptance grep still finds "500 ms" at `CLAUDE.md:110` (`K.PRESS_AFTER_BREAK_MS`, not `jerkMs`) and in the D-25/D-35 history rows; none is a stale default. (4) `docs/RECORDINGS.md` and the slider never quoted 500 ms, so neither changed; no new DECISIONS row (D-35 and D-47 cover it).

**Verification.** Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (26 recordings)", smoke "all passed", roundtrip "all passed"). Agent's override replay (`TDT.replay(rec)` vs `TDT.replay(rec, { jerkMs: 300 })`, throwaway script, not committed): 12 of 15 identical; `tdt-press-wobble-2026-10-20-21-49-46.json` same counts (5 alarms, 2 shots), all alarms 190–200 ms earlier; `tdt-press-wobble-2026-10-20-21-50-38.json` same counts (3 alarms, 3 shots), alarms at 3630→2913 ms and 6773→6573 ms, and the alarm near 10.1 s now fires before the shot; `tdt-free-2026-10-20-22-40-27.json` as under Deviations. Every real recording carries its own `settings` (12 with `jerkMs: 500`, 3 with none), so plain `npm run test:replay` is unchanged. Not run: any phone.

**Follow-ups.** Q12 (how a changed default reaches phones with saved settings) — a code item follows Ricky's answer; parked in the queue.

---

### WQ-005 — Record a long `free` drill with downrange set to measure gyro drift (Q10)

- **Closed:** 2026-10-20 · **Outcome:** done
- **Executed by:** Ricky (recording, Pixel 11) + recordings-review session (analysis) · **Round:** none (pre-round)
- **Commits / PR:** "Add 3-minute drift recording from the Pixel 11", "Resolve Q10: gyro drift under 2.5° over 3 minutes on the Pixel 11" on main

**What was done.** Ricky recorded `tests/recordings/pixel-11/tdt-free-2026-10-20-23-27-38.json` (173.7 s, downrange set at 1.0 s, fifteen 180 breaks up to 179°), starting, pausing at 90 s and ending on a desk jig so the phone sat in the same pose each time. The analysis replayed it with `TDT.createEngine` and read `state.q` / `state.dev180` at the three rest windows (rotation under 3 °/s for 3 s or more): 180 deviation 0.09°, 1.87°, 0.73°; full-orientation error 2.4° and 0.9° relative to the first rest; the averaged gravity vectors agree within 0.15°, confirming the jig. Q10 marked resolved in `OPEN_QUESTIONS.md`, D-49 added (`Claude (proposed)`), `docs/IDEAS.md` I-02 set to dropped.

**Why.** Orientation for the 180 rule is integrated from the gyro alone, so drift could cause false 180 alarms over a long drill. The measured drift is two orders of magnitude below the 90° limit.

**Deviations.** The item asked for "normal" training motion; the recording is far harsher (fifteen full swings past 90°), which makes the result conservative. The item's drift threshold for promoting I-02 (about 10°) was not approached, so I-02 was dropped rather than parked. D-49 is a Claude proposal pending Ricky's ratification.

**Verification.** `npm run test:replay`: the file replays identically to the live run (54 events). Rest-window analysis script run once in the review session (not committed; the numbers are in Q10 and D-49).

**Follow-ups.** WQ-006's analysis half should repeat the same drill on each new phone (noted in Q10); no new item.

---

### WQ-008 — Ratify or reject the `proposed` rows in `docs/DECISIONS.md`

- **Closed:** 2026-10-20 · **Outcome:** done
- **Executed by:** recordings-review session (Ricky answered in chat; Claude applied) · **Round:** none (pre-round)
- **Commits / PR:** see `git log --oneline -1 -- docs/DECISIONS.md` on main (commit "Ratify proposed decisions …")

**What was done.** Ricky answered the item's question in chat on 2026-10-20. In `docs/DECISIONS.md`, D-07 to D-13, D-17 to D-20, D-29, D-32, D-37, D-39, D-41 and D-43 became `Claude → Ricky accepted` / `active`; D-06 became `superseded` (modified by D-46: contact-size check removed) and D-35 `Claude → Ricky modified` (D-47: `jerkMs` 300 ms). New rows D-45 to D-48 record the answers. `CLAUDE.md` hard constraint 1 no longer says D-17 is pending.

**Why.** Twenty prototype-era choices were implemented but never ratified; the behaviour was already in use in class, so each was a yes/no for Ricky.

**Deviations.** Two answers were modifications rather than acceptances, so they became code items WQ-009 (remove contact size) and WQ-010 (`jerkMs` 300 ms) instead of being applied here. D-44 was marked `superseded` at the same time (WQ-002 replaces it), which the item did not list.

**Verification.** `grep -c "| proposed |" docs/DECISIONS.md`: 20 before, 0 after. `python scripts/wq.py check` OK.

**Follow-ups.** WQ-009, WQ-010 (both raised in the same `queue:` commit).

---

