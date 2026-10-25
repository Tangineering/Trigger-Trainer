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
