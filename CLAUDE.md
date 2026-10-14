# Trigger Discipline Trainer — Operating Manual

A phone-based teaching aid for Ricky Tan's (Tangineering) pistol classes. The phone stands in for the
side of a pistol: the student keeps the index finger flat on the frame while moving, and only goes to the
trigger when the "gun" is still. Free, no accounts, no tracking, no money — ever.

**Ricky owns scope and decisions.** Record anything you decide or propose in `docs/DECISIONS.md` using the
attribution scheme there. Questions that block work go in `OPEN_QUESTIONS.md`.

## Hard constraints (do not change without a logged Ricky decision)

1. **One static page.** `index.html` holds all markup, CSS, and JS. No framework, no bundler, no build step,
   no runtime dependencies, no CDN scripts. `manifest.webmanifest` and `icon.svg` are the only companions.
2. **Free static hosting** (GitHub Pages). It must work by opening a URL. HTTPS is required for motion
   sensors on iOS.
3. **No data leaves the phone.** No analytics, no network calls, no cookies. Settings live in
   `localStorage` (wrapped in try/catch; the page must work without it).
4. **Works on iPhone Safari and Android Chrome.** iPhone haptics and true finger-flatness detection are
   explicitly *not* required (Ricky, 2026-10-14). Degrade gracefully when a capability is missing.
5. **Not a firearm product.** It's a dry, phone-only drill aid. Keep imagery generic (no brand or model
   likenesses).

## Behavior spec (as stated by Ricky)

- Screen = side of the handgun. Index finger pressed flat on the screen (frame strip) = **safe**; the phone
  may move freely.
- Phone moves while the trigger finger is off the frame → **alarm** plays, and keeps playing until the
  finger is back flat on the frame.
- A **trigger** near the rear of the screen: press with the fingertip, pull backwards → **shot** signal
  (vibration on Android; click + flash on iPhone). The phone must stay steady during the press.
- Finger back flat on the frame → **OK tone**, and movement is allowed again without the alarm.

Additions made in the prototype (Claude, proposed — see DECISIONS): aim-drift trace and shot grading on a
mini target, trigger reset for follow-up shots, handedness mirror, grace period, settings panel, axis-check
tool, debug readout, mouse fallback for laptop demos.

## Architecture (inside `index.html`)

| Block | What it does |
|---|---|
| `DEFAULTS` / `S` | Tunable settings, persisted under `localStorage['tdt.settings.v1']`. Bump the key if the schema changes incompatibly. |
| `ZONES` | Normalized rectangles for a **right-handed** layout (muzzle at x=1). Left-handed mirrors x in `rectFor()` and `norm()`. Only `rest` and `trigger` are touch-sensitive; `grip` is a visual dead zone. |
| `Snd` | Web Audio: `ok()`, `shot()`, `startAlarm()/stopAlarm()`. Context is created/resumed inside the Start tap (iOS unlock). Sets `navigator.audioSession.type='playback'` where available so iOS 17+ plays through the silent switch. |
| `onMotion` | `devicemotion` → rotation-rate magnitude and linear accel (EMA, ~80 ms) for the alarm; integrates muzzle pitch/yaw (`aimH`, `aimV`, degrees) for the trace. |
| `onTouch` / `onMouse` | Maintains `touches` map in normalized right-handed coordinates plus contact size. |
| `updateTrigger` / `fire` | Trigger engages when a touch enters the trigger zone. Pull = rearward travel in CSS px. Fires at `pullPx`; re-arms after returning forward to `RESET_FRACTION`. Shot drift = aim change from trigger contact (or reset) to the break. |
| `tick` (rAF) | State machine: debounced frame contact → armed/safe/off-frame/alarm; trace capture; status pill; target redraw. |
| Settings overlay | Built from the `SLIDERS` table; pauses training while open. Includes live sensor readout and the axis-check canvas. |
| `window.__tdt()` | Read-only state snapshot used by `tests/smoke.js`. Keep it. |

### State machine
`not armed` → (finger on frame) → `SAFE` (OK tone) → (finger lifts) → `OFF FRAME`
→ either `ON TRIGGER` → `SHOT` → (reset / lift) … → back to `SAFE` (OK tone),
or (motion > threshold after `graceMs`) → `ALARM` (latched) → (finger on frame) → `SAFE` (OK tone).
Opening settings, backgrounding the page, or rotating to portrait disarms and silences.

## Known platform facts and unknowns

- **Contact size:** Android Chrome usually reports `Touch.radiusX/Y`; iOS Safari usually doesn't. The
  flat-finger check is opt-in and auto-skips when size isn't reported.
- **Vibration:** `navigator.vibrate` doesn't exist on iOS Safari. Don't build hacks for it (not required).
- **Gyro axis order:** the spec maps `rotationRate` alpha/beta/gamma to z/x/y. Some iOS builds have been
  reported to deliver x/y/z order instead. `axisMode: 'auto'` assumes iOS-style on iOS. **Unverified on
  hardware** — first thing to check (OPEN_QUESTIONS Q1). The alarm uses magnitude, so it's unaffected; only
  the trace direction and the "low-left" style labels depend on this.
- **Orientation:** sign of yaw uses `screen.orientation.angle` (or `window.orientation` on iOS): 90 vs 270.
  iOS can't lock orientation from a web page; Android tries fullscreen + `orientation.lock('landscape')`.
- **Units:** pull distance is CSS px (~160 px per inch on most phones, so 35 px ≈ 5–6 mm). Drift is degrees
  of muzzle angle (1° ≈ 6.3" at 10 yd).

## Working rules

- Test on a real iPhone and a real Android phone before calling any sensor or touch change done. Headless
  tests prove the state machine, not the sensors.
- Run `npm test` (Playwright, headless Chromium, simulated multi-touch + `DeviceMotionEvent`) after every
  change to the state machine.
- Don't add features that need a server, accounts, or an app store.
- Keep defaults conservative for beginners; Ricky tunes them in class via Settings.
- Commit messages: imperative, short; one logical change per commit.

## Layout of this repo

```
index.html              the whole app
manifest.webmanifest    home-screen install (landscape, fullscreen)
icon.svg
tests/smoke.js          headless state-machine test
package.json            dev-only: playwright for tests
docs/DECISIONS.md       decision log with attribution
docs/CLASS_USE.md       how to run it in a class (student-facing steps)
OPEN_QUESTIONS.md       blocking/pending questions for Ricky
README.md               short public description + deploy steps
LICENSE                 MIT (Tangineering)
```
