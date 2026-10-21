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

