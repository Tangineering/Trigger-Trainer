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
