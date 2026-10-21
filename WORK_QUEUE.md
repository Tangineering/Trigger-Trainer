# WORK_QUEUE.md — outstanding work

The central planning document for this project. An **orchestration session**
schedules work rounds from it; **exploratory sessions** add to it; **execution
agents** receive one item at a time, with the item's text as their brief.
Finished items leave this file and land in `WORK_COMPLETED.md` — this file
holds **only outstanding work**.

How to use it:

- Adding or editing an item → `.claude/skills/work-queue-add/SKILL.md`.
- Pulling a round, handing off, archiving → `.claude/skills/work-queue-run/SKILL.md`.
- The queue's canonical home is the default branch (`main`); a session that finds it
  only on a side branch merges that branch first.
- IDs are `WQ-NNN`, assigned from `next_id` below, never reused. An item keeps
  its ID for life (queue → completed).
- Order within the index is priority, then dependency order. It is not a
  promise of execution order — the orchestration session picks rounds.
- Project rules that every item inherits: `CLAUDE.md` (hard constraints, architecture, working
  rules). In particular: `npm test` after every engine or input-wiring change; bump `engine.js`
  `VERSION` when outputs change for the same inputs; real-phone checks are owner-verifiable
  acceptance lines; decisions an agent makes are logged as `Claude (proposed)` in
  `docs/DECISIONS.md`.

```yaml
next_id: WQ-011
updated: 2026-10-20
```

## Index

| ID | Title | Pri | Size | Status | Depends on | Track |
|----|-------|-----|------|--------|------------|-------|
| WQ-001 | Default the gyro axis order to x/y/z on every platform | P1 | M | claimed:round-20261020-1 | — | axis |
| WQ-003 | Fail the replay test when `auto` disagrees with a phone's axis verdict | P1 | S | queued | WQ-001 | axis |
| WQ-002 | Replace the `isIOS` platform check with feature checks | P1 | S | claimed:round-20261020-1 | — | platform |
| WQ-006 | Record axis and clean-press drills on an iPhone and a second Android phone | P1 | S | blocked:owner-machine | — | recordings |
| WQ-009 | Remove the contact-size (flat-finger) check (D-46) | P1 | S | claimed:round-20261020-1 | — | grading |
| WQ-010 | Lower the `jerkMs` default to 300 ms (D-47) | P1 | S | claimed:round-20261020-1 | — | grading |
| WQ-004 | Build an offline gyro-axis estimator harness over the recordings | P2 | M | claimed:round-20261020-1 | — | axis |
| WQ-007 | Exclude shots fired during an alarm from the summary percentages (D-45) | P2 | S | queued | — | grading |

Status values: `queued` · `claimed:<session or round>` · `blocked:<what>` ·
`blocked:user` (needs a decision only the owner can make — the item says which)
· `blocked:owner-machine` (needs data, hardware or a platform only the owner
has — the item says exactly what to run).

Mechanical edits (claim, un-claim, archive, invariant check) go through
`python scripts/wq.py …`; see `work-queue-run`. On Ricky's PC the interpreter is
`C:\Users\ricky\.local\bin\python.exe` (the `python` alias on PATH is the Microsoft Store stub).

Tracks: axis · platform · recordings · grading · layout · decisions · docs

---

## Items

### WQ-001 — Default the gyro axis order to x/y/z on every platform

- **Status:** claimed:round-20261020-1 · **Priority:** P1 · **Size:** M · **Track:** axis · **Env:** any
- **Added:** 2026-10-20 by recordings-review session · **Updated:** 2026-10-20 by orchestration session (headless Chromium 156 also exposes `requestPermission`, so the smoke test now runs with the `ios` mapping and fails)
- **Depends on:** — · **Blocks:** WQ-003

**Context.** The only real-phone axis recordings (`tests/recordings/pixel-11/tdt-axis-up-*.json`,
`tdt-axis-right-*.json`, Pixel 11, Android Chrome 155) fit only the x/y/z `rotationRate` order,
which the code calls the `ios` mapping (`npm run test:replay` prints "Axis verdict … : ios").
Today `axisMode: 'auto'` picks `ios` only when the page detects iOS, and the Pixel gets the right
mapping only because Chrome 155 is misdetected as iOS (Q11, D-44). A correct platform check (WQ-002)
would therefore break the Pixel trace unless the default changes first. Rationale and risk:
`docs/PROPOSAL_2026-10-20.md` section P-1.

**Scope.**
- `engine.js`: `const axisMode = () => (S.axisMode === 'auto' ? (ios ? 'ios' : 'spec') : S.axisMode)`
  (line 134 at commit 87d66f1) resolves `auto` to `'ios'` on every platform. Remove `opts.ios` from
  `createEngine` (line 118) and from the JSDoc above it; keep the `replay()` call site compiling
  (line 390 passes `ios:` — drop it). Keep `spec`, `ios`, `flipH`, `flipV` as manual overrides.
- Bump `VERSION` (`engine.js` line 15, currently `'0.7.0'`) and `package.json` `version` to match:
  a phone correctly detected as Android today would produce a different trace for the same inputs.
- `index.html` line 233: relabel the `axisMode` select options so `ios` reads "x/y/z order (Chrome, iOS)"
  and `spec` reads "Spec order (x = beta, y = gamma, z = alpha)". Do not change the stored values.
- `tests/make-synthetic.js`: the synthetic recordings are generated in spec order (line 15 comment,
  `device.ios: false` at line 83). Write `axisMode: 'spec'` into their `settings` so they keep passing,
  and regenerate `tests/recordings/synthetic/` with `npm run synthetic`.
- Docs pass: reword the "Gyro axis order" bullet under "Known platform facts" in `CLAUDE.md`, Q1 and Q11
  in `OPEN_QUESTIONS.md`, and `docs/RECORDINGS.md` where it says the replay sets the `auto` default.
  Add a `Claude (proposed)` row to `docs/DECISIONS.md` for the new default.
- `tests/smoke.js`: on Playwright Chromium 156 (`HeadlessChrome/156`, 2026-10-20) `DeviceMotionEvent.requestPermission`
  exists, so `isIOS` is true and `auto` already resolves to `ios`; the 180-rule swing (`swingUntil`, rotating about
  `beta`) assumes the spec mapping, and `npm test` fails 2 checks on `main` ("swing past 90° … 180 alarm" and
  "Finish opens the session summary … breaks180 === 1"). Make the smoke test independent of the platform
  detection: drive the axis that is yaw under the x/y/z order, or write the mapping it assumes into the
  page settings before Start. All smoke checks must pass under the new default.
- Out of scope: the `isIOS` check and its three uses in `index.html` (WQ-002); the replay-test guard
  (WQ-003); any run-time estimation of the axis order (WQ-004 and later).

**Acceptance.**
- `npm test` passes (all three suites); `npm run test:replay` reports "all passed" with every real
  recording in `tests/recordings/pixel-11/` still showing "PASS replay reproduces the live run" where
  its `app` field equals the new `VERSION`, or "INFO … still matches" where it does not.
- The synthetic `axis-up` and `axis-right` recordings still pass with their explicit `axisMode: 'spec'`.
- `grep -n "opts.ios\|ios ?" engine.js` finds nothing.
- Owner-verifiable (Pixel 11): with Settings → axis order left on Auto, tilting the muzzle up moves
  the trace up and swinging it right moves the trace right.

**Verification.** `npm test`; `npm run test:replay` output quoted in the completion entry; the
`VERSION` bump and the DECISIONS row named in the entry.

---

### WQ-002 — Replace the `isIOS` platform check with feature checks

- **Status:** claimed:round-20261020-1 · **Priority:** P1 · **Size:** S · **Track:** platform · **Env:** any
- **Added:** 2026-10-20 by recordings-review session · **Updated:** 2026-10-20 by orchestration session (headless Chromium facts corrected)
- **Depends on:** — · **Blocks:** —

**Context.** `isIOS` (`index.html` line 297 at commit 87d66f1) is true when
`DeviceMotionEvent.requestPermission` exists or the user agent names an iPhone/iPad/iPod. Android
Chrome 155 exposes `requestPermission`, so a Pixel 11 is detected as iOS: every recording in
`tests/recordings/pixel-11/` carries `device.ios: true`. On the Pixel this skips fullscreen and the
landscape lock and shows the iPhone note on the start screen (Q11, D-44). Rationale:
`docs/PROPOSAL_2026-10-20.md` section P-2. Note: D-44 records Ricky's hold on this code on
2026-10-20; the hold was lifted when this item was queued (this item is the agreed replacement).

**Scope.**
- `index.html` `start()` (line 787): attempt `requestFullscreen` and `screen.orientation.lock('landscape')`
  whenever `document.documentElement.requestFullscreen` exists, instead of `!isIOS`. Both calls are
  already in try/catch.
- `index.html` line 909: choose the platform note from `'vibrate' in navigator` (Android text when
  present, iPhone text when absent) instead of `isIOS`.
- `isIOS` itself becomes a user-agent test only: `/iP(hone|ad|od)/.test(navigator.userAgent)` or
  (`navigator.platform === 'MacIntel'` and `navigator.maxTouchPoints > 1`, iPadOS). It remains used
  for the recorder's `device.ios` field (line 456) and the debug readout (line 627) only.
- If WQ-001 has not landed yet, do **not** touch the `createEngine(S, { ios: isIOS, onEvent })` call
  (line 423); if it has, that argument is already gone.
- Docs pass: Q11 in `OPEN_QUESTIONS.md` gets its resolution; a `Claude (proposed)` row in
  `docs/DECISIONS.md` supersedes D-44.
- Out of scope: the axis mapping default (WQ-001); `engine.js`.

**Acceptance.**
- `npm test` passes; `tests/smoke.js` and `tests/roundtrip.js` still run under Playwright's Chromium
  (Playwright Chromium 156 on Windows, measured 2026-10-20: `requestFullscreen` exists, `'vibrate' in navigator`
  is **true**, and `DeviceMotionEvent.requestPermission` exists, so today `isIOS` is true there — check the note
  text logic and the fullscreen attempt do not throw in headless mode).
- `grep -c "isIOS" index.html` shows only the definition, the recorder field and the debug readout.
- Owner-verifiable (Pixel 11): Start goes fullscreen and locks landscape; the start screen shows the
  Android note; a new recording carries `device.ios: false`.
- Owner-verifiable (iPhone, when available): motion permission prompt still appears; the iPhone note shows.

**Verification.** `npm test`; grep output quoted; the owner-verifiable lines listed as remaining
in the completion entry.

---

### WQ-003 — Fail the replay test when `auto` disagrees with a phone's axis verdict

- **Status:** queued · **Priority:** P1 · **Size:** S · **Track:** axis · **Env:** any
- **Added:** 2026-10-20 by recordings-review session
- **Depends on:** WQ-001 · **Blocks:** —

**Context.** `tests/replay.js` (lines 101–106 at commit 87d66f1) prints an "Axis verdict" per user
agent from the `axis-up` and `axis-right` recordings, but only as INFO. The iPhone axis order is
unmeasured (Q1); when the first iPhone axis recordings arrive, the test should fail loudly if the
`auto` default (set by WQ-001) does not fit them. Rationale: `docs/PROPOSAL_2026-10-20.md` section P-3.

**Scope.**
- In `tests/replay.js`, after the per-device verdict is computed: replay that device's axis recordings
  with `axisMode: 'auto'` (no overrides) and FAIL (increment `failures`) when the mapping `auto`
  resolves to is not in the verdict set. Print which mapping `auto` chose and which fit.
- WARN (not fail) when a recording's `device.ios` disagrees with its `device.ua` (`/iP(hone|ad|od)/`).
- Keep the synthetic recordings passing (they carry `axisMode: 'spec'` after WQ-001).
- Document the new check in `docs/RECORDINGS.md` ("Drills and what the tests expect", `axis-*` rows).
- Out of scope: changing the mapping or the engine; adding recordings.

**Acceptance.**
- `npm run test:replay` still reports "all passed" on the current recordings.
- Temporarily forcing the verdict set to `['spec']` for the Pixel user agent makes the run fail with a
  message naming `auto → ios`; revert before committing (state in the entry that this was done).
- `tests/recordings/pixel-11/` recordings with `device.ios: true` and an Android user agent produce a WARN line.

**Verification.** `npm run test:replay` output quoted before and after the forced failure.

---

### WQ-004 — Build an offline gyro-axis estimator harness over the recordings

- **Status:** claimed:round-20261020-1 · **Priority:** P2 · **Size:** M · **Track:** axis · **Env:** any
- **Added:** 2026-10-20 by recordings-review session
- **Depends on:** — · **Blocks:** —

**Context.** The axis order could be estimated on the phone from gravity: in the device frame,
d**g**/dt = −**w** × **g**, and `accelerationIncludingGravity` has unambiguous axes. A quick
derivative-fit prototype on 2026-10-20 ranked x/y/z first on all 13 Pixel recordings, but the margin
over the runner-up was thin (best/runner-up residual 0.64–0.96 against 0.78–1.06). Before any run-time
use, an estimator must be built and measured offline. The specification (candidate set, estimators
E-1 to E-4, harness output, acceptance thresholds) is `docs/PROPOSAL_2026-10-20.md` section 3; treat it
as the spec and this item as the work order.

**Scope.**
- Add `tests/axis-estimate.js` (Node, no dependencies, not part of `npm test`; add an
  `npm run axis-estimate` script in `package.json`). It reads every `tdt-recording` under
  `tests/recordings/` (including `.txt` files, as `tests/replay.js` does) and runs each estimator.
- Implement E-2 (window integration, reuse the quaternion step from `engine.js` `motion()` by copying
  it — do not change `engine.js`) and E-3 (correlation matrix); keep E-1 as the baseline. Search all
  48 permutation-and-sign candidates, not just the two orders the engine supports.
- Per recording and estimator print: winning candidate, margin (runner-up score / best score, or the
  spec's definition), seconds of motion until the running decision last changed, and agreement with
  that device's axis-drill verdict where one exists.
- Write the results as a dated section in `docs/PROPOSAL_2026-10-20.md` (section 3.4 style) and a short
  "how to run" paragraph in `docs/RECORDINGS.md`.
- Out of scope: any change to `engine.js` or `index.html`; the E-4 live decision rule; run-time use
  (a later item after a Ricky decision, see proposal section 3.6).

**Acceptance.**
- `npm run axis-estimate` runs on a clean clone in under a minute and prints one line per recording
  per estimator.
- On every real Pixel recording longer than 5 s, at least one of E-2/E-3 ranks `xyz` (no flips) first.
- On every synthetic recording, the same estimator ranks `spec` (no flips) first.
- The report states, per estimator, the minimum margin over real recordings and whether the
  proposal's thresholds (margin ≥ 1.5, decision within 3 s of motion on `180-*` and `press-wobble`)
  are met; "not met" is an acceptable, recorded outcome.

**Verification.** The script's output quoted (or attached as a file under `docs/`) in the completion
entry; `npm test` still passes (unchanged).

---

### WQ-006 — Record axis and clean-press drills on an iPhone and a second Android phone

- **Status:** blocked:owner-machine · **Priority:** P1 · **Size:** S · **Track:** recordings · **Env:** owner-machine
- **Added:** 2026-10-20 by recordings-review session · **Updated:** 2026-10-20 by recordings-review session (added the jig drift drill per D-49)
- **Depends on:** — · **Blocks:** —

**Context.** Everything measured so far comes from one Pixel 11. Three open points need a second
phone each: the iPhone gyro axis order (Q1), whether the iOS misdetection also affects other
Android phones (Q11), and whether the missing touch contact size (`CLAUDE.md`, "Contact size") is
Pixel-specific. Three short drills per phone answer all three.

**Scope.** On each additional phone (an iPhone; any non-Pixel Android), from the deployed HTTPS page:
- Record `axis-up`, `axis-right` and `clean-press` as described in `docs/RECORDINGS.md`, with the phone
  model in the notes field.
- Also record the jig drift drill (D-49): a `free` drill, phone placed on a fixed jig at the start, tap
  **Set downrange**, swing hard for about 90 s, return to the jig and hold still 10 s, swing again, and
  end on the jig held still for 10 s. The analysis reads the 180 deviation at the rests (under 10° in
  3 minutes closes the question for that phone; more re-opens `docs/IDEAS.md` I-02).
- Save them into a new folder named after the phone (for example `tests/recordings/iphone-15/`,
  `tests/recordings/galaxy-s24/`) and commit.
- Then (agent-verifiable half, any session): run `npm run test:replay`; record the per-phone axis
  verdict in `OPEN_QUESTIONS.md` Q1; record `device.ios` versus user agent (Q11) and whether any
  touch row has a non-zero radius (contact size) in `CLAUDE.md` "Known platform facts". If an iPhone
  verdict is `spec`, raise a new item to key the `auto` default on the browser engine.
- Out of scope: changing the engine or the page.

**Acceptance.**
- Owner-verifiable: the three drill recordings and the drift recording per phone exist under a per-phone folder.
- Agent-verifiable: `npm run test:replay` passes (or WQ-003's guard fails and a follow-up item is
  raised); Q1, Q11 and the contact-size note are updated with the measured facts.

**Verification.** The "Axis verdict" lines for each phone quoted in the completion entry.

---

### WQ-007 — Exclude shots fired during an alarm from the summary percentages (D-45)

- **Status:** queued · **Priority:** P2 · **Size:** S · **Track:** grading · **Env:** any
- **Added:** 2026-10-20 by recordings-review session · **Updated:** 2026-10-20 by recordings-review session (Ricky chose option 2 → D-45; re-queued)
- **Depends on:** — · **Blocks:** —

**Context.** Q5 asked whether a shot fired during an alarm should count differently. The two
`press-wobble` recordings in `tests/recordings/pixel-11/` show the real case: 5 of 5 shots fired
within 0.3 s of a movement alarm, all graded Jerked (8°–50°). The summary (`TDT.summarize`,
`engine.js`; D-39) shows "shots during an alarm" as a separate count but includes them in the shot
total and the Clean / Moved / Jerked percentages. Ricky decided (D-45): keep them counted, graded and
plotted, but exclude them from the percentages and the "steadiest press" stat.

**Scope.**
- `engine.js` `summarize(state)`: the Clean / Moved / Jerked counts and percentages, the average
  movement and the "steadiest" value use only shots whose `duringAlarm` (or equivalent flag — verify
  the field name in the shot record and `state.tally`) is false. The total shot count, the
  "shots during an alarm" line and the plot keep every shot. If the tally does not yet separate
  grades by alarm state, extend `newTally` and the place shots are tallied; this is a summary-only
  change, so no `shot` event changes and no `VERSION` bump (D-20).
- `index.html` `showSummary()`: label the percentage rows so it is clear they exclude alarmed shots
  (for example "of N shots with no alarm").
- `tests/smoke.js`: extend or add a case that fires one clean shot and one shot during an alarm and
  checks the summary numbers.
- Docs pass: D-39's description in `docs/DECISIONS.md` gets a note pointing at D-45; `docs/CLASS_USE.md`
  if it describes the summary percentages.
- Out of scope: alarm thresholds (Q2, WQ-010); the engine's shot event or grading.

**Acceptance.**
- `npm test` passes, with the new smoke case.
- Replaying `tests/recordings/pixel-11/tdt-press-wobble-2026-10-20-21-50-38.json` and calling
  `TDT.summarize` gives 3 shots total, 3 during an alarm, and percentages computed over 0 no-alarm
  shots (shown as "—", not NaN).
- `npm run test:replay` output is unchanged (no `VERSION` bump).

**Verification.** `npm test`; the summary numbers from the replay above quoted in the completion entry.

---

### WQ-009 — Remove the contact-size (flat-finger) check (D-46)

- **Status:** claimed:round-20261020-1 · **Priority:** P1 · **Size:** S · **Track:** grading · **Env:** any
- **Added:** 2026-10-20 by recordings-review session
- **Depends on:** — · **Blocks:** —

**Context.** Ricky decided (D-46, 2026-10-20) that a touch inside the frame strip is "finger on
frame" and that the contact-size check goes away; the flat-finger concept is taught outside the
tool. The check never worked on the Pixel 11 anyway (every touch reports radius 0; `CLAUDE.md`
"Contact size"). Anchors at commit 1caad13.

**Scope.**
- `engine.js`: remove `requireFlat` and `minContactPx` from `DEFAULTS` (lines 27–28), the
  `sizeSupported` / `lastRestSize` state (line 123) and the two lines in `touches()` that set and use
  them (lines 212–213). Keep `rx`/`ry` in the recording row format (D-18) so old recordings still parse;
  `fromTouch` / `packTouches` / `unpackTouchList` are unchanged. No output changes for any existing
  recording (none has `requireFlat: true`), so no `VERSION` bump; state that in the entry after checking
  `grep -l '"requireFlat":true' tests/recordings -r`.
- `index.html`: remove the `requireFlat` checkbox (line 222), the `minContactPx` slider (line 693), the
  two `requireFlat` entries in the checkbox wiring (lines 723, 731), and the `liveContact` readout
  (lines 755–756) with its element. Settings saved under `tdt.settings.v1` may still contain the two
  keys; ignore them (do not bump the storage key).
- `tests/smoke.js` and `tests/roundtrip.js`: remove any use of the two settings; `window.__tdt()` may
  drop `sizeSupported` / `lastRestSize`.
- Docs pass: `CLAUDE.md` — hard constraint 4 keeps "true finger-flatness detection is not required";
  drop the "Contact size" bullet under "Known platform facts" and the "flat-finger check" mention in
  the `touches` row of the engine table; `docs/CLASS_USE.md` if it mentions the setting; D-06 in
  `docs/DECISIONS.md` is already marked superseded.
- Out of scope: the frame-strip geometry (`ZONES`), debounce timing, anything in WQ-007 or WQ-010.

**Acceptance.**
- `npm test` passes; `npm run test:replay` prints the same events as before for every recording.
- `grep -rn "requireFlat\|minContactPx\|sizeSupported\|lastRestSize" engine.js index.html tests/*.js`
  finds nothing.
- Owner-verifiable (any phone): Settings no longer shows the checkbox, slider or contact readout.

**Verification.** `npm test`; the grep output quoted in the completion entry.

---

### WQ-010 — Lower the `jerkMs` default to 300 ms (D-47)

- **Status:** claimed:round-20261020-1 · **Priority:** P1 · **Size:** S · **Track:** grading · **Env:** any
- **Added:** 2026-10-20 by recordings-review session
- **Depends on:** — · **Blocks:** —

**Context.** Ricky decided (D-47, 2026-10-20) to reduce the movement allowance during a press from
500 ms to 300 ms "for now". Measured before queuing: replaying every Pixel 11 recording with
`jerkMs: 300` changes the event sequence in `tdt-press-wobble-2026-10-20-21-49-46.json`,
`tdt-press-wobble-2026-10-20-21-50-38.json` (alarm/shot order) and `tdt-free-2026-10-20-22-40-27.json`
(one extra alarm); the other 11 are identical, and every drill expectation still passes.

**Scope.**
- `engine.js` `DEFAULTS.jerkMs` 500 → 300 (line 22 at commit 1caad13); update the comment.
- Bump `VERSION` (D-20) and `package.json` `version`: outputs change for the same inputs when the
  recording's settings omit `jerkMs`. Note that recordings carry their own `settings`, so the three
  files above still replay with 500 ms and their live-equals-replay check still passes; the bump is
  for the default itself.
- `index.html` line 683: the slider's range (100–1500, step 50) stays; only the default moves.
- Docs pass: the "State machine" paragraph in `CLAUDE.md` mentions `jerkMs`; `docs/CLASS_USE.md` and
  `docs/RECORDINGS.md` where they quote 500 ms; D-35 in `docs/DECISIONS.md` already notes D-47.
- Out of scope: `moveDps`, `moveAcc`, `graceMs`, `steadyDeg` (Q2); the alarm logic itself.

**Acceptance.**
- `npm test` passes; `npm run test:replay` reports "all passed", and the completion entry names which
  recordings the entry's author re-ran with `jerkMs: 300` overridden and what changed (expected: the
  three files above).
- `grep -rn "500 ms\|jerkMs: 500" CLAUDE.md docs index.html engine.js` finds no stale default.

**Verification.** `npm test`; `npm run test:replay`; a one-off replay with `TDT.replay(rec, { jerkMs: 300 })`
over `tests/recordings/pixel-11/` quoted in the entry.

---

## Parking lot

Ideas noted but not yet turned into items (an exploratory session may
promote one with `work-queue-add`):

- **Run-time axis estimation (advisory, then auto with a confidence gate).** Waits on WQ-004's
  numbers and a Ricky decision; path in `docs/PROPOSAL_2026-10-20.md` section 3.6.
- **Q2, default thresholds for beginners.** Needs labelled drills from several students; first data
  point: one `clean-press` shot at 0.70° against the 0.75° Clean limit (Pixel 11, 2026-10-20).
- **Q3 / Q4, zone layout and stray palm contact.** Needs class observation with the debug readout on;
  fallback is `docs/IDEAS.md` I-01 (per-student layout calibration).
- **Re-record the three `safe-move` drills with the current engine.** The 0.6.0 recordings still pass
  with current defaults; only worth doing so every real recording has a live-equals-replay check.
- **Operating modes on the start screen** (`docs/IDEAS.md` I-03, Ricky). Waiting for Ricky to list the modes.
- **`CLAUDE.md` says recordings go "one folder per phone"** — the 2026-10-20 set has been moved to
  `pixel-11/`; nothing left to do unless a second Pixel appears.
