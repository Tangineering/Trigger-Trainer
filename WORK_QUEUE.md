# WORK_QUEUE.md — outstanding work

The central planning document for this project. An **orchestration session**
schedules work rounds from it; **exploratory sessions** add to it; **execution
agents** receive one item at a time, with the item's text as their brief.
Finished items leave this file and land in `WORK_COMPLETED.md` — this file
holds **only outstanding work**.

How to use it:

- Adding or editing an item → `.claude/skills/work-queue-add/SKILL.md`.
- Pulling a round, handing off, archiving → `.claude/skills/work-queue-run/SKILL.md`.
- The queue's canonical home is the default branch (`main`); a session that finds it
  only on a side branch merges that branch first.
- IDs are `WQ-NNN`, assigned from `next_id` below, never reused. An item keeps
  its ID for life (queue → completed).
- Order within the index is priority, then dependency order. It is not a
  promise of execution order — the orchestration session picks rounds.
- Project rules that every item inherits: `CLAUDE.md` (hard constraints, architecture, working
  rules). In particular: `npm test` after every engine or input-wiring change; bump `engine.js`
  `VERSION` when outputs change for the same inputs; real-phone checks are owner-verifiable
  acceptance lines; decisions an agent makes are logged as `Claude (proposed)` in
  `docs/DECISIONS.md`.

```yaml
next_id: WQ-017
updated: 2026-10-21
```

## Index

| ID | Title | Pri | Size | Status | Depends on | Track |
|----|-------|-----|------|--------|------------|-------|
| WQ-006 | Record axis and clean-press drills on an iPhone and a second Android phone | P1 | S | blocked:owner-machine | — | recordings |
| WQ-016 | Rework the frame strip, trigger guard and trigger layout; travel 60 px | P2 | M | blocked:user | — | layout |

Status values: `queued` · `claimed:<session or round>` · `blocked:<what>` ·
`blocked:user` (needs a decision only the owner can make — the item says which)
· `blocked:owner-machine` (needs data, hardware or a platform only the owner
has — the item says exactly what to run).

Mechanical edits (claim, un-claim, archive, invariant check) go through
`python scripts/wq.py …`; see `work-queue-run`. On Ricky's PC the interpreter is
`C:\Users\ricky\.local\bin\python.exe` (the `python` alias on PATH is the Microsoft Store stub).

Tracks: axis · platform · recordings · grading · alarm · layout · decisions · docs · ui

---

## Items

### WQ-006 — Record axis and clean-press drills on an iPhone and a second Android phone

- **Status:** blocked:owner-machine · **Priority:** P1 · **Size:** S · **Track:** recordings · **Env:** owner-machine
- **Added:** 2026-10-20 by recordings-review session · **Updated:** 2026-10-21 by iPhone-15 analysis session (iPhone half done; second Android phone and the iPhone 3-minute drift run remain, D-61); 2026-10-21 by orchestration session (Ricky: the second Android phone waits for later; the iPhone 3-minute drift run also waits for later (Ricky, 2026-10-21); nothing is expected from the owner until Ricky says so); 2026-10-21 by orchestration session (round-20261021-2 closed: the owner-verifiable checks of WQ-001, WQ-002, WQ-009, WQ-011, WQ-012, WQ-013, WQ-014 and WQ-015 are collected below, so phone work lives in one item)
- **Depends on:** — · **Blocks:** —

**Progress.** The iPhone half is done. `tests/recordings/iphone-15/` holds all twelve drills (axis, clean-press, the
drift `free` run, and the rest), and the analysis half ran for that phone: Q1 closed (axis verdict `ios`, D-58), Q11
and the contact-size fact are in `CLAUDE.md` "Known platform facts", and the drift drill reads 8.5–9.3° at its rests
(Q10; under D-49's 10° limit, but a 93 s run with no jig confirmation). Two findings went to `OPEN_QUESTIONS.md`
rather than this item: its `clean-press` failed on its first shot (Moved at 0.96°; Q14, settled by trimming that press
out of the file, D-59) and iOS flips to portrait and disarms during hard swings (Q15, I-04). Remaining: the second (non-Pixel) Android phone, plus the
full 3-minute jig drift run on the iPhone 15 (D-61: the 93 s run was on a jig and read 9°, so the long run
decides whether I-02 opens for that phone).

**Pending owner checks from rounds 1 and 2** (code landed and passed `npm test`; each line is the
owner-verifiable half of an archived item, see `WORK_COMPLETED.md`; tick them off on the phone, any session then
notes the result here and in the item's entry):
- Pixel 11, Settings: the "Flat-finger check" section is gone (WQ-009); with Gyro axis mapping on Auto, muzzle up
  moves the trace up and a swing right moves it right (WQ-001).
- Pixel 11: Start goes fullscreen and locks landscape, the start screen shows the Android note, a new recording
  carries `device.ios: false` (WQ-002). iPhone: the motion permission prompt still appears, the iPhone note shows.
- Pixel 11 with its old saved settings: after loading the updated page once, Settings shows `jerkMs` at 300 while
  deliberately moved sliders keep their values; after "Restore defaults" a reload keeps every slider at the code
  default (WQ-015).
- Pixel 11 and iPhone 15, finger off the frame: a slow sweep of about 10° alarms within a second of passing 5°;
  holding still off the frame does not alarm; twisting about the barrel axis alone does not alarm; decide whether a
  jerk past 5° during a press should alarm as it does now (WQ-011, D-67).
- iPhone 15 then Pixel 11, finger on the frame: swing through vertical so the phone flips to portrait for a moment:
  no disarm, no overlay, no repeated OK tone, and `180-break` still alarms past 90°; hold portrait for 4 s: the
  overlay appears and the trainer disarms (WQ-013). Re-record `180-break` and `free` on the iPhone and check the
  files carry no `p` rows at the flips.
- iPhone 15: the 3-minute jig drift drill with engine 0.11.0 or later; every rest under 5° (WQ-014, D-62).
- Pixel 11, sensor readout on: after a few seconds of handling the debug line reads `axis est xyz ×n` with n
  above 1.5 (WQ-012, D-57).

**Context.** Everything measured so far comes from one Pixel 11. Three open points need a second
phone each: the iPhone gyro axis order (Q1), whether the iOS misdetection also affects other
Android phones (Q11), and whether the missing touch contact size (`CLAUDE.md`, "Contact size") is
Pixel-specific. Three short drills per phone answer all three.

**Scope.** On each additional phone (an iPhone; any non-Pixel Android), from the deployed HTTPS page:
- Record `axis-up`, `axis-right` and `clean-press` as described in `docs/RECORDINGS.md`, with the phone
  model in the notes field.
- Also record the jig drift drill (D-49): a `free` drill, phone placed on a fixed jig at the start, tap
  **Set downrange**, swing hard for about 90 s, return to the jig and hold still 10 s, swing again, and
  end on the jig held still for 10 s. The analysis reads the 180 deviation at the rests (under 10° in
  3 minutes closes the question for that phone; more re-opens `docs/IDEAS.md` I-02).
- Save them into a new folder named after the phone (for example `tests/recordings/iphone-15/`,
  `tests/recordings/galaxy-s24/`) and commit.
- Then (agent-verifiable half, any session): run `npm run test:replay`; record the per-phone axis
  verdict in `OPEN_QUESTIONS.md` Q1; record `device.ios` versus user agent (Q11) and whether any
  touch row has a non-zero radius (contact size) in `CLAUDE.md` "Known platform facts". If an iPhone
  verdict is `spec`, raise a new item to key the `auto` default on the browser engine.
- Out of scope: changing the engine or the page.

**Acceptance.**
- Owner-verifiable: the three drill recordings and the drift recording per phone exist under a per-phone folder.
- Agent-verifiable: `npm run test:replay` passes (or WQ-003's guard fails and a follow-up item is
  raised); Q1, Q11 and the contact-size note are updated with the measured facts.

**Verification.** The "Axis verdict" lines for each phone quoted in the completion entry.

---

### WQ-016 — Rework the frame strip, trigger guard and trigger layout; travel 60 px

- **Status:** blocked:user · **Priority:** P2 · **Size:** M · **Track:** layout · **Env:** browser
- **Added:** 2026-10-21 by exploratory session (Ricky's UI adjustments) · **Updated:** 2026-10-21 by the same session (guard shape specified: rear curve and a 30° rear leg joining the grip; guard front edge +20 px approved); 2026-10-21 by orchestration session (round-20261021-4: implemented in full on branch `wq-016`, commits 191ef2d, 0b8d59e, 57eea08, pushed to origin, not merged — five real recordings change their replayed events, so the item waits on Q17)
- **Depends on:** — · **Blocks:** —

**Owner decision needed (Q17).** The branch `wq-016` holds the complete change (`npm test` passes, 63 smoke
checks, screenshots in `docs/screenshots/wq-016/`). Merging it changes the replayed events of five real
recordings; every drill expectation still passes. Three of the five show fingers that already rested just below
the old strip edge (y .50–.54) and now count as on the frame, which is the point of the taller strip. One shows
the forward trigger engaging 8 ms sooner. One (`iphone-15/jerked-press`) shows the trigger finger drifting up to
y .540 during a reset and counting as on the frame while still on the trigger: the new strip bottom (.544) sits
only .03 above the new trigger top (.574). Answer with one line:
- **(a)** accept all five as the intended effect of D-71: the orchestrator merges `wq-016` and archives;
- **(b)** accept, but close the strip/trigger overlap first: a gap between the strip bottom and the trigger top,
  or "an engaged trigger touch never counts as frame contact" — say which, and it is added to this item before
  the merge;
- **(c)** re-record the affected drills on the new layout instead (the five files are named in Q17).

**Context.** Ricky asked for four layout adjustments to the pistol side view (2026-10-21, verbatim):
"Increase the height of the frame safe button by 20%, keeping the slide at the same size but shifting the
trigger and trigger guard downwards." "Change the rear of the trigger guard to blend into the grip."
"Extend the frame safe button rearwards to shrink the empty space on the frame between the safe button and
the grip by half." "Shift the trigger default position forwards by 20px, and update the default travel to
60px." The "frame safe button" is the `rest` zone (`INDEX FINGER — FLAT ON FRAME`, `#restZone`). This
refines D-21 (layout), which otherwise stands. Log the request as a Ricky row in `docs/DECISIONS.md` (next
free D-number) with the quote above, and log the interpretation choices below as `Claude (proposed)` rows.

Current geometry (`engine.js:36-45`, fractions of the viewport, right-handed; left-handed mirrors x):
`slide {x .02, y .03, w .96, h .21}`, `frame {x .23, y .26, w .75, h .26}`, `grip {x .00, y .26, w .24, h .74}`,
`guard {x .26, y .51, w .30, h .38}`, `rest {x .38, y .28, w .58, h .22}`, `trigger {x .28, y .53, w .22, h .30}`.
`DEFAULTS.pullPx` is 35 (`engine.js:25`). Guard CSS: `index.html:40` (7 px `--frame` border, no top, rounded
bottom corners). Blade: `#blade` at `right: 14%` of the trigger zone, shifted by up to `pullPx * 1.2` in
`render()` (`index.html:594`). Zones are positioned by `rectFor()`/`layout()` (`index.html:399-417`).

**Scope.**
- **Rest height +20%:** `rest.h` .22 → .264 (top edge stays at y .28, so the bottom moves to .544). Grow
  `frame.h` by the same .044 (→ .304) so the strip stays inside the frame. `slide` unchanged.
- **Trigger and guard down:** move `trigger.y` and `guard.y` down by the same .044 (→ .574 and .554). Check
  that the guard bottom (.934) and trigger bottom (.874) still fit on screen and that `target`
  (`y .55, h .43`) and the guard do not overlap visibly; adjust only `target` if they do, and say so.
- **Rest extended rearwards:** the empty frame between the grip's front edge (x .24) and the rest's rear edge
  (x .38) is .14; halve it to .07 → `rest.x` .31, `rest.w` .65 (front edge stays at .96).
- **Guard rear blends into the grip (shape specified by Ricky, 2026-10-21):** the guard becomes a single
  continuous bar of the same colour and thickness as today (`--frame`, ~7–8 px), traced front to rear:
  1. front edge: straight down from the underside of the frame, at the guard zone's front edge;
  2. front-bottom corner: a rounded corner (radius about 40 px at 852 px wide);
  3. bottom: a straight run rearwards, under the trigger, to about 30% of the guard width from its rear end;
  4. rear-bottom corner: a **rear curve** (radius about 22 px) turning the bar upwards;
  5. rear leg: a straight line rising rearwards at **30° from horizontal** (Ricky, 2026-10-21; a steeper leg
     was rejected), which meets the grip's front edge at that angle. With the run from step 3 (about 30% of
     the guard width, ~88 px at 852 px wide) the rise is about 51 px, so the join sits about 63% of the
     guard height below the guard's top. Keep the 30° angle and let the join height follow from the run if
     the zone size differs. Finish with a small fillet into the grip so there is no gap, end cap or visible
     seam.
  Ricky's reference was a side photo of a typical polymer-frame pistol, where the rear of the guard sweeps up
  into the front strap at an angle; match the feel, not any particular model (constraint 5: generic imagery,
  no brand or model likeness). The guard zone therefore starts at the grip's front edge: `guard.x` .26 → .24,
  and its width grows by the .02 plus the 20 px front shift below. The shape cannot be drawn with CSS
  borders; draw it as an inline SVG path inside the `.guard` element (stretched to the zone with
  `preserveAspectRatio="none"` and `vector-effect: non-scaling-stroke`, or with the path rebuilt in `layout()`
  from the zone's pixel size — implementer's choice, logged as `Claude (proposed)`), mirrored for left-handed
  use via `.lh`. The guard stays drawing-only (not touch-sensitive).
- **Trigger 20 px forward:** move the trigger zone 20 CSS px toward the muzzle (it is fractional today;
  20 px is about .023 of an 852-px landscape iPhone 15 viewport). Preferred: a fixed pixel offset (e.g.
  `K.TRIGGER_FWD_PX = 20`) applied identically in the engine's trigger hit test (it has `vw`) and in
  `rectFor()` for the drawn zone, so touch and pixels match on every phone and in both hands. The guard's
  front edge moves forward by the same 20 px (Ricky approved, 2026-10-21) so the blade stays inside the guard;
  the rear end stays joined to the grip. Log the choice (pixel offset vs. fraction) as `Claude (proposed)`.
- **Default travel 60 px:** `DEFAULTS.pullPx` 35 → 60. Keep the Settings slider range (15–100). Check that a
  60 px pull from the blade's rest position stays plausible on a small landscape phone (667 px wide: the
  trigger zone is ~147 px) and that the blade's drawn shift (`pullPx * 1.2` = 72 px) does not run off the
  zone or into the grip; adjust the blade's resting position within the zone if needed. Because settings are
  stored as a diff since D-64 (WQ-015), the new default reaches every phone whose user never moved the slider —
  note it in the decision row. Update `CLAUDE.md`'s "Units" line ("35 px ≈ 5–6 mm") and any doc that quotes 35 px
  (`grep -rn "35 px\|35px\|pullPx" docs README.md CLAUDE.md`).
- **Tests and recordings:** zones are not stored in recordings, so the new geometry applies to every replay;
  real recordings carry their own `settings`, so the `pullPx` default only changes `synthetic/` (generated
  from `DEFAULTS` in `tests/make-synthetic.js:85`). Run `npm run test:replay` before and after; regenerate
  `synthetic/` with `node tests/make-synthetic.js` if needed. Note the overlap risk: the new rest zone
  (y up to .544, x from .31) overlaps the old trigger zone's top band (y .53–.544, x .28–.50), so a real
  trigger touch recorded high on the old trigger could now land in the rest zone. If any real recording
  changes outcome, **stop and report which ones and why** (do not edit recordings; CLAUDE.md working rules) —
  the orchestrator then decides with Ricky whether to re-record or adjust geometry. `tests/smoke.js`,
  `tests/roundtrip.js` and `tests/make-synthetic.js` touch the zone centres via `ZONES`, so they follow
  automatically; check they still hit the intended zone with the pixel offset.
- Bump `engine.js` `VERSION` (outputs change for the same inputs).
- Update the `ZONES` row in `CLAUDE.md`'s architecture table only if its wording no longer holds (append-only
  hub rule otherwise).
- Out of scope: per-student layout calibration (I-01), stray palm contact (Q4), any new setting for the trigger
  position, and anything in claimed items WQ-011, WQ-013, WQ-014, WQ-015, WQ-003 (WQ-011 and WQ-013 also
  touch `engine.js`/`index.html`, so this item must not run in parallel with them).

**Acceptance.**
- `ZONES` match the Scope figures (or documented deviations) and `DEFAULTS.pullPx` is 60; `VERSION` bumped.
- In a 852×393 and a 667×375 landscape browser viewport, right- and left-handed: the rest strip is visibly
  taller and starts closer to the grip; the slide is unchanged; the guard has a rounded front-bottom corner, a
  rear curve and a rear leg rising at 30° from horizontal into the grip, with no gap or seam; the guard's front edge
  and the trigger sit 20 px further forward than before, the blade inside the guard; the blade's full 72 px drawn travel stays on
  the gun. Screenshots attached to the completion entry.
- A touch at the drawn trigger zone's centre engages the trigger, and a touch at the drawn rest zone's centre
  arms the engine, in both hands (smoke test covers this).
- `npm test` passes; the `test:replay` before/after comparison is recorded, and no real recording changes
  outcome (otherwise the item stops per Scope).
- `docs/DECISIONS.md` has the Ricky row and the `Claude (proposed)` rows; `CLAUDE.md` Units line updated.
- *Owner-verifiable:*
  - On a real iPhone and a real Android phone, the frame strip, trigger and guard feel natural to hold in
    both hands, and a 60 px pull breaks the shot without the finger running off the trigger.

**Verification.** Run `npm run test:replay` before the change (save the output) and after; run `npm test`.
Take the four screenshots with the built-in browser or Playwright. Record in the completion entry: the final
`ZONES` values, the replay diff summary (which recordings changed outcome — expected none), the new
`VERSION`, the D-numbers added, and the screenshots.

---

## Parking lot

Ideas noted but not yet turned into items (an exploratory session may
promote one with `work-queue-add`):

- **Auto-switch of the axis mapping with a confidence gate** (proposal 3.6 steps 2–3). The advisory
  readout is WQ-012 (D-57); the switch waits for a second phone's recordings (WQ-006) and a Ricky decision.
- **Synthetic recordings that can identify an axis mapping** (from WQ-004). `tests/make-synthetic.js` emits
  no `accelerationIncludingGravity` and only `180-safe` rotates about all three axes, so the harness has to
  simulate gravity and 10 of 11 synthetic drills tie. Emit gravity and add one three-axis drill; then drop the
  simulation from `tests/axis-estimate.js`.
- **Q2, default thresholds for beginners.** Needs labelled drills from several students; first data
  points: one `clean-press` shot at 0.70° against the 0.75° Clean limit (Pixel 11, 2026-10-20) and the first iPhone 15
  `clean-press` shot at 0.96° (trimmed out of the recording, D-59; the figure is from the untrimmed file).
- **Q3 / Q4, zone layout and stray palm contact.** Needs class observation with the debug readout on;
  fallback is `docs/IDEAS.md` I-01 (per-student layout calibration).
- **Re-record the three `safe-move` drills with the current engine.** The 0.6.0 recordings still pass
  with current defaults; only worth doing so every real recording has a live-equals-replay check.
- **Operating modes on the start screen** (`docs/IDEAS.md` I-03, Ricky). Waiting for Ricky to list the modes.
- **`CLAUDE.md` says recordings go "one folder per phone"** — the 2026-10-20 set has been moved to
  `pixel-11/`; nothing left to do unless a second Pixel appears.
