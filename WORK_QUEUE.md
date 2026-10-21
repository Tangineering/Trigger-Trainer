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
next_id: WQ-017
updated: 2026-10-21
```

## Index

| ID | Title | Pri | Size | Status | Depends on | Track |
|----|-------|-----|------|--------|------------|-------|
| WQ-011 | Alarm when the muzzle drifts more than 5° while the finger is off the frame (D-56) | P1 | M | claimed:round-20261021-2 | — | alarm |
| WQ-003 | Fail the replay test when `auto` disagrees with a phone's axis verdict | P1 | S | claimed:round-20261021-2 | — | axis |
| WQ-006 | Record axis and clean-press drills on an iPhone and a second Android phone | P1 | S | blocked:owner-machine | — | recordings |
| WQ-013 | Pause on portrait only after it has persisted for 3 s (D-60) | P1 | M | claimed:round-20261021-2 | — | ui |
| WQ-015 | Store only user-changed settings so code defaults reach every phone (D-64) | P1 | S | claimed:round-20261021-2 | — | ui |
| WQ-007 | Exclude shots fired during an alarm from the summary percentages (D-45) | P2 | S | queued | — | grading |
| WQ-012 | Show the run-time gyro-axis estimate in the debug readout (D-57) | P2 | M | queued | — | axis |
| WQ-014 | Bridge `devicemotion` gaps in the 180 orientation integration (D-62) | P2 | S | claimed:round-20261021-2 | — | alarm |
| WQ-016 | Rework the frame strip, trigger guard and trigger layout; travel 60 px | P2 | M | queued | — | layout |

Status values: `queued` · `claimed:<session or round>` · `blocked:<what>` ·
`blocked:user` (needs a decision only the owner can make — the item says which)
· `blocked:owner-machine` (needs data, hardware or a platform only the owner
has — the item says exactly what to run).

Mechanical edits (claim, un-claim, archive, invariant check) go through
`python scripts/wq.py …`; see `work-queue-run`. On Ricky's PC the interpreter is
`C:\Users\ricky\.local\bin\python.exe` (the `python` alias on PATH is the Microsoft Store stub).

Tracks: axis · platform · recordings · grading · alarm · layout · decisions · docs · ui

---

## Items

### WQ-011 — Alarm when the muzzle drifts more than 5° while the finger is off the frame (D-56)

- **Status:** claimed:round-20261021-2 · **Priority:** P1 · **Size:** M · **Track:** alarm · **Env:** any
- **Added:** 2026-10-20 by orchestration session · **Updated:** 2026-10-21 by orchestration session (Ricky confirmed the limit applies during presses; no longer a Claude reading)
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
  leaving, per D-56). Apply it in every off-frame state — on the trigger and during a press as well (Ricky, D-56, 2026-10-21:
  "put the 5deg limit on trigger presses too"; D-34's jerk allowance covers the rate/time rule and stays). Use `reason: 'move'` (same sound and overlay) and add
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
changed); the `VERSION` bump named in the entry.

---

### WQ-003 — Fail the replay test when `auto` disagrees with a phone's axis verdict

- **Status:** claimed:round-20261021-2 · **Priority:** P1 · **Size:** S · **Track:** axis · **Env:** any
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
- **Added:** 2026-10-20 by recordings-review session · **Updated:** 2026-10-21 by iPhone-15 analysis session (iPhone half done; second Android phone and the iPhone 3-minute drift run remain, D-61); 2026-10-21 by orchestration session (Ricky: the second Android phone waits for later; the iPhone 3-minute drift run also waits for later (Ricky, 2026-10-21); nothing is expected from the owner until Ricky says so)
- **Depends on:** — · **Blocks:** —

**Progress.** The iPhone half is done. `tests/recordings/iphone-15/` holds all twelve drills (axis, clean-press, the
drift `free` run, and the rest), and the analysis half ran for that phone: Q1 closed (axis verdict `ios`, D-58), Q11
and the contact-size fact are in `CLAUDE.md` "Known platform facts", and the drift drill reads 8.5–9.3° at its rests
(Q10; under D-49's 10° limit, but a 93 s run with no jig confirmation). Two findings went to `OPEN_QUESTIONS.md`
rather than this item: its `clean-press` failed on its first shot (Moved at 0.96°; Q14, settled by trimming that press
out of the file, D-59) and iOS flips to portrait and disarms during hard swings (Q15, I-04). Remaining: the second (non-Pixel) Android phone, plus the
full 3-minute jig drift run on the iPhone 15 (D-61: the 93 s run was on a jig and read 9°, so the long run
decides whether I-02 opens for that phone).

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

### WQ-013 — Pause on portrait only after it has persisted for 3 s (D-60)

- **Status:** claimed:round-20261021-2 · **Priority:** P1 · **Size:** M · **Track:** ui · **Env:** any
- **Added:** 2026-10-21 by iPhone-15 analysis session (Q15 answered → D-60; promotes `docs/IDEAS.md` I-04)
- **Depends on:** — · **Blocks:** —

**Context.** On the iPhone 15 a hard swing makes iOS report portrait for 1.5–3.8 s (screen angle 0,
viewport 393×694 instead of 852×321), and `index.html` then pauses and disarms the engine at once:
`tick()` passes `isPortrait()` (`innerHeight > innerWidth`, line 374) into `setEnginePaused(...)` (line 555).
It happened mid-swing in `180-break` (6.0–7.5 s), in `safe-move` (2.7–4.4 s) and twice in `free`
(13.6–15.5 s and 81.8–85.6 s) of `tests/recordings/iphone-15/` (the `p` rows in those files), and once on
the Pixel 11 (`tests/recordings/pixel-11/tdt-free-2026-10-20-22-40-27.json`, 34.7 s). While paused the 180
alarm cannot start and the student must put the finger back on the frame to re-arm, so a 180 drill on an
iPhone can disarm in the middle of the swing it should catch. iPhone Safari cannot lock orientation (no
`requestFullscreen`). Ricky chose option 2 of Q15: keep landscape until portrait has persisted for 3 s (D-60,
refining D-13). Motion samples resume after a 98–123 ms gap at each flip; what that gap does to the 180
orientation is WQ-014's problem, not this item's. The engine is not involved: `engine.js` never reads the orientation, only the
`angle` field of each motion sample and the touch coordinates the page feeds it.

**Scope.** `index.html` only; `engine.js` unchanged (no `VERSION` bump: same inputs give the same outputs).
- Add a page constant `PORTRAIT_HOLD_MS = 3000` next to `REC_MAX_MS`. In `tick()` replace the `isPortrait()`
  term of the `setEnginePaused` call (line 555) with a held flag: the first portrait frame starts a timer
  (from the frame time `t`, not `Date.now()`), the flag becomes true once portrait has lasted
  `PORTRAIT_HOLD_MS`, and any landscape frame clears both. Behaviour while paused and after the hold
  expires is exactly today's (D-13).
- While portrait is pending (reported but under 3 s), keep feeding the engine landscape inputs:
  - Motion: `onMotion` (line 520) passes `screenAngle()` into `TDT.fromDeviceMotion`; pass the last angle
    seen while landscape instead, so the trace's yaw sign (`upSign` in `engine.js` `motion()`, line 165) does
    not flip for those seconds. The recorder logs the row as fed, so recordings stay replay-exact.
  - Touches: the portrait viewport has different CSS coordinates and dimensions, and the toolbar heights make
    an exact rotation of coordinates impossible. Keep the last landscape touch list (`curTouches` plus the
    landscape `innerWidth`/`innerHeight` passed to `feedTouches`) as long as at least one touch is present;
    feed the empty list as soon as the touch count drops to zero (finger lifted → off frame as today). This
    is a `Claude (proposed)` reading of D-60: log it in `docs/DECISIONS.md`. Pressing the trigger during a
    portrait flip is not supported and need not be.
- The **Rotate to landscape** overlay: today the CSS media query (line 140, `#rotateOv.armed` in
  `@media (orientation: portrait)`) shows it the moment portrait is reported; it is a `.ui` element, so a new
  touch landing on it is filtered out by `isUi` (line 524). Show it from JS only once the hold has expired
  (toggle a class in `tick()`), and remove the media query. The `armed` toggles at lines 786 and 895 stay.
- `CLAUDE.md`: the state-machine paragraph ("rotating to portrait disarms and silences") and the
  `index.html` table row for `tick` (rAF) say that portrait must persist 3 s (D-60); the "Orientation"
  platform fact already names D-60/WQ-013. `docs/CLASS_USE.md`: adjust any sentence that says the trainer
  stops as soon as the phone is turned portrait.
- `tests/smoke.js`: add a case that emulates the flip with `page.setViewportSize` — portrait for 1.5 s
  keeps `running` and `armed` true in `window.__tdt()` and the engine unpaused (extend `__tdt()` with
  `paused: enginePaused` if needed); portrait for 3.5 s pauses and disarms; back to landscape the finger
  must return to the frame to re-arm, as today.
- Out of scope: `engine.js` (WQ-011 owns the next engine change); the debug readout (WQ-012; this item
  touches `index.html` too, so it must not run in the same round as WQ-011 or WQ-012); any gravity-based
  portrait decision (option 3 of Q15, rejected by D-60); orientation locking.

**Acceptance.**
- `npm test` passes (replay, smoke, roundtrip); `npm run test:replay` output is identical to before (no
  engine change), diff quoted in the completion entry.
- The new smoke case passes: a 1.5 s portrait emulation leaves the engine running and armed; a 3.5 s one
  pauses and disarms; the rotate overlay is hidden during the first and shown during the second.
- Owner-verifiable (iPhone 15, then Pixel 11): with the finger on the frame, swing the muzzle through
  vertical so the phone flips to portrait for a moment — no disarm, no overlay, the OK tone is not replayed,
  and the 180 drill `180-break` still alarms past 90°. Hold the phone in portrait for 4 s — the overlay
  appears and the trainer disarms as before. Record `180-break` and `free` again on the iPhone and check in
  the files that the `p` rows no longer appear at the flips.

**Verification.** `npm test`; the replay diff (empty) and the new smoke case's output quoted in the completion
entry; D-60 cited, the touch-hold reading logged as `Claude (proposed)`; the owner lines returned
`blocked:owner-machine`.

---

### WQ-015 — Store only user-changed settings so code defaults reach every phone (D-64)

- **Status:** claimed:round-20261021-2 · **Priority:** P1 · **Size:** S · **Track:** ui · **Env:** any
- **Added:** 2026-10-21 by orchestration session (Q12 answered → D-64; from WQ-010's follow-up)
- **Depends on:** — · **Blocks:** —

**Context.** `index.html` saves the whole settings object to `localStorage['tdt.settings.v1']` on every change
(`save`, line 293 at commit 7e2b132) and loads it over `TDT.DEFAULTS` at start (line 291–292). So the first time a
user touches any slider, every default of that moment is frozen on that phone: the class Pixel 11 still runs
`jerkMs: 500` after D-47 lowered the default to 300 (WQ-010), and every later default change (the 5° limit of
WQ-011, Q2 tuning) would be lost the same way. Ricky decided (D-64, Q12 option 3): persist only the settings
the user changed, so untouched settings always follow the code's defaults, and "Restore defaults" clears every
stored change.

**Scope.** `index.html` only; `engine.js` unchanged (no `VERSION` bump).
- New storage key `KEY = 'tdt.settings.v2'` (line 290). The stored value is an object holding only the keys
  whose value differs from `DEFAULTS` (compare with `!==`; all settings are numbers, booleans or short strings).
- `save()` (line 293): build that diff from `S` and `DEFAULTS` and store it; store nothing (remove the key)
  when the diff is empty. The `S` object itself stays a full merged object (`Object.assign({}, DEFAULTS, diff)`),
  so every reader of `S` is unchanged. The slider `input` handler (line 714) and the checkbox `change` handler
  (line 728) keep calling `save()`; moving a slider back to its default value therefore drops the key.
- Load (line 291–292): `S = Object.assign({}, DEFAULTS, stored v2 diff)`. Ignore keys that are not in
  `DEFAULTS`.
- One-time migration of a `tdt.settings.v1` save (`Claude (proposed)`, log it in `docs/DECISIONS.md`): when no
  `v2` key exists and a `v1` object does, keep from it only the keys that are in `DEFAULTS` and differ from the
  current default, except `jerkMs` when it equals 500 (the only default that changed since `v1` saves began,
  D-47, so a stored 500 is the old default, not a user choice); write the result as `v2` and remove `v1`. Wrap
  all of it in the same try/catch style as today (the page must work without `localStorage`, constraint 3).
- **Restore defaults** (line 732): also remove the `v2` key (and any leftover `v1`) rather than storing a copy
  of `DEFAULTS`; the rest of the handler stays.
- `tests/smoke.js` line 36 reads `tdt.settings.v1`: change it to the `v2` key and the diff shape (after moving
  the volume slider to 0.35, the stored object is exactly `{ volume: 0.35 }`). Add checks: reload the page and
  the volume is still 0.35; set the slider back to the default and the key is gone; a seeded `v1` object
  `{ jerkMs: 500, volume: 0.35, requireFlat: true }` migrates to `{ volume: 0.35 }`; "Restore defaults" after a
  change removes the key.
- Docs pass: `CLAUDE.md` `index.html` table, `S` row (new key, diff semantics, "Restore defaults" clears the
  store); `docs/CLASS_USE.md` where it mentions Settings persisting or "Restore defaults".
- Out of scope: `engine.js`; any new setting (WQ-011 adds `offFrameDeg` and needs no change here); the
  Settings layout. This item touches `index.html`, so it never runs in the same round as another
  `index.html` item (WQ-011, WQ-013, WQ-007, WQ-012).

**Acceptance.**
- `npm test` passes with the new smoke checks; `npm run test:replay` output is identical to before (diff
  quoted in the completion entry).
- `grep -n "tdt.settings.v1" index.html` finds only the migration code.
- Owner-verifiable (Pixel 11 with its old saved settings): after loading the updated page once, Settings shows
  `jerkMs` at 300 while any slider you had deliberately moved keeps its value; "Restore defaults" returns every
  slider to the code defaults and a reload keeps them there.

**Verification.** `npm test`; the smoke output for the new checks and the empty replay diff quoted in the
completion entry; the migration rule logged as `Claude (proposed)`.

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

### WQ-014 — Bridge `devicemotion` gaps in the 180 orientation integration (D-62)

- **Status:** claimed:round-20261021-2 · **Priority:** P2 · **Size:** S · **Track:** alarm · **Env:** any
- **Added:** 2026-10-21 by iPhone-15 analysis session (from I-05, D-61) · **Updated:** 2026-10-21 by the same session (Q16 answered yes → D-62; 300 ms cap folded into Scope)
- **Depends on:** — · **Blocks:** —

**Context.** iOS Safari stops delivering `devicemotion` for 98–123 ms at every portrait flip (four flips in
`tests/recordings/iphone-15/`: `free` at 13.64 s and 81.84 s, `180-break` at 6.02 s, `safe-move` at 2.73 s).
`motion()` in `engine.js` (line 140) clamps each sample's `dt` to `K.MAX_DT_S` = 0.1 s and integrates the new
sample's rate over it. In the iPhone 15 drift drill the first flip fell in a fast deceleration (177 °/s before
the gap, 63 °/s after): the engine credited 6.3° where the phone turned about 15°, and the 180 orientation
carried a 9° pitch/roll error for the rest of the drill (jig rests 9.2°, 8.5°, 8.6°; D-61, I-05). The
per-sample integration itself is fine: a trapezoid step changes the Pixel 11 rests by under 0.3°, and the Pixel
set has no gaps. Offline, bridging gaps with the mean of the rates before and after over the full gap brought
the iPhone rests to 2.7°, 3.3°, 1.6° and left the Pixel 11 at 1.6°, 1.2°, 0.6°. Crediting less of the gap
(40 ms, 17 ms, none) made it worse (13°–23°).

**Decision.** D-62 (Ricky, 2026-10-21): bridge the gaps as below, with the credited gap capped at 300 ms. The
cap bounds the damage from a long stall with non-zero rates: today's rule credits at most 100 ms of rotation, and
an uncapped bridge over a 1 s gap at a 100 °/s mean could add 90° of fictitious rotation.

**Scope.** `engine.js` only.
- In `motion()`, keep the existing `dt` (clamped to `K.MAX_DT_S`) for the rate EMA and the trace (`aimH`,
  `aimV`), so the movement alarm and the shot grading are untouched.
- Add `ORIENT_BRIDGE_MS: 300` to `K` next to `ORIENT_GAP_MS` (line 60), with a comment: longest motion gap
  bridged in the 180 orientation; longer gaps are credited 300 ms and gaps over `ORIENT_GAP_MS` clear downrange.
- For the quaternion step (line 177, `ox/oy/oz`), use a separate `dtQ` = the raw gap clamped to
  `K.ORIENT_BRIDGE_MS / 1000`, and the mean of the current and previous body-frame rates (`wx, wy, wz`; store the previous triple on `st`, reset it in
  `setDownrange` and when `refSet` is cleared). First sample after downrange: `dtQ` = 0 as today.
- Bump `VERSION` (0.9.0 → 0.10.0): five recordings change the `dev` figure in their `alarmStart` rows
  (`iphone-15/180-break`, `iphone-15/free`, `pixel-11/180-break`, `pixel-11/free-…23-27-38`,
  `synthetic/180-break`); no recording changes its event count, alarm reasons or grades. Quote the
  `npm run test:replay` diff in the completion entry.
- `CLAUDE.md`: the `motion(m)` row of the engine table and the "Orientation" platform fact say that gaps
  are bridged (replace the Q16/WQ-014 reference); `docs/RECORDINGS.md` needs no change.
- Out of scope: the portrait pause (WQ-013, `index.html`); gravity correction (I-02); the off-frame drift
  alarm (WQ-011; both items touch `engine.js`, so they must not run in the same round — WQ-011's reference
  orientation would also benefit from this change, note it in the completion entry).

**Acceptance.**
- `npm test` passes; every recording keeps its expectation result and its event count.
- Replaying `tests/recordings/iphone-15/tdt-free-2026-10-21-03-38-03.json` ends with `state.dev180` under
  3.5° (today 8.6°; the offline trial without the cap read 1.6°, every real gap in the set is under 300 ms so
  the cap should not change that figure — report it); `tests/recordings/pixel-11/tdt-free-2026-10-20-23-27-38.json` under 1° (today 0.7°).
- Owner-verifiable (iPhone 15): repeat the jig drift drill for 3 minutes (WQ-006's remaining run) with the
  new engine; every rest reads under 5°.

**Verification.** `npm test`; the replay diff; the two `dev180` figures quoted in the completion entry;
the owner line returned `blocked:owner-machine`.

---

### WQ-016 — Rework the frame strip, trigger guard and trigger layout; travel 60 px

- **Status:** queued · **Priority:** P2 · **Size:** M · **Track:** layout · **Env:** browser
- **Added:** 2026-10-21 by exploratory session (Ricky's UI adjustments) · **Updated:** 2026-10-21 by the same session (guard shape specified: rear curve and a 30° rear leg joining the grip; guard front edge +20 px approved)
- **Depends on:** — · **Blocks:** —

**Context.** Ricky asked for four layout adjustments to the pistol side view (2026-10-21, verbatim):
"Increase the height of the frame safe button by 20%, keeping the slide at the same size but shifting the
trigger and trigger guard downwards." "Change the rear of the trigger guard to blend into the grip."
"Extend the frame safe button rearwards to shrink the empty space on the frame between the safe button and
the grip by half." "Shift the trigger default position forwards by 20px, and update the default travel to
60px." The "frame safe button" is the `rest` zone (`INDEX FINGER — FLAT ON FRAME`, `#restZone`). This
refines D-21 (layout), which otherwise stands. Log the request as a Ricky row in `docs/DECISIONS.md` (next
free D-number) with the quote above, and log the interpretation choices below as `Claude (proposed)` rows.

Current geometry (`engine.js:36-45`, fractions of the viewport, right-handed; left-handed mirrors x):
`slide {x .02, y .03, w .96, h .21}`, `frame {x .23, y .26, w .75, h .26}`, `grip {x .00, y .26, w .24, h .74}`,
`guard {x .26, y .51, w .30, h .38}`, `rest {x .38, y .28, w .58, h .22}`, `trigger {x .28, y .53, w .22, h .30}`.
`DEFAULTS.pullPx` is 35 (`engine.js:25`). Guard CSS: `index.html:40` (7 px `--frame` border, no top, rounded
bottom corners). Blade: `#blade` at `right: 14%` of the trigger zone, shifted by up to `pullPx * 1.2` in
`render()` (`index.html:594`). Zones are positioned by `rectFor()`/`layout()` (`index.html:399-417`).

**Scope.**
- **Rest height +20%:** `rest.h` .22 → .264 (top edge stays at y .28, so the bottom moves to .544). Grow
  `frame.h` by the same .044 (→ .304) so the strip stays inside the frame. `slide` unchanged.
- **Trigger and guard down:** move `trigger.y` and `guard.y` down by the same .044 (→ .574 and .554). Check
  that the guard bottom (.934) and trigger bottom (.874) still fit on screen and that `target`
  (`y .55, h .43`) and the guard do not overlap visibly; adjust only `target` if they do, and say so.
- **Rest extended rearwards:** the empty frame between the grip's front edge (x .24) and the rest's rear edge
  (x .38) is .14; halve it to .07 → `rest.x` .31, `rest.w` .65 (front edge stays at .96).
- **Guard rear blends into the grip (shape specified by Ricky, 2026-10-21):** the guard becomes a single
  continuous bar of the same colour and thickness as today (`--frame`, ~7–8 px), traced front to rear:
  1. front edge: straight down from the underside of the frame, at the guard zone's front edge;
  2. front-bottom corner: a rounded corner (radius about 40 px at 852 px wide);
  3. bottom: a straight run rearwards, under the trigger, to about 30% of the guard width from its rear end;
  4. rear-bottom corner: a **rear curve** (radius about 22 px) turning the bar upwards;
  5. rear leg: a straight line rising rearwards at **30° from horizontal** (Ricky, 2026-10-21; a steeper leg
     was rejected), which meets the grip's front edge at that angle. With the run from step 3 (about 30% of
     the guard width, ~88 px at 852 px wide) the rise is about 51 px, so the join sits about 63% of the
     guard height below the guard's top. Keep the 30° angle and let the join height follow from the run if
     the zone size differs. Finish with a small fillet into the grip so there is no gap, end cap or visible
     seam.
  Ricky's reference was a side photo of a typical polymer-frame pistol, where the rear of the guard sweeps up
  into the front strap at an angle; match the feel, not any particular model (constraint 5: generic imagery,
  no brand or model likeness). The guard zone therefore starts at the grip's front edge: `guard.x` .26 → .24,
  and its width grows by the .02 plus the 20 px front shift below. The shape cannot be drawn with CSS
  borders; draw it as an inline SVG path inside the `.guard` element (stretched to the zone with
  `preserveAspectRatio="none"` and `vector-effect: non-scaling-stroke`, or with the path rebuilt in `layout()`
  from the zone's pixel size — implementer's choice, logged as `Claude (proposed)`), mirrored for left-handed
  use via `.lh`. The guard stays drawing-only (not touch-sensitive).
- **Trigger 20 px forward:** move the trigger zone 20 CSS px toward the muzzle (it is fractional today;
  20 px is about .023 of an 852-px landscape iPhone 15 viewport). Preferred: a fixed pixel offset (e.g.
  `K.TRIGGER_FWD_PX = 20`) applied identically in the engine's trigger hit test (it has `vw`) and in
  `rectFor()` for the drawn zone, so touch and pixels match on every phone and in both hands. The guard's
  front edge moves forward by the same 20 px (Ricky approved, 2026-10-21) so the blade stays inside the guard;
  the rear end stays joined to the grip. Log the choice (pixel offset vs. fraction) as `Claude (proposed)`.
- **Default travel 60 px:** `DEFAULTS.pullPx` 35 → 60. Keep the Settings slider range (15–100). Check that a
  60 px pull from the blade's rest position stays plausible on a small landscape phone (667 px wide: the
  trigger zone is ~147 px) and that the blade's drawn shift (`pullPx * 1.2` = 72 px) does not run off the
  zone or into the grip; adjust the blade's resting position within the zone if needed. Because settings are
  stored as a diff since D-64 (WQ-015), the new default reaches every phone whose user never moved the slider —
  note it in the decision row. Update `CLAUDE.md`'s "Units" line ("35 px ≈ 5–6 mm") and any doc that quotes 35 px
  (`grep -rn "35 px\|35px\|pullPx" docs README.md CLAUDE.md`).
- **Tests and recordings:** zones are not stored in recordings, so the new geometry applies to every replay;
  real recordings carry their own `settings`, so the `pullPx` default only changes `synthetic/` (generated
  from `DEFAULTS` in `tests/make-synthetic.js:85`). Run `npm run test:replay` before and after; regenerate
  `synthetic/` with `node tests/make-synthetic.js` if needed. Note the overlap risk: the new rest zone
  (y up to .544, x from .31) overlaps the old trigger zone's top band (y .53–.544, x .28–.50), so a real
  trigger touch recorded high on the old trigger could now land in the rest zone. If any real recording
  changes outcome, **stop and report which ones and why** (do not edit recordings; CLAUDE.md working rules) —
  the orchestrator then decides with Ricky whether to re-record or adjust geometry. `tests/smoke.js`,
  `tests/roundtrip.js` and `tests/make-synthetic.js` touch the zone centres via `ZONES`, so they follow
  automatically; check they still hit the intended zone with the pixel offset.
- Bump `engine.js` `VERSION` (outputs change for the same inputs).
- Update the `ZONES` row in `CLAUDE.md`'s architecture table only if its wording no longer holds (append-only
  hub rule otherwise).
- Out of scope: per-student layout calibration (I-01), stray palm contact (Q4), any new setting for the trigger
  position, and anything in claimed items WQ-011, WQ-013, WQ-014, WQ-015, WQ-003 (WQ-011 and WQ-013 also
  touch `engine.js`/`index.html`, so this item must not run in parallel with them).

**Acceptance.**
- `ZONES` match the Scope figures (or documented deviations) and `DEFAULTS.pullPx` is 60; `VERSION` bumped.
- In a 852×393 and a 667×375 landscape browser viewport, right- and left-handed: the rest strip is visibly
  taller and starts closer to the grip; the slide is unchanged; the guard has a rounded front-bottom corner, a
  rear curve and a rear leg rising at 30° from horizontal into the grip, with no gap or seam; the guard's front edge
  and the trigger sit 20 px further forward than before, the blade inside the guard; the blade's full 72 px drawn travel stays on
  the gun. Screenshots attached to the completion entry.
- A touch at the drawn trigger zone's centre engages the trigger, and a touch at the drawn rest zone's centre
  arms the engine, in both hands (smoke test covers this).
- `npm test` passes; the `test:replay` before/after comparison is recorded, and no real recording changes
  outcome (otherwise the item stops per Scope).
- `docs/DECISIONS.md` has the Ricky row and the `Claude (proposed)` rows; `CLAUDE.md` Units line updated.
- *Owner-verifiable:*
  - On a real iPhone and a real Android phone, the frame strip, trigger and guard feel natural to hold in
    both hands, and a 60 px pull breaks the shot without the finger running off the trigger.

**Verification.** Run `npm run test:replay` before the change (save the output) and after; run `npm test`.
Take the four screenshots with the built-in browser or Playwright. Record in the completion entry: the final
`ZONES` values, the replay diff summary (which recordings changed outcome — expected none), the new
`VERSION`, the D-numbers added, and the screenshots.

---

## Parking lot

Ideas noted but not yet turned into items (an exploratory session may
promote one with `work-queue-add`):

- **Auto-switch of the axis mapping with a confidence gate** (proposal 3.6 steps 2–3). The advisory
  readout is WQ-012 (D-57); the switch waits for a second phone's recordings (WQ-006) and a Ricky decision.
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
