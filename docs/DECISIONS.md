# Decision Log

Attribution scheme (same as Ricky's other repos):

| Tag | Meaning |
|---|---|
| `Ricky` | Ricky decided or stated it. |
| `Claude → Ricky accepted` | Claude proposed; Ricky explicitly agreed. |
| `Claude → Ricky modified` | Claude proposed; Ricky changed it. |
| `Claude (delegated)` | Ricky told Claude to decide. |
| `Claude (proposed)` | Claude's choice, implemented but not yet ratified. |

Status: `active`, `proposed`, `superseded`, `rejected`.

| ID | Decision | Attribution | Basis | Status |
|---|---|---|---|---|
| D-01 | Purpose: free teaching aid for Ricky's classes; no money spent or made | Ricky | "I don't want to spend or make any money off of it, it's just a teaching aid for my classes" | active |
| D-02 | Keep implementation and distribution as simple as possible | Ricky | Original request | active |
| D-03 | Core behavior: flat finger on screen = safe; movement off-frame → alarm until finger returns; rear trigger press-and-pull-back → vibration shot; phone must stay steady; finger back → OK tone | Ricky | Original request | active |
| D-04 | Deliver as a single static web page hosted on GitHub Pages instead of a native app | Claude → Ricky accepted | Avoids app stores and Apple's paid developer account; Ricky said "go ahead and write the page" | active |
| D-05 | iPhone haptics and true finger-flatness detection are not required | Ricky | "iPhone haptics and true flatness are not essential" | active |
| D-06 | Flat-finger check = touch inside a long frame strip; optional minimum contact size where the browser reports it | Claude (proposed) | Follows from D-05 | proposed |
| D-07 | iPhone shot signal = click sound + screen flash | Claude (proposed) | Follows from D-05 | proposed |
| D-08 | Alarm is latched until the finger returns to the frame (not cleared when motion stops) | Claude (proposed) | Reading of "until the finger is back fully flat" in D-03 | proposed |
| D-09 | Movement = rotation-rate magnitude OR linear acceleration over threshold, ~80 ms smoothing, 300 ms grace after leaving the frame | Claude (proposed) | Lifting the finger jolts the phone; grace avoids false alarms | proposed |
| D-10 | Steadiness is graded from integrated gyro drift between trigger contact and the break; shown on a mini target with clean/moved/jerked rings and a direction label | Claude (proposed) | Gives the "phone has to stay steady" requirement a measurable output | proposed |
| D-11 | Trigger re-arms after returning forward half its travel, allowing follow-up shots without lifting | Claude (proposed) | Mirrors trigger reset; useful for USPSA-style doubles | proposed |
| D-12 | Handedness setting mirrors the layout | Claude (proposed) | Left-handed students | proposed |
| D-13 | Opening settings, backgrounding, or portrait orientation disarms and silences; finger must return to frame to re-arm | Claude (proposed) | Avoids alarms while the phone is put down or reconfigured | proposed |
| D-14 | License: MIT, copyright Tangineering | Ricky | LICENSE added at repo creation | active |
| D-15 | Hosting: GitHub Pages from `Tangineering/Trigger-Trainer`, branch `main`, root | Ricky | Repo created under the Tangineering org; resolves Q7 | active |
| D-16 | Real phone telemetry is captured by a recorder built into the page and used as test inputs via a replay harness | Claude → Ricky accepted | Ricky asked for a way to feed phone telemetry to tests; agreed to the recorder + replay proposal | active |
| D-17 | Logic moves from `index.html` into `engine.js` (no DOM, timestamps on every input) so the same code runs live and in Node replays. Relaxes constraint 1 from "one file" to "static files, no build step" | Claude (proposed) | Needed for deterministic replay; still plain static hosting with no tooling | proposed |
| D-18 | Recording format `tdt-recording` v1: ordered log of motion / touch / pause / frame rows plus the live event list; inputs rounded at the source so live and replay see identical numbers | Claude (proposed) | Makes "replay reproduces the live run" an exact check | proposed |
| D-19 | Recordings leave the phone only through the user's own Share / download action | Claude (proposed) | Keeps constraint 3 (no data leaves the phone automatically) | proposed |
| D-21 | Layout: grip widened 50% (trigger, guard and frame strip move forward by the same amount); slide ~30% thinner with frame and trigger moved up; shot movement indicator moved to the empty area under the muzzle | Ricky | "Widen the grip area by 50%… Move the shot movement indicator into the empty area under the muzzle… Make the slide about 30% thinner" (2026-10-14) | active |
| D-22 | No movement alarm can start while the finger is on the trigger, so a hard jerk is graded instead of alarmed | Ricky | "While the trigger is being pressed, disable any movement alarm so that a serious jerk doesn't trigger the alarm" (2026-10-14) | superseded by D-24 |
| D-23 | Implementation of D-22: "on the trigger" = from trigger contact until that finger lifts (includes after the break). An alarm already latched stays on. `graceMs` also applies after leaving the trigger, so the tail of a jerk doesn't alarm on release | Claude (proposed) | Follows from D-22; see OPEN_QUESTIONS Q8 for the side effect | superseded by D-25 |
| D-20 | `engine.js` carries a `VERSION`; bump it whenever outputs change for the same inputs. Exact live == replay is required only for recordings made with the current version | Claude (proposed) | Lets behavior evolve without invalidating old recordings, which still check label expectations | proposed |
| D-24 | Trigger alarm rules: combine Q8 options 2 and 3. Suppress the movement alarm only from the start of the pull until shortly after the break, and even then alarm on movement sustained for more than ~1 s. A finger resting on the trigger without pulling gets no suppression | Ricky | "Let's do option 2 and 3 together" (2026-10-15); resolves Q8 | active |
| D-25 | Implementation of D-24: press starts at 15% of `pullPx` and ends 500 ms after the break (or when the pull relaxes below that); sustained = continuously over threshold for `sustainMs` (default 1000 ms, Settings slider); with the finger on the trigger but not pulling, movement must last 150 ms before it alarms so a slap registers as a press; `graceMs` applies after leaving the frame, after a press ends, and after leaving the trigger | Claude (proposed) | Synthetic slap showed the jerk and the pull start on the same frame; the 150 ms confirm avoids misclassifying it while still catching a sweep | proposed |
