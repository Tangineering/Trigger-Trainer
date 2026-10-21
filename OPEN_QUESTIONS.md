# Open Questions

Answer these on real phones before polishing. Record answers in `docs/DECISIONS.md`. Ideas
that aren't blocking anything belong in `docs/IDEAS.md`.

| ID | Question | Why it matters | How to answer | Blocking? |
|---|---|---|---|---|
| Q1 | Do the aim-trace directions come out right on iPhone and Android? **Partly answered:** correct on a Pixel 11 (Android, by eye, D-40), and the 2026-10-20 axis recordings show that only the x/y/z (`ios`) mapping fits that phone. `auto` now means x/y/z order on every platform (D-52), so the Pixel no longer depends on being detected as iOS. iPhone still unknown. | iOS may report `rotationRate` in a different axis order. Affects the trace and "low-left" labels, **and the 180 check**: with the wrong mapping an up/down swing can be read as a cant and missed. The movement alarm is unaffected. | Record **Axis check: muzzle up** and **Axis check: muzzle right** on each phone (see `docs/RECORDINGS.md`) and commit them. `npm run test:replay` prints the mapping that fits both; if an iPhone needs `spec`, `auto` must become per-platform again. | Yes on iPhone, for grading and the 180 check |
| Q2 | Are the default thresholds right for beginners? (rotation 25 °/s, linear 1.5 m/s², grace 300 ms, pull 35 px, tolerance 0.75°) | Too tight = constant false alarms; too loose = no teaching value. | Record labeled drills from several students; tune thresholds until `npm run test:replay` passes on all of them. | No |
| Q3 | Does the zone layout match how students actually hold the phone? | The strip and trigger positions are a guess at a pistol-like grip on a phone. | Hand it to several students; adjust `ZONES`. Consider a per-user layout calibration if hands vary a lot. | No |
| Q4 | Does the palm or other fingers touch the screen and cause false "trigger" or "frame" contact? | Large phones and small hands. | Observe in class with the debug readout on. | No |
| Q5 | ~~Shot fired during an alarm~~ | Resolved: counted and plotted, excluded from the percentages, see D-45 (WQ-007). | — | No |
| Q6 | ~~Session summary~~ | Resolved: Finish button in Settings opens a summary, see D-38. | — | No |
| Q8 | ~~Finger resting on the trigger while moving~~ | Resolved: options 2 + 3 combined, see D-24. | — | No |
| Q7 | ~~Hosting location~~ | Resolved: Tangineering org, see D-15. | — | No |
| Q9 | ~~Ignore cant (roll about the muzzle axis) in the 180 check?~~ | Resolved: yes, see D-33. Capture point resolved by D-31. | — | No |
| Q10 | ~~Gyro drift over a long drill~~ | Resolved on the Pixel 11 (D-49): `tests/recordings/pixel-11/tdt-free-2026-10-20-23-27-38.json`, 174 s with fifteen swings past 90°, returned to a jig-aligned rest at 90 s and 162 s. 180 deviation at those rests: 1.9° and 0.7° (full-orientation error 2.4° and 0.9°); gravity confirms the pose matched within 0.15°. Negligible against a 90° limit. Re-check on each new phone with the same drill. | — | No |
| Q11 | How should the page detect iOS? `isIOS` treats any browser with `DeviceMotionEvent.requestPermission` as iOS, and Chrome 155 on a Pixel 11 has that function, so every 2026-10-20 recording says `ios: true`. Detection is unchanged for now (D-44). | On Android the flag skips fullscreen and the landscape lock and shows the iPhone note on the start screen. It no longer affects the axis mapping: `auto` means x/y/z order on every platform (D-52), so fixing the detection cannot break the Pixel 11 trace. | Fix `isIOS` (for example from the user agent); the axis mapping is already decoupled from it (D-52). | No |
