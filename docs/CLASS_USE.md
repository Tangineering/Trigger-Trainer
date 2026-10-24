# Using the Trainer in Class

## Before class
- Scan-to-open QR code for the site URL on a slide or handout.
- Check volume on a demo phone: hold **Test sound** on the start screen (also in Settings). iPhones: Silent mode off.
- Have students hold **Test sound** and turn their volume down before starting; the alarms are loud.
- Pick starting thresholds in Settings on your demo phone and tell students the same numbers if they need tuning.
- For a quick looser or stricter class setting, use Settings → Movement alarm → **Overall sensitivity**: Low, Default and High set the rotation, linear and max-drift sliders to fixed values (Low 32.5 °/s, 1.95 m/s², 6.5°; Default 25 °/s, 1.5 m/s², 5°; High 17.5 °/s, 1.05 m/s², 3.5°). You can fine-tune any of the three sliders afterwards; the drop-down then shows **Custom**.
- A phone keeps only the settings that were changed on it; every other setting follows the current version of the page.
  **Restore defaults** (Settings) removes all changes on that phone.

## Student setup (about 1 minute)
1. Open the link, tap **Start**. iPhone: tap **Allow** for motion access.
2. Turn the phone sideways. Left-handed: Settings → Shooting hand → Left.
3. Hold the phone so the screen faces your trigger-finger side, muzzle toward the end marked MUZZLE.
4. **Point the muzzle downrange and tap Set downrange** (under the muzzle). Until then the 180
   check is off. Tap it again to reset; if the page goes to the background, set it again.
5. Lay the index finger flat on the dashed strip. It turns green and plays the OK tone.

## Drills
- **Ready and move:** finger on the frame, move between "targets" around the room. No alarm should sound.
- **Finger off = freeze:** lift the finger to the trigger only when the phone is still. Any movement → alarm.
  Slow movement counts too: once the muzzle has drifted more than 5° by default (Settings, "Max muzzle drift off the
  frame") from where it pointed when the finger left the frame, the alarm sounds, also on the trigger and
  during a press. Twisting the phone about the barrel axis does not count. Finger back on the frame clears it.
- **Press, don't slap:** slow rearward press; watch the blue trace and the shot dot. Green ring = clean.
- **Reset and follow-up:** after a shot, let the trigger forward until it re-arms, press again.
- **Back to the frame:** after every string, finger flat on the frame → OK tone before moving.
- **Finger on the trigger is not a rest:** resting the fingertip on the trigger and moving alarms, and so does
  moving during a press. One short jerk during the press is graded, not alarmed; anything longer, or
  several wobbles adding up to more than about a third of a second (300 ms by default), alarms. A jerk
  that moves the muzzle more than the drift limit (5° by default) alarms as well.
- **180:** turn and move freely with the finger on the frame. Past 90° from downrange a lower "wail" alarm
  sounds even with the finger on the frame. "Muzzle N° from downrange" under the muzzle shows how close they are.

## Reading the target
- Dot in the green ring: clean press.
- Amber: the muzzle moved. Red: jerked. The label gives the direction (e.g. "low-left").
- Only valid once the axis check has been done on that phone (Settings → Aim trace axis check).

## End of the session
- **⚙︎ → Finish** shows the session summary: time, shots, shots fired during an alarm, how many were clean /
  moved / jerked, average and steadiest movement during the press, most common miss direction, movement alarms
  and 180 violations. Shots fired during an alarm count in the total and on the plot, but the clean / moved /
  jerked figures and the movement figures cover only the shots fired with no alarm. Students can show it to you
  or screenshot it; nothing is saved.
- **Keep training** goes back with the stats kept. **New session** clears them and returns to the start screen.

## Checking the shot vibration (Android, WQ-023)
Turn on Settings → "Show sensor readout on the trainer screen". The readout has a line
`vib: <result> (pattern <ms>)` for the last time the page asked the phone to vibrate (a shot asks for
pattern `45`; alarms and trigger reset ask for longer ones, so read it straight after a shot):
- `vib: true` — Chrome accepted the request. If nothing was felt, the phone's own settings muted it
  (touch/haptic vibration off, Do not disturb, battery saver).
- `vib: false` — Chrome refused it (typically no user activation yet, fullscreen, or page not focused).
- `vib: n/a` — the browser has no vibration (all iPhones; expected).
- `vib: threw` — the call raised an error. `vib: -` — the page has not asked to vibrate yet.
