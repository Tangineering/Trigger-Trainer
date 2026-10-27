# Changelog

All notable changes to the Trigger Discipline Trainer, newest first. The version is the `Engine x.y.z` line in
Settings. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions are tagged `vX.Y.Z` on
`main` by the owner after the merge.

## [0.18.0] - 2026-10-27

### Added
- Low Ready for a whole class: enter a **class code** when choosing Low Ready (everyone in the room types the same
  one) and the start beeps of every phone sound at the same moment, with no connection between the phones. Put the
  finger on the frame right after a beep and you join the next one; a phone whose finger is not on the frame when a
  beep is due stays silent and waits for the next. Leave the code empty to train alone as before. Settings → Other →
  **Class cycle** sets the time between beeps (10 s to start).
- The drill line counts down to the next shared beep; the results of a class run name the code.

## [Unreleased]

Page and project changes with no engine change (`Engine 0.17.0` still shows in Settings).

### Added
- Start screen: a one-line disclaimer, a privacy line and a **Source on GitHub** link.
- A **No motion data** banner when no motion sample arrives after Start (iPhone **Don't Allow**, laptop, plain
  HTTP), with the fix for the platform; the status pill is prefixed NO MOTION meanwhile.
- Home-screen icons for iPhone and Android (PNG renders of the SVG icon, including a maskable one).
- Offline use: after the first load the page opens with no connection (a service worker caches the site's own
  files; Settings shows "offline ready").
- Box Drill: the picker diagram starts at the lower-left spot (spot 1, nearest you on the left, then clockwise);
  the class notes say so too.
- Accessibility: a **Shot flash** switch in Settings → Other, the flash replaced by a brief trigger outline when
  it is off or the phone asks for reduced motion, dialog and live-region labels, and higher-contrast alarm and
  trigger pills.
- For contributors: CHANGELOG, CONTRIBUTING, code of conduct, security note, bug-report template, the replay suite
  in GitHub Actions on every push and pull request, `docs/ARCHITECTURE.md`, README screenshots and a browser
  support / known limitations section.

## [0.17.0] - 2026-10-25

### Changed
- Only one finger controls the trainer at a time. A second finger laid on the frame strip or the trigger while
  another finger controls is ignored until it is lifted, so it no longer keeps the phone "safe" when the first
  finger comes off the frame.

## [0.16.0] - 2026-10-25

### Added
- **Transitions** drill (fifth in the Drill picker): start from low ready, one start beep, then ten shots in five
  pairs at two or three targets. From the first shot to the tenth the phone may move with the finger on the
  trigger; the 180 rule stays on, and before the first and after the tenth shot the normal rules apply.
- Results show the first shot, the five pair splits, the four transitions, the average transition and the total.

## [0.15.0] - 2026-10-25

### Added
- **Box Drill**: five positions round four marked spots, finishing back at spot 1. Fire two or more shots at each
  spot, put the finger back on the frame for the three-beep move cue, then walk to the next spot with the finger
  on the frame.
- Results show each position's time and splits and the total from the beep to the last shot.

## [0.14.0] - 2026-10-25

### Added
- **Low Ready** drill: five reps of two shots from low ready. Each rep starts with a beep; with the finger back on
  the frame, a three-beep cue (back to low ready) follows, then the next beep 2 to 5 seconds later.
- Results show each rep's reaction and split, plus the average and best reaction.

## [0.13.0] - 2026-10-25

### Added
- **Drill picker** on the start screen. **Freestyle** is the default and works as before; timed drills sit
  beside it. All the usual rules stay on during a drill.
- **Bill Drill**: finger on the frame, a random 1 to 4 seconds later the start beep, six shots, then the finger
  back on the frame gives a completion tone and the results (first shot, splits, total). Results last for the
  session only.
- Opening Settings or the summary during a drill cancels the run.

## [0.12.6 and before]

Everything before the drill work (0.12.6 and earlier), collapsed. In the order it was built:
- The base trainer: finger on the frame is safe, off the frame plus movement sounds the alarm, the trigger gives a
  shot click and flash, and the 180 rule alarms when the muzzle points more than 90 degrees from downrange.
- Settings panel, shot grading on a mini target, session summary, handedness mirror, and the test-data recorder.
- The gyro axis order defaults to x/y/z on every phone; the 180 orientation bridges short gaps in the motion data.
- The max-drift alarm (5 degrees off the frame, also during a trigger press), the 3 second portrait hold before
  pausing, a 300 ms jerk allowance, and settings stored only when changed from the default.
- Trigger and frame layout rework (60 px pull), and the shot summary leaving out shots fired during an alarm.

Between 0.12.3 and 0.13.0 the engine went through 0.12.4 to 0.12.6, which are small layout and settings steps
(trigger zone reaching the guard front, and the Low / Default / High **Overall sensitivity** drop-down in
Settings); they are not listed separately.
