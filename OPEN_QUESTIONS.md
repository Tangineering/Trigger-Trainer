# Open Questions

Answer these on real phones before polishing. Record answers in `docs/DECISIONS.md`. Ideas
that aren't blocking anything belong in `docs/IDEAS.md`.

| ID | Question | Why it matters | How to answer | Blocking? |
|---|---|---|---|---|
| Q1 | Do the aim-trace directions come out right on iPhone and Android? | iOS may report `rotationRate` in a different axis order. Affects the trace and "low-left" labels, **and the 180 check**: with the wrong mapping an up/down swing can be read as a cant and missed. The movement alarm is unaffected. | Record **Axis check: muzzle up** and **Axis check: muzzle right** on each phone (see `docs/RECORDINGS.md`) and commit them. `npm run test:replay` prints the mapping that fits both; set the `auto` default to match. | Yes, for grading and the 180 check |
| Q2 | Are the default thresholds right for beginners? (rotation 25 °/s, linear 1.5 m/s², grace 300 ms, pull 35 px, tolerance 0.75°) | Too tight = constant false alarms; too loose = no teaching value. | Record labeled drills from several students; tune thresholds until `npm run test:replay` passes on all of them. | No |
| Q3 | Does the zone layout match how students actually hold the phone? | The strip and trigger positions are a guess at a pistol-like grip on a phone. | Hand it to several students; adjust `ZONES`. Consider a per-user layout calibration if hands vary a lot. | No |
| Q4 | Does the palm or other fingers touch the screen and cause false "trigger" or "frame" contact? | Large phones and small hands. | Observe in class with the debug readout on. | No |
| Q5 | Should a shot fired during an alarm count differently (e.g., a safety violation)? | Currently recorded and labeled "during alarm" but counted as a shot. | Ricky's teaching preference. | No |
| Q6 | ~~Session summary~~ | Resolved: Finish button in Settings opens a summary, see D-35. | — | No |
| Q8 | ~~Finger resting on the trigger while moving~~ | Resolved: options 2 + 3 combined, see D-24. | — | No |
| Q7 | ~~Hosting location~~ | Resolved: Tangineering org, see D-15. | — | No |
| Q9 | Is ignoring roll (canting the phone about the muzzle axis) right for the 180 check? | Roll never moves the muzzle, so it can't point it uprange; "any axis" is read as any mix of left/right and up/down. (Capture point resolved by D-31: Set downrange button.) | Ricky's call. | No |
| Q10 | Does gyro drift move "downrange" noticeably over a long drill? | Orientation is integrated from the gyro, so small errors accumulate. A few degrees over minutes is harmless against a 90° limit; a lot would cause false 180s. | Record a long `free` drill holding still at the end; `npm run test:replay` prints the max deviation. If drift is large, add gravity correction for the up/down part, or tap **Reset downrange** to re-zero. | No |
