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
| I-02 | Gravity correction for the up/down part of the 180 orientation | Cancels gyro drift over long drills | Claude | parked | Waiting (D-49, Ricky 2026-10-20). Pixel 11 drifts under 2.5° over 3 minutes of hard swinging. Build only if a phone drifts more than about 10° in the jig drift drill (WQ-006), and only after that phone's axis verdict is known: gravity fixes pitch/roll only, not heading, and fights the gyro if the axis mapping is wrong. iPhone 15 (D-61): 9° after a 93 s jig run, under the limit; I-05 traced it to a motion gap at the iOS portrait flip (Q16, WQ-014), not to bias drift; 3-minute run pending |
| I-03 | Operating modes, picked on the start screen. Today's behavior becomes **Freeform Training**; other modes could be specific drills or games | More structure and variety for class: guided drills, scored challenges | Ricky | parked | Ricky will add specific modes to this row later |
| I-04 | Hold landscape through momentary portrait reports while armed: pause only once portrait has persisted for a few seconds, or once the gravity vector confirms it | iPhone Safari reports portrait during hard swings and the page disarms (Q15); iOS cannot lock orientation from a web page | Claude | promoted | Promoted to WQ-013 by D-60 (Ricky, 2026-10-21: option 2 of Q15, 3 s hold). From the iPhone 15 recordings (D-58). Caution: the trace's yaw sign (`upSign` in `motion()`) also reads the screen angle, so whatever holds landscape must hold the angle fed to the engine too |
| I-05 | Locate the iPhone 15 orientation error inside the first swing set of its drift drill: replay `tdt-free-2026-10-21-03-38-03.json` and compare the integrated pitch/roll with the gravity vector at every brief slow-down, to see whether the 9° appears in one fast swing (peak 569 °/s, about 9.5° per 60 Hz sample) or accumulates. If it is a per-sample step error, a higher-order quaternion step or sample interpolation would fix it where gravity correction (I-02) cannot (heading) | Decides whether the 9° on the iPhone is bias drift (I-02 territory) or an integration artefact | Claude | promoted to D-62 | Done 2026-10-21; Q16 answered yes, fix queued as WQ-014. I-05 result (2026-10-21, offline re-integration of the recording): the whole 9° comes from the 123 ms `devicemotion` gap at the first iOS portrait flip (13.64 s), which fell in a fast deceleration (177 °/s before the gap, 63 °/s after). `motion()` credits the gap with the new sample's rate over `MAX_DT_S` = 100 ms (6.3°) where the phone turned about 15°, and the error is pitch/roll (10.3° against gravity), not heading. The per-sample integration is not the cause: a trapezoid step over normal 17 ms samples changes the rests by under 0.3° on the Pixel 11. Bridging gaps with the mean of the rates before and after over the full gap brings the iPhone rests from 9.2°/8.5°/8.6° to 2.7°/3.3°/1.6° and leaves the Pixel 11 at 1.6°/1.2°/0.6°; shortening the credited gap (40 ms, 17 ms or 0) makes it worse (13°–23°). Fix candidate is WQ-014 (gap bridging in `motion()`), waiting on Q16; gravity correction (I-02) would also have fixed this case but not a gap during a heading swing |
