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
next_id: WQ-013
updated: 2026-10-20
```

## Index

| ID | Title | Pri | Size | Status | Depends on | Track |
|----|-------|-----|------|--------|------------|-------|
| WQ-011 | Alarm when the muzzle drifts more than 5° while the finger is off the frame (D-56) | P1 | M | queued | — | alarm |
| WQ-003 | Fail the replay test when `auto` disagrees with a phone's axis verdict | P1 | S | queued | — | axis |
| WQ-006 | Record axis and clean-press drills on an iPhone and a second Android phone | P1 | S | blocked:owner-machine | — | recordings |
| WQ-007 | Exclude shots fired during an alarm from the summary percentages (D-45) | P2 | S | queued | — | grading |
| WQ-012 | Show the run-time gyro-axis estimate in the debug readout (D-57) | P2 | M | queued | — | axis |

Status values: `queued` · `claimed:<session or round>` · `blocked:<what>` ·
`blocked:user` (needs a decision only the owner can make — the item says which)
· `blocked:owner-machine` (needs data, hardware or a platform only the owner
has — the item says exactly what to run).

Mechanical edits (claim, un-claim, archive, invariant check) go through
`python scripts/wq.py …`; see `work-queue-run`. On Ricky's PC the interpreter is
`C:\Users\ricky\.local\bin\python.exe` (the `python` alias on PATH is the Microsoft Store stub).

Tracks: axis · platform · recordings · grading · alarm · layout · decisions · docs

---

## Items

### WQ-011 — Alarm when the muzzle drifts more than 5° while the finger is off the frame (D-56)

- **Status:** queued · **Priority:** P1 · **Size:** M · **Track:** alarm · **Env:** any
- **Added:** 2026-10-20 by orchestration session
- **Depends on:** — · **Blocks:** —

**Context.** Ricky observed in use (2026-10-20) that with the finger off the frame, slow continuous movement
never alarms: the off-frame alarm in `engine.js` `tick()` (line 313 at commit 139dc5f) fires only when the
rate EMAs exceed `moveDps` (25 °/s) or `moveAcc`, so a slow sweep stays under both. Decision D-56: while the
finger is off the frame the muzzle may deviate at most 5° (default) from where it pointed when the finger
left the frame, ignoring twist about the barrel axis; a larger deviation alarms, and the alarm holds until
the finger is back on the frame. The rate-based alarm stays. The engine already integrates orientation as a
quaternion `st.q` (`motion()`, line 181–185) and has a roll-invariant deviation helper, `deviation180()`
(line 189), which measures the angle between the muzzle (device y) now and at the reference pose.

**Scope.**
- `engine.js` `DEFAULTS`: add `offFrameDeg: 5` next to `graceMs` (line 21); comment it.
- State (`st`, line 121–125): add `qOff: null` (orientation quaternion when the finger left the frame) and
  `devOff: 0` (current deviation from it, deg, 0 while on the frame).
- Reference capture in `tick()`: when `onRest` turns false (line 271, where `offSince` is set), set
  `st.qOff = st.q.slice()`. Clear it when `onRest` turns true again. Also re-capture (`st.qOff = st.q.slice()`)
  whenever the orientation integration is reset while off the frame: `setDownrange()` (line 344–345 sets
  `st.q = [1,0,0,0]`) and the motion-gap reset in `motion()` (line 137). Note `st.q` is relative to the last
  `setDownrange()`, so the relative rotation must be computed, not the absolute pose.
- Deviation: add `deviationFrom(qRef)` beside `deviation180()`: relative quaternion `qRel = conj(qRef) · st.q`,
  then the same roll-invariant angle formula as `deviation180()` applied to `qRel` (angle between `qRel·ŷ` and
  `ŷ`). Compute `st.devOff` on every tick while `qOff` is set (0 otherwise), before the alarm block (line 289 is
  where `dev180` is computed).
- Alarm: in the off-frame block (lines 310–318), alarm when `st.devOff > S.offFrameDeg` after `graceMs` has
  elapsed since `offSince` (the grace covers the lift jolt; the reference is still the pose at the moment of
  leaving, per D-56). Apply it in every off-frame state — on the trigger and during a press as well (D-34's jerk
  allowance covers the rate/time rule; a 5° muzzle deviation during a press is a gross error) — and record this
  reading as `Claude (proposed)` in `docs/DECISIONS.md`. Use `reason: 'move'` (same sound and overlay) and add
  `devOff` to the `alarmStart` event payload. The alarm clears exactly as today (finger back on the frame).
- Bump `VERSION` (0.9.0 → 0.10.0) and `package.json`: outputs change for the same inputs.
- `index.html`: add an `offFrameDeg` slider to the Movement group in `SLIDERS` (line 675; `graceMs` is at 679):
  label "Max muzzle drift off the frame", 1–20°, step 1, help "Slow movement past this angle alarms even when the
  rate thresholds are not reached (D-56)." Show `devOff` in the debug readout line that prints `180 …` (line 626).
- `tests/smoke.js`: add a case: finger leaves the frame, then a slow yaw (`rotationRate.alpha` ≈ 8 °/s, below
  `moveDps`) for about 1 s → no alarm at 4° and an alarm once past 5°; finger back on the frame clears it. Also a
  case that a slow 4° drift followed by stillness does not alarm.
- `tests/expectations.js`: check that `off-frame-still` still expects no alarm and `off-frame-move` an alarm;
  adjust only if the synthetic rotation rates make a label's expectation change, and say so.
- Docs pass: `CLAUDE.md` Behavior spec (append a bullet for D-56) and the "State machine" paragraph; `docs/CLASS_USE.md`
  where it explains the off-frame alarm; `docs/RECORDINGS.md` "Drills and what the tests expect" if the
  off-frame rows mention rates only. Add the `Claude (proposed)` row described above to `docs/DECISIONS.md`.
- Out of scope: the rate thresholds `moveDps` / `moveAcc` / `graceMs` (Q2); the 180 rule; the press jerk rule
  (D-34, D-47); the summary (WQ-007); the axis estimate readout (WQ-012).

**Acceptance.**
- `npm test` passes with the new smoke cases.
- `npm run test:replay` reports "all passed"; the completion entry lists which real recordings in
  `tests/recordings/pixel-11/` change their event sequence when replayed with `{ offFrameDeg: 5 }` overridden
  (their own `settings` lack the key, so the plain replay uses the new default: name every recording whose
  live-equals-replay check moved from "matches" to a difference, and confirm each difference is a new or
  earlier move alarm during a slow off-frame drift, not a lost shot or a lost alarm).
- Replaying `tests/recordings/synthetic/off-frame-still.json` gives no alarm; `off-frame-move.json` still alarms.
- Owner-verifiable (Pixel 11): finger off the frame, a slow sweep of about 10° alarms within a second of
  passing 5°; holding still off the frame does not alarm; twisting the phone about the barrel axis alone does
  not alarm.

**Verification.** `npm test`; `npm run test:replay` before and after (quote the per-recording lines that
changed); the `VERSION` bump and the DECISIONS row named in the entry.

---

### WQ-003 — Fail the replay test when `auto` disagrees with a phone's axis verdict

- **Status:** queued · **Priority:** P1 · **Size:** S · **Track:** axis · **Env:** any
- **Added:** 2026-10-20 by recordings-review session
- **Depends on:** — · **Blocks:** —

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

### WQ-006 — Record axis and clean-press drills on an iPhone and a second Android phone

- **Status:** blocked:owner-machine · **Priority:** P1 · **Size:** S · **Track:** recordings · **Env:** owner-machine
- **Added:** 2026-10-20 by recordings-review session · **Updated:** 2026-10-20 by iPhone-15 analysis session (iPhone half done; second Android phone remains)
- **Depends on:** — · **Blocks:** —

**Progress.** The iPhone half is done. `tests/recordings/iphone-15/` holds all twelve drills (axis, clean-press, the
drift `free` run, and the rest), and the analysis half ran for that phone: Q1 closed (axis verdict `ios`, D-58), Q11
and the contact-size fact are in `CLAUDE.md` "Known platform facts", and the drift drill reads 8.5–9.3° at its rests
(Q10; under D-49's 10° limit, but a 93 s run with no jig confirmation). Two findings went to `OPEN_QUESTIONS.md`
rather than this item: its `clean-press` failed on its first shot (Moved at 0.96°; Q14, settled by trimming that press
out of the file, D-59) and iOS flips to portrait and disarms during hard swings (Q15, I-04). Remaining: the second (non-Pixel) Android phone, plus a
jig-confirmed 3-minute drift run on the iPhone if Ricky's Q10 answer calls for one.

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

### WQ-012 — Show the run-time gyro-axis estimate in the debug readout (D-57)

- **Status:** queued · **Priority:** P2 · **Size:** M · **Track:** axis · **Env:** any
- **Added:** 2026-10-20 by orchestration session (from WQ-004's follow-up (c); Q13 answered yes → D-57)
- **Depends on:** — · **Blocks:** —

**Context.** WQ-004 measured offline (D-55, `docs/PROPOSAL_2026-10-20.md` section 3.7) that estimator E-2 with
fused gravity (`accelerationIncludingGravity − acceleration`) ranks the x/y/z order first on all 15 Pixel 11
recordings, minimum margin 11.47, decision within 0.7 s of motion. Ricky decided (D-57): show that estimate in
the debug readout, advisory only — the engine keeps using `axisMode` (D-52). This collects the evidence for a
later auto-switch (proposal 3.6 steps 2–3) without changing behaviour. The reference implementation is
`tests/axis-estimate.js` (E-2, `fused` gravity source, candidate table and quaternion step).

**Scope.**
- `engine.js`: add a running E-2 estimator fed from `motion(m)` (line 135 at commit 139dc5f; `m` carries
  `ax, ay, az` = `acceleration` and `gx, gy, gz` = `accelerationIncludingGravity`). Port the E-2 window
  integration from `tests/axis-estimate.js` (0.5 s windows, step 0.25 s, all 48 candidates, fused gravity;
  skip windows where `acceleration` is null, as on a phone that does not report it). Keep a running residual
  sum per candidate and expose `st.axisEst = { cand, margin, motionS, windows }` (best candidate name as the
  harness prints it — `xyz`, `spec`, or the signed permutation — runner-up/best margin, seconds of motion
  seen, windows counted); `null` until the first window completes. Reset it in `resetStats()` and on the
  motion-gap reset (line 137). The estimator must not read or change `axisMode()` and must emit no events: engine
  outputs for the same inputs are unchanged, so no `VERSION` bump (state the `npm run test:replay` diff is empty).
- Keep it cheap: one quaternion step per sample is already done for `st.q`; the 48-candidate window
  comparison runs once per 0.25 s, not per sample.
- `index.html`: in the debug readout (line 626 area), add a line `axis est <cand> ×<margin> (<motionS>s)` or
  `axis est —` when `null`; nothing outside the debug readout changes.
- `tests/replay.js`: after replaying each recording, print one INFO line with `state.axisEst` for recordings
  longer than 5 s (no pass/fail).
- Docs pass: `CLAUDE.md` engine table (`motion` row) and the "Gyro axis order" bullet; `docs/RECORDINGS.md`
  "how to run" paragraph gets a sentence that the same estimate is live in the debug readout; `docs/PROPOSAL_2026-10-20.md`
  section 3.6 marks step 1 as done.
- Out of scope: changing which mapping the engine uses; any confidence gate or auto-switch; the Settings panel;
  `tests/axis-estimate.js` itself.

**Acceptance.**
- `npm test` passes; `npm run test:replay` output is identical to before apart from the new INFO lines (diff
  quoted in the entry) — no `VERSION` bump.
- Replaying every `tests/recordings/pixel-11/` recording longer than 5 s ends with `state.axisEst.cand === 'xyz'`
  and `margin ≥ 1.5` (list them with their margins; the 4.5 s `safe-move` recordings may be `null`).
- Synthetic recordings (no gravity) end with `axisEst === null` and otherwise unchanged events.
- Owner-verifiable (Pixel 11): with the sensor readout on, after a few seconds of handling the line reads
  `axis est xyz ×<n>` with n above 1.5.

**Verification.** `npm test`; the per-recording `axisEst` lines quoted in the entry; the empty replay diff.

---

## Parking lot

Ideas noted but not yet turned into items (an exploratory session may
promote one with `work-queue-add`):

- **Auto-switch of the axis mapping with a confidence gate** (proposal 3.6 steps 2–3). The advisory
  readout is WQ-012 (D-57); the switch waits for a second phone's recordings (WQ-006) and a Ricky decision.
- **Settings migration so changed defaults reach phones with saved settings** (Q12, from WQ-010). The
  class Pixel keeps `jerkMs: 500` after D-47. Becomes an item once Ricky picks an option in Q12.
- **Synthetic recordings that can identify an axis mapping** (from WQ-004). `tests/make-synthetic.js` emits
  no `accelerationIncludingGravity` and only `180-safe` rotates about all three axes, so the harness has to
  simulate gravity and 10 of 11 synthetic drills tie. Emit gravity and add one three-axis drill; then drop the
  simulation from `tests/axis-estimate.js`.
- **Q2, default thresholds for beginners.** Needs labelled drills from several students; first data
  points: one `clean-press` shot at 0.70° against the 0.75° Clean limit (Pixel 11, 2026-10-20) and the first iPhone 15
  `clean-press` shot at 0.96° (trimmed out of the recording, D-59; the figure is from the untrimmed file).
- **Q3 / Q4, zone layout and stray palm contact.** Needs class observation with the debug readout on;
  fallback is `docs/IDEAS.md` I-01 (per-student layout calibration).
- **Re-record the three `safe-move` drills with the current engine.** The 0.6.0 recordings still pass
  with current defaults; only worth doing so every real recording has a live-equals-replay check.
- **Operating modes on the start screen** (`docs/IDEAS.md` I-03, Ricky). Waiting for Ricky to list the modes.
- **`CLAUDE.md` says recordings go "one folder per phone"** — the 2026-10-20 set has been moved to
  `pixel-11/`; nothing left to do unless a second Pixel appears.
