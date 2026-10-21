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
| WQ-003 | Fail the replay test when `auto` disagrees with a phone's axis verdict | P1 | S | queued | — | axis |
| WQ-006 | Record axis and clean-press drills on an iPhone and a second Android phone | P1 | S | blocked:owner-machine | — | recordings |
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

## Parking lot

Ideas noted but not yet turned into items (an exploratory session may
promote one with `work-queue-add`):

- **Run-time axis estimation (advisory, then auto with a confidence gate).** WQ-004 measured the offline
  criteria as met on the Pixel 11 (E-2, fused gravity; D-55). Waits on Q13 (Ricky) for the advisory debug
  readout, and on a second phone's recordings (WQ-006) for the auto-switch; path in
  `docs/PROPOSAL_2026-10-20.md` section 3.6.
- **Settings migration so changed defaults reach phones with saved settings** (Q12, from WQ-010). The
  class Pixel keeps `jerkMs: 500` after D-47. Becomes an item once Ricky picks an option in Q12.
- **Synthetic recordings that can identify an axis mapping** (from WQ-004). `tests/make-synthetic.js` emits
  no `accelerationIncludingGravity` and only `180-safe` rotates about all three axes, so the harness has to
  simulate gravity and 10 of 11 synthetic drills tie. Emit gravity and add one three-axis drill; then drop the
  simulation from `tests/axis-estimate.js`.
- **Q2, default thresholds for beginners.** Needs labelled drills from several students; first data
  point: one `clean-press` shot at 0.70° against the 0.75° Clean limit (Pixel 11, 2026-10-20).
- **Q3 / Q4, zone layout and stray palm contact.** Needs class observation with the debug readout on;
  fallback is `docs/IDEAS.md` I-01 (per-student layout calibration).
- **Re-record the three `safe-move` drills with the current engine.** The 0.6.0 recordings still pass
  with current defaults; only worth doing so every real recording has a live-equals-replay check.
- **Operating modes on the start screen** (`docs/IDEAS.md` I-03, Ricky). Waiting for Ricky to list the modes.
- **`CLAUDE.md` says recordings go "one folder per phone"** — the 2026-10-20 set has been moved to
  `pixel-11/`; nothing left to do unless a second Pixel appears.
