# Ideas

Things worth exploring later that nobody has committed to yet. Nothing here is planned or built. Adding a
row is cheap; it doesn't need Ricky's approval.

## Which file?

| It's… | Put it in |
|---|---|
| A "might be nice", a possible feature, or an experiment to try someday | `docs/IDEAS.md` (here) |
| A question that blocks or shapes current work, or needs a phone test to answer | `OPEN_QUESTIONS.md` |
| Something decided, or a choice that has been implemented | `docs/DECISIONS.md` |

## Workflow

1. **Add** a row with the next `I-` number (never reuse one). Source uses the same tags as
   `docs/DECISIONS.md`: `Ricky` or `Claude`. Status starts as `parked`.
2. **Explore** when someone starts looking into it (prototype, recording, research): set `exploring` and add
   notes or links in the Notes column.
3. **Close** it one of three ways, keeping the row so the history stays:
   - `promoted to D-xx` when Ricky decides to build it (log the decision in `docs/DECISIONS.md`),
   - `moved to Q-xx` when it turns into a question that needs answering first (add it to `OPEN_QUESTIONS.md`),
   - `dropped` with a one-line reason in Notes.

Claude never builds an idea straight from this list; it goes through a Ricky decision first. Ideas must still
fit the hard constraints in `CLAUDE.md` (static files, no data leaves the phone, free, no accounts); note
any conflict in the row instead of dropping the idea silently.

Status: `parked`, `exploring`, `promoted to D-xx`, `moved to Q-xx`, `dropped`.

| ID | Idea | Why it might help | Source | Status | Notes |
|---|---|---|---|---|---|
| I-01 | Per-student layout calibration (hold the phone, touch where the frame and trigger naturally fall) | Hands and phones vary; fixed `ZONES` may not fit everyone | Claude | parked | Fallback mentioned in OPEN_QUESTIONS Q3; only worth it if class testing shows the fixed layout fails |
| I-02 | Gravity correction for the up/down part of the 180 orientation | Cancels gyro drift over long drills | Claude | parked | Fallback mentioned in OPEN_QUESTIONS Q10; only needed if recordings show large drift |
