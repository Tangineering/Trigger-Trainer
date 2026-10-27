# Phone Recordings as Test Inputs

The page can record exactly what a phone's browser reports during a drill: motion samples, touches,
animation frames, pauses, and the events the trainer produced live. `tests/replay.js` feeds each
recording back through `engine.js` and checks it.

## Making a recording

1. Open the trainer on the phone (the HTTPS GitHub Pages URL; motion data needs HTTPS).
2. Settings → **Record test data**. Pick a drill, optionally add notes (phone model, grip, hand; no names).
3. **Start recording**. Settings close and a red **● REC** button appears on the slide.
4. Do the drill (hints below). Tap **● REC** to stop. The file is saved and Settings opens at **Record test
   data**, ready for the next drill. You don't need **Save last recording**.
   The share sheet opens with `tdt-<drill>-<date>.json`. Save it to Files, AirDrop it, or email it to yourself.
   - **Android Chrome** won't share `.json` files. The page then offers the same file as `.txt` (keep that
     name; the tests read `.txt` recordings too), and if that's refused as well it downloads the `.json`
     (Files app › Downloads). On a Pixel 11 it downloads (Ricky, 2026-10-20).
   - The line under the target says what happened: shared, downloaded, cancelled, or failed.
5. **Save last recording** (Settings) saves the most recent recording again: use it if you cancelled the
   share sheet or want a second copy. Opening Settings mid-recording stops it without saving; save it there.
   Recordings stop on their own at 3 minutes (not saved; Settings opens so you can save it).

Nothing is sent anywhere unless you share the file.

**Contributing a recording** (WQ-034). A recording you send to the project is committed to this public repository
under the MIT licence (`LICENSE`), like the code. It holds what the phone's browser reported during the drill and
nothing else: the browser's user-agent string, motion samples, touch positions, animation-frame times, the screen
size and pixel ratio, the settings in force, the drill label, your notes, the date and time it was made, and the
events the trainer produced. It holds no location, no photos, no audio and no account. The notes field must carry
no names: phone model, grip and hand are enough.

## Drills and what the tests expect

| Drill (label) | Do this | Test expects |
|---|---|---|
| `free` | Anything | Only that the replay matches the live run |
| `safe-move` | Finger flat on the frame the whole time; move the phone a lot | Arms; no alarm (one alarm still on at the end is accepted: lifting the finger to stop the recording can drift past `offFrameDeg`) |
| `off-frame-move` | Frame → lift finger → move the phone → back to frame | Arms; ≥ 1 alarm (rate limits, or muzzle drift past `offFrameDeg`, D-56) |
| `off-frame-still` | Frame → lift finger → hold still 2–3 s → back to frame | Arms; no alarm |
| `clean-press` | Frame → trigger, slow press while still; a few shots | ≥ 1 shot; no alarm; all Clean |
| `jerked-press` | Same, but slap or jerk the trigger | ≥ 1 shot; ≥ 1 Moved/Jerked (a jerk past `offFrameDeg` alarms since D-56, so alarms are not checked) |
| `press-wobble` | Frame → start a slow press → before the break, keep wobbling or swinging the phone ≥ 1 s → back to frame | ≥ 1 alarm |
| `trigger-sweep` | Frame → rest fingertip on the trigger **without pulling** → move the phone → back to frame | ≥ 1 alarm; no shot |
| `180-break` | Point downrange, tap **Set downrange**, finger on frame. Keeping it there, swing well past 90° to one side, then back | ≥ 1 180 alarm; cleared at the end |
| `180-safe` | Point downrange, tap **Set downrange**, finger on frame. Swing ~70° left, right, up, down, returning each time | No alarm of any kind |
| `axis-up` | Finger on frame; still 1 s; tilt muzzle **up** ~20°; hold 1 s; stop | Biggest excursion reads as up |
| `axis-right` | Finger on frame; still 1 s; swing muzzle to **your right** ~20°; hold 1 s; stop | Biggest excursion reads as right |
| `drill-bill` | Select **Bill Drill** on the start screen first. Finger on frame; wait for the start beep; fire six; finger back on frame | One `drillBeep`, one `drillEnd`, six run shots |
| `drill-low-ready` | Select **Low Ready** on the start screen first. Finger on frame; on each beep raise and fire two, finger back on frame, wait for the three beeps, back to low ready. Five reps | Five `drillBeep`, four `drillCue`, one `drillEnd` |
| `drill-low-ready-class` | Select **Low Ready** with a class code first (two phones with the same code, side by side). Same steps as `drill-low-ready` | Five `drillBeep` on the shared schedule (`TDT.slotAt`), four `drillCue`, one `drillEnd` |
| `drill-box` | Select **Box Drill** on the start screen first. Finger on frame; on the beep fire two or more, finger back on frame, three beeps, move to the next spot (finger on the frame); five positions ending back at spot 1 | One `drillBeep`, four `drillCue` (`move`), one `drillEnd` |
| `drill-transitions` | Select **Transitions** on the start screen first. Finger on frame; wait for the start beep; fire two at a target, swing to the next with the finger on the trigger, fire two; ten shots; finger back on frame | One `drillBeep`, no `alarmStart` between the first and the tenth shot, one `drillEnd` |

Expectations live in `tests/expectations.js`. For `axis-*` drills the replay also tries every gyro
mapping and flip, and when a phone has both axis recordings it prints the one mapping that fits both.
That answers OPEN_QUESTIONS Q1.

The verdict is also a test. For each real phone (keyed by recordings folder plus user agent: Chrome sends
the same reduced user agent on every Android phone, D-80) with both `axis-*` recordings,
the replay runs those recordings again with the default settings (`axisMode: 'auto'`, no flips) and
FAILs when the mapping `auto` resolves to is not in that phone's verdict; the line names both, for
example `auto → ios; fits: spec`. A failure means the shipped default reads that phone's gyro wrong.
Synthetic recordings pin `axisMode: 'spec'` and skip this check.

Every recording whose `device.ios` disagrees with its user agent (`/iP(hone|ad|od)/`) gets a WARN
line. The `pixel-11/` recordings carry `device.ios: true` because they predate D-53; the WARN is
expected there and does not fail the run.

## Where files go

```
tests/recordings/
  synthetic/          generated by `npm run synthetic` (idealized; baseline only)
  iphone-15/          one folder per phone, named however you like; the folder is
  pixel-11/           what tells two phones with the same user agent apart
  samsung-s20/
```

Real recordings are the source of truth. If a real recording fails its expectation, either the drill
wasn't done as labeled (re-record it) or the thresholds/logic need changing; that's the point.
A recording is edited only on a logged Ricky decision, and then its `notes` field says what was cut and that
`observed` was regenerated by replay (so far only the iPhone 15 `clean-press`, D-59).

## Format (`tdt-recording`, version 1)

```jsonc
{
  "format": "tdt-recording", "version": 1,
  "app": "0.2.0",                       // engine VERSION at record time
  "label": "clean-press", "notes": "", "recordedAt": "2026-10-14T11:02:03.000Z",
  "device": { "ua": "...", "ios": true, "dpr": 3, "w": 844, "h": 390 },   // ios: platform check at record
                                        // time; diagnostic only, replay ignores it
  "settings": { ... },                  // settings in force during the recording
  "t0": 1234.5, "t1": 15234.5,          // performance.now() ms at start / stop
  "log": [                              // inputs in the order they happened
    ["p", t, 0],                        // engine resumed (1 = paused)
    ["m", t, a, b, g, ax, ay, az, gx, gy, gz, angle],   // rotationRate α β γ (deg/s), acceleration,
                                                        // accelerationIncludingGravity (m/s²), screen angle
    ["t", t, vw, vh, [[id, cx, cy, rx, ry], ...]],      // all current touches, CSS px
    ["f", t],                           // animation frame (engine tick)
    ["d", t],                           // Set downrange pressed
    ["r", t, drill, seed],              // drill run requested ("bill", "lowready", "box", "transitions"); seed for the engine's delay generator
    ["r", t, "lowready", seed, wall],   // shared Low Ready run (class code): seed = the code's hash, wall = Date.now() at t
    ["w", t, wall],                     // shared run only: Date.now() at a resume, re-anchors the shared beep schedule
    ["x", t]                            // drill cancelled (back to the start screen)
  ],
  "observed": [[t, "armed"], [t, "alarmStart", "move"|"180", rot, lin, dev180], [t, "shot", "Clean", dev],
               [t, "drillBeep", rep], [t, "drillCue", "lowready", rep], [t, "drillCue", "move", rep], [t, "drillEnd", drill, total_ms],
               [t, "drillCancel"], ...]
}
```

A recording made with a drill selected starts its `log` with an `r` row: the engine draws the random start-beep
delay from that seed, so the replay beeps at the same moment as the live run. Each **Again** on the drill results adds another `r` row
mid-log (a new seed), and **Change drill** adds an `x` row. Freestyle recordings have neither.

A Low Ready run with a class code has a fifth element in its `r` row, the page's wall clock (`Date.now()`, ms) at
that moment; the engine takes the start beeps from the shared schedule of that code and that clock, never from the
phone's own clock, so the replay beeps where the live run did. Each resume of such a run adds a `w` row with the wall
clock then, so a pause that let the phone's two clocks drift apart does not shift the schedule.

Values are rounded where they're captured (time 1 µs, sensors 1e-4, touches 0.01 px), and the live engine
uses the rounded values, so a replay with the same engine version reproduces `observed` exactly. When
`engine.js` behavior changes, bump `VERSION`; older recordings then only check their drill expectations.

A minute of recording is roughly 0.3–1 MB, depending on the phone's sensor rate.

## Estimating the gyro axis order from the data

`npm run axis-estimate` runs `tests/axis-estimate.js` over every recording in `tests/recordings/`
(or over the files and folders given as arguments). It estimates which device axis each
`rotationRate` component describes, using gravity from `accelerationIncludingGravity` as the
reference, and prints one line per recording per estimator. Each line gives the winning candidate,
its margin over the runner-up, the motion time until the decision last changed, and whether the
winner agrees with the phone's `axis-up`/`axis-right` verdict. `--gravity=lp` or `--gravity=fused`
limits the run to one gravity source; the default runs both. The script is not part of `npm test`
and changes nothing. The method and the 2026-10-20 result are in `docs/PROPOSAL_2026-10-20.md`,
sections 3.3 to 3.7. The engine runs the same estimate (E-2, `fused` gravity) live: the debug readout
shows it as `axis est <candidate> ×<margin> (<motion seconds>s)`, and `npm run test:replay` prints the
end-of-replay `axisEst` for every recording longer than 5 s.
