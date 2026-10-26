# Trigger Discipline Trainer

A free, phone-only drill aid for teaching trigger finger discipline. The phone screen plays the side of a
pistol: keep the index finger flat on the frame while moving; go to the trigger only when still.

- **Finger flat on the frame strip** → safe; move freely.
- **Finger off the frame and the phone moves** → alarm until the finger is back on the frame.
- **Trigger** (rear of the screen): press and pull back to fire. The shot is a click and a flash.
  The mini target shows how much the muzzle drifted during the press.
- **Finger back on the frame** → OK tone.
- **180 rule:** point downrange and tap **Set downrange**; pointing the muzzle more than 90° from it then sounds a
  separate alarm, finger on the frame or not.
- **Drills:** the start screen's **Drill** picker adds timed drills next to the free trainer (**Freestyle**). The
  **Bill Drill** times six shots from a random start beep and shows first shot, splits and total; **Low Ready** runs
  five reps of two shots from low ready, with a three-beep cue between reps, and shows each rep's reaction and split;
  **Box Drill** is the movement drill: two or more shots at each corner of a four-spot box, a three-beep cue to move
  on, finishing back at spot 1, and shows each position's time and splits and the total; **Transitions** starts from
  low ready with one beep and runs five pairs of shots at two or three targets, the only drill where the phone may move
  with the finger on the trigger (from the first shot to the tenth), and shows the pair splits and the transitions.

No install, no accounts, no data collection. Settings stay on the phone.

A dry, phone-only teaching aid for trigger-finger discipline. Not firearms training; use it with a qualified instructor and never with a real firearm. Provided as is, no warranty (MIT).

Free to use. If you want to support this work, [buy Ricky a coffee](https://ko-fi.com/rickytan4) on Ko-fi; the
tool never asks for it and nothing is unlocked by it.

## Use it

Open **https://tangineering.github.io/Trigger-Trainer/** on a phone, tap **Start**, and turn the phone sideways. On iPhone, allow motion
access when asked and turn off Silent mode if there's no sound. See `docs/CLASS_USE.md`.

### Supported browsers

iPhone Safari 17 or newer and Android Chrome. Tested on an iPhone 15 (iOS 18.7), a Pixel 11 and a Galaxy S20+ (both
Chrome 155). Other phones and browsers may work but have not been checked.

### Known limitations

- **HTTPS only.** Motion sensors work only on the https link; a file opened from disk or plain HTTP gets no motion data.
- **Laptops and desktops** get a mouse demo with no motion data, so the alarms cannot work. A **No motion data**
  banner appears a couple of seconds after Start when no motion arrives (also on an iPhone if you tap **Don't Allow**).
- **No vibration on iPhone**, and the shot vibration has not been felt on the Android phones tried so far. The shot is
  a click and a flash.
- **Silent mode on iPhone** can mute the page on some iOS versions. If there is no sound, turn Silent mode off.
- **The 180 check is off until you tap Set downrange.** Everything else works without it. Set it again if the page
  goes to the background.
- **180 drift:** the muzzle direction is worked out from the gyro and can drift a few degrees over minutes, so set
  downrange again now and then in a long session.
- **Portrait swings on iPhone:** in a hard swing Safari can report portrait for up to about 4 seconds. The page waits
  3 seconds before it pauses and shows **Rotate to landscape**, so a very hard swing can still pause it.

## Deploy (GitHub Pages)

1. Push this repo to GitHub.
2. Repo **Settings → Pages → Build and deployment → Deploy from a branch**, branch `main`, folder `/ (root)`.
3. The site appears at `https://<user>.github.io/<repo>/`. Make a QR code of that URL for class.

Motion sensors need HTTPS, which GitHub Pages provides. Opening `index.html` from disk or plain HTTP on a
LAN won't get motion data on iPhone.

## Develop

No build step. `index.html` is the UI; `engine.js` is the logic. Tests:

```
npm install
npx playwright install chromium
npm test              # replays + browser state-machine test + record/replay round trip
npm run test:replay   # replays only (no browser needed)
```

Home-screen icons (WQ-037): `icon.svg` is the source; after changing it, run `node scripts/render-icons.js` to
re-render `icon-180.png` (apple-touch-icon), `icon-192.png`, `icon-512.png` and `icon-maskable-512.png`, and commit them
with `git add -f` (`*.png` is gitignored).

The replay suite runs in GitHub Actions on every push and pull request (`.github/workflows/test.yml`). The browser
suites (`tests/smoke.js`, `tests/roundtrip.js`) are not in CI yet; run `npm test` locally before a merge.

### Test data from real phones

Settings → **Record test data** records one labeled drill (motion, touches, timing) and hands you a JSON
file through the share sheet. Put it in `tests/recordings/<phone>/` and the replay tests check it
automatically. Format and drills: `docs/RECORDINGS.md`.

For on-phone testing before deploying, push to a branch Pages serves, or use any HTTPS tunnel to a local
static server.

Versions: every `VERSION` bump in `engine.js` adds a section to `CHANGELOG.md` in the same commit, and the owner
tags `vX.Y.Z` on `main` after the merge. Agents never push tags.

What changed in each version: see [CHANGELOG.md](CHANGELOG.md).

## Project files

How the project is run (WQ-034): [CONTRIBUTING.md](CONTRIBUTING.md) says how to report a problem, contribute a phone
recording and open a pull request; [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [SECURITY.md](SECURITY.md) sit beside
it. The other files in the root are the planning documents: [WORK_QUEUE.md](WORK_QUEUE.md) (outstanding work),
[WORK_COMPLETED.md](WORK_COMPLETED.md) (finished work), [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) (questions for the
owner), [docs/DECISIONS.md](docs/DECISIONS.md) (every decision, attributed; Ricky decides scope),
[docs/IDEAS.md](docs/IDEAS.md) (ideas not yet committed to) and [CLAUDE.md](CLAUDE.md) (the operating manual for the
coding agents that do most of the work, with the skills in `.claude/skills/`). Real-phone recordings in
`tests/recordings/` are the ground truth for every threshold.

**Report a problem:** open an issue at https://github.com/Tangineering/Trigger-Trainer/issues (name the phone, OS and
browser; a recording from Settings → **Record test data** helps most).

## Documentation

Where to read more (WQ-039):

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the trainer works, for contributors (engine / page split, state
  machine, zones and axes, recordings as tests, adding a drill).
- [docs/CLASS_USE.md](docs/CLASS_USE.md): how to run it in a class, step by step for students.
- [docs/RECORDINGS.md](docs/RECORDINGS.md): how to record drills on a phone and the recording file format.
- [docs/DECISIONS.md](docs/DECISIONS.md): every decision, with who made it.
- [docs/IDEAS.md](docs/IDEAS.md): ideas for later, not committed to.
- [docs/PROPOSAL_2026-10-20.md](docs/PROPOSAL_2026-10-20.md): the rationale behind the first round of work (axis
  order, platform check, estimators).
- [docs/axis-estimate-2026-10-20.txt](docs/axis-estimate-2026-10-20.txt): output of the gyro axis-order estimators
  over the Pixel 11 and synthetic recordings of 2026-10-20 (`npm run axis-estimate`).
- [docs/mockups/](docs/mockups/): design mockups (the drill diagrams in `drills/diagrams.js`).
- [docs/screenshots/](docs/screenshots/): screenshots kept with the changes that made them.
- [CONTRIBUTING.md](CONTRIBUTING.md): reporting a problem, contributing a recording, opening a pull request.
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [SECURITY.md](SECURITY.md).
- [CHANGELOG.md](CHANGELOG.md): what changed in each engine version.
