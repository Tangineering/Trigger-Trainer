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

