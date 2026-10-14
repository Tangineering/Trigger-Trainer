# Trigger Discipline Trainer

A free, phone-only drill aid for teaching trigger finger discipline. The phone screen plays the side of a
pistol: keep the index finger flat on the frame while moving; go to the trigger only when still.

- **Finger flat on the frame strip** → safe; move freely.
- **Finger off the frame and the phone moves** → alarm until the finger is back on the frame.
- **Trigger** (rear of the screen): press and pull back to fire. Android vibrates; iPhone clicks and flashes.
  The mini target shows how much the muzzle drifted during the press.
- **Finger back on the frame** → OK tone.

No install, no accounts, no data collection. Settings stay on the phone.

## Use it

Open **https://tangineering.github.io/trigger-trainer/** on a phone, tap **Start**, and turn the phone sideways. On iPhone, allow motion
access when asked and turn off Silent mode if there's no sound. See `docs/CLASS_USE.md`.

## Deploy (GitHub Pages)

1. Push this repo to GitHub.
2. Repo **Settings → Pages → Build and deployment → Deploy from a branch**, branch `main`, folder `/ (root)`.
3. The site appears at `https://<user>.github.io/<repo>/`. Make a QR code of that URL for class.

Motion sensors need HTTPS, which GitHub Pages provides. Opening `index.html` from disk or plain HTTP on a
LAN won't get motion data on iPhone.

## Develop

No build step: edit `index.html`. To run the headless state-machine test:

```
npm install
npx playwright install chromium
npm test
```

For on-phone testing before deploying, push to a branch Pages serves, or use any HTTPS tunnel to a local
static server.
