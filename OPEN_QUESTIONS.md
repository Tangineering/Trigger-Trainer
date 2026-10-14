# Open Questions

Answer these on real phones before polishing. Record answers in `docs/DECISIONS.md`.

| ID | Question | Why it matters | How to answer | Blocking? |
|---|---|---|---|---|
| Q1 | Do the aim-trace directions come out right on iPhone and Android? | iOS may report `rotationRate` in a different axis order. Affects the trace and "low-left" labels only, not the alarm. | Settings → Aim trace axis check. Tilt muzzle up, swing it right. Note which flips/mapping were needed per phone, then fix the `auto` defaults in code. | Yes, for grading |
| Q2 | Are the default thresholds right for beginners? (rotation 25 °/s, linear 1.5 m/s², grace 300 ms, pull 35 px, tolerance 0.75°) | Too tight = constant false alarms; too loose = no teaching value. | Run a few students; watch the debug readout. | No |
| Q3 | Does the zone layout match how students actually hold the phone? | The strip and trigger positions are a guess at a pistol-like grip on a phone. | Hand it to several students; adjust `ZONES`. Consider a per-user layout calibration if hands vary a lot. | No |
| Q4 | Does the palm or other fingers touch the screen and cause false "trigger" or "frame" contact? | Large phones and small hands. | Observe in class with the debug readout on. | No |
| Q5 | Should a shot fired during an alarm count differently (e.g., a safety violation)? | Currently recorded and labeled "during alarm" but counted as a shot. | Ricky's teaching preference. | No |
| Q6 | Any session summary wanted (e.g., a results screen students show the instructor)? | Nothing is stored or sent today; stats reset on reload. | Ricky's teaching preference. Must stay on-device (CLAUDE.md constraint 3). | No |
| Q7 | ~~Hosting location~~ | Resolved: Tangineering org, see D-15. | — | No |
