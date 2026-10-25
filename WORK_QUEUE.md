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
next_id: WQ-031
updated: 2026-10-25
```

## Index

| ID | Title | Pri | Size | Status | Depends on | Track |
|----|-------|-----|------|--------|------------|-------|
| WQ-006 | Record axis and clean-press drills on an iPhone and a second Android phone | P1 | S | blocked:owner-machine | — | recordings |
| WQ-023 | Find out why the shot vibration never fires on Android | P2 | S | blocked:owner-machine | — | platform |
| WQ-030 | Transitions drill: ten shots, movement on the trigger allowed (D-111, D-112) | P2 | L | claimed:round-20261025-3 | — | drills |

Status values: `queued` · `claimed:<session or round>` · `blocked:<what>` ·
`blocked:user` (needs a decision only the owner can make — the item says which)
· `blocked:owner-machine` (needs data, hardware or a platform only the owner
has — the item says exactly what to run).

Mechanical edits (claim, un-claim, archive, invariant check) go through
`python scripts/wq.py …`; see `work-queue-run`. On Ricky's PC the interpreter is
`C:\Users\ricky\.local\bin\python.exe` (the `python` alias on PATH is the Microsoft Store stub).

Tracks: axis · platform · recordings · grading · alarm · layout · decisions · docs · ui · drills

---

## Items

### WQ-006 — Record axis and clean-press drills on an iPhone and a second Android phone

- **Status:** blocked:owner-machine · **Priority:** P1 · **Size:** S · **Track:** recordings · **Env:** owner-machine
- **Added:** 2026-10-20 by recordings-review session · **Updated:** 2026-10-21 by iPhone-15 analysis session (iPhone half done; second Android phone and the iPhone 3-minute drift run remain, D-61); 2026-10-21 by orchestration session (Ricky: the second Android phone waits for later; the iPhone 3-minute drift run also waits for later (Ricky, 2026-10-21); nothing is expected from the owner until Ricky says so); 2026-10-21 by orchestration session (D-76: Ricky will re-record the full drill set on the 0.12.0 layout on both phones; the old sets become legacy — see "Re-record on the new layout" below); 2026-10-21 by orchestration session (round-20261021-2 closed: the owner-verifiable checks of WQ-001, WQ-002, WQ-009, WQ-011, WQ-012, WQ-013, WQ-014, WQ-015, WQ-016, WQ-017, WQ-018, WQ-019, WQ-020 and WQ-021 are collected below, so phone work lives in one item); 2026-10-22 by S20+ recordings session (second Android phone: axis drills in, D-80)
- **Depends on:** — · **Blocks:** —

**Progress.** The iPhone half is done. `tests/recordings/iphone-15/` holds all twelve drills (axis, clean-press, the
drift `free` run, and the rest), and the analysis half ran for that phone: Q1 closed (axis verdict `ios`, D-58), Q11
and the contact-size fact are in `CLAUDE.md` "Known platform facts", and the drift drill reads 8.5–9.3° at its rests
(Q10; under D-49's 10° limit, but a 93 s run with no jig confirmation). Two findings went to `OPEN_QUESTIONS.md`
rather than this item: its `clean-press` failed on its first shot (Moved at 0.96°; Q14, settled by trimming that press
out of the file, D-59) and iOS flips to portrait and disarms during hard swings (Q15, I-04). Remaining: the second (non-Pixel) Android phone, plus the
full 3-minute jig drift run on the iPhone 15 (D-61: the 93 s run was on a jig and read 9°, so the long run
decides whether I-02 opens for that phone).

**Second Android phone (2026-10-22, D-80).** A Samsung Galaxy S20+ (Chrome 155, left-handed) recorded `axis-up` and
`axis-right` on engine 0.12.1 (`tests/recordings/samsung-s20/`): both pass, verdict `ios`, so Q1's answer holds on
a non-Pixel Android phone; E-2 ends `xyz` on both (margin 5.7 and 14.0). The rest of that phone's drill set
(clean-press, 180, drift run) is still owed whenever Ricky has the phone again.

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
- Pixel 11 and iPhone 15, finger off the frame: a slow sweep of about 10° alarms within a second of passing `offFrameDeg` (5°; 3° once WQ-017 lands, D-77);
  holding still off the frame does not alarm; twisting about the barrel axis alone does not alarm; decide whether a
  jerk past 5° during a press should alarm as it does now (WQ-011, D-67).
- iPhone 15 then Pixel 11, finger on the frame: swing through vertical so the phone flips to portrait for a moment:
  no disarm, no overlay, no repeated OK tone, and `180-break` still alarms past 90°; hold portrait for 4 s: the
  overlay appears and the trainer disarms (WQ-013). Re-record `180-break` and `free` on the iPhone and check the
  files carry no `p` rows at the flips.
- iPhone 15: the 3-minute jig drift drill with engine 0.11.0 or later; every rest under 5° (WQ-014, D-62).
- Pixel 11, sensor readout on: after a few seconds of handling the debug line reads `axis est xyz ×n` with n
  above 1.5 (WQ-012, D-57).
- iPhone 15 and Pixel 11, both hands: the taller frame strip, the forward trigger and the new guard feel natural to
  hold, and a 60 px pull breaks the shot without the finger running off the trigger (WQ-016, D-71, D-75).
- Pixel 11 and iPhone 15, drift slider never moved: Settings shows 3° after loading the updated page; 10 s still off
  the frame does not alarm; a slow sweep alarms within about a second of passing 3°; a clean press does not alarm
  (WQ-017, D-77); since WQ-019 (D-81) the default is 5° again, so Settings should show 5°.
- Any phone: the longer trigger blade reads as the trigger and the vertical label beside it is legible (WQ-018, D-78, D-79).
- Any phone, both hands: with the trigger 40 px forward of the zone fraction (WQ-020, D-82) it sits where the finger
  expects it, and a full press still breaks without the finger running off the zone.
- Any phone: Settings → Limit from downrange reaches 30°; at 30° a swing past 30° from downrange alarms and clears
  below 25° with the finger on the frame (WQ-021, D-84).

**Context.** Everything measured so far comes from one Pixel 11. Three open points need a second
phone each: the iPhone gyro axis order (Q1), whether the iOS misdetection also affects other
Android phones (Q11), and whether the missing touch contact size (`CLAUDE.md`, "Contact size") is
Pixel-specific. Three short drills per phone answer all three.

**Re-record on the new layout (D-76, Ricky 2026-10-21).** WQ-016 changed the zones (taller, longer frame strip;
trigger 20 px forward; 60 px travel) and WQ-011 added the 5° off-frame limit, so the 2026-10-20/21 recordings were
made on a layout and rules that no longer exist, and three Pixel recordings already replay differently
(`WORK_COMPLETED.md`, WQ-016). Owner half: on the Pixel 11 and the iPhone 15, from the deployed page at engine
0.12.0 or later, record the full drill set of `docs/RECORDINGS.md` again (`axis-up`, `axis-right`, `safe-move`,
`off-frame-still`, `off-frame-move`, `clean-press`, `jerked-press`, `press-wobble`, `trigger-sweep`, `180-safe`,
`180-break`, and a `free` run), with the phone model and "layout 0.12.0" in the notes; save into
`tests/recordings/<phone>/` beside the old files and commit. Agent half, once a phone's new set is in: run
`npm run test:replay`; confirm every new recording's live-equals-replay check passes and every drill expectation
passes with `auto`; then mark that phone's pre-0.12.0 files legacy — move them to `tests/recordings/<phone>/legacy/`
(the replay test keeps replaying them for live-equals-replay, but `tests/replay.js` skips drill expectations for
files under a `legacy/` folder; add that rule and document it in `docs/RECORDINGS.md`), and tighten the D-67
expectations back (`jerked-press` zero alarms, `safe-move` zero alarms) if the new sets allow it, saying so in the
entry. If a new recording fails an expectation, stop and report it (do not edit the recording).

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
- Owner-verifiable (D-76): a full 0.12.0 drill set per phone exists under `tests/recordings/<phone>/`.
- Agent-verifiable (D-76): the new sets pass; the old sets sit under `legacy/` and still replay; `docs/RECORDINGS.md` describes the legacy rule.
- Agent-verifiable: `npm run test:replay` passes (or WQ-003's guard fails and a follow-up item is
  raised); Q1, Q11 and the contact-size note are updated with the measured facts.

**Verification.** The "Axis verdict" lines for each phone quoted in the completion entry.

---

### WQ-023 — Find out why the shot vibration never fires on Android

- **Status:** blocked:owner-machine · **Priority:** P2 · **Size:** S · **Track:** platform · **Env:** any
- **Added:** 2026-10-24 by start-screen review session · **Updated:** 2026-10-24 by orchestration session (round-20261024-1: agent half landed in 3588041 — `buzz()` keeps the last `navigator.vibrate` result, the debug readout shows `vib: <true|false|n/a|threw> (pattern <p>)`, `docs/CLASS_USE.md` "Checking the shot vibration" explains it, smoke test added. Call-path facts for the next step: the shot buzz runs synchronously inside the `touchmove` listener (`onTouch` → `feedTouches` → `engine.touches` → `shot` event), not the rAF tick, and always after `start()` has awaited `requestFullscreen` where it exists; nothing ever leaves fullscreen. **Owner next:** on the Pixel 11 and the S20+, debug readout on, fire three shots per case (a) straight after Start, (b) after opening and closing Settings, (c) with the phone's touch-vibration setting confirmed on; report the `vib:` line and whether a buzz was felt for each)
- **Depends on:** — · **Blocks:** —

**Context.** Ricky (2026-10-24): the shot vibration has not worked on any phone observed so far, which includes
the Pixel 11 and the Samsung S20+ (both Chrome 155). The page calls `navigator.vibrate` through
`buzz()` (`index.html:398`), inside a `try` that swallows the result, from the `shot` event handler. Chrome
ignores `vibrate()` and returns `false` (no exception) when the frame lacks sticky user activation, and some
builds ignore it inside a fullscreen session or while the page is not focused; the phone's own "touch vibration"
and Do-not-disturb settings also mute it. Nothing in the page records whether the call returned `true`, so the
cause is unknown. `CLAUDE.md` "Vibration" records the observation; `README.md` stops promising a vibration in
WQ-022.

**Scope.**
- Agent half: make the result observable without changing behaviour: `buzz()` keeps the last `navigator.vibrate`
  return value (or `'n/a'` when absent, `'threw'` on exception) and the debug readout shows it as `vib: true|false|…`
  beside the existing lines. Add a short section to `docs/RECORDINGS.md` or `docs/CLASS_USE.md` telling the owner
  how to read it. No engine change, no `VERSION` bump.
- Owner half: on the Pixel 11 and the S20+, from the deployed page with the debug readout on, fire three shots
  (a) straight after Start, (b) after opening and closing Settings, (c) with the phone's touch-vibration setting
  confirmed on, and report `vib:` and whether a buzz was felt for each.
- Then (agent, next round): from the readings, either fix the call (for example, move it out of the fullscreen
  path, or issue it from a touch handler rather than the rAF tick) in a follow-up item, or record in `CLAUDE.md`
  that Android Chrome does not vibrate here and close the question.
- Out of scope: iPhone (no `navigator.vibrate`, constraint 4), the start-screen text (WQ-022), any audio change.

**Acceptance.**
- Agent-verifiable: the debug readout shows the `vib:` line; `npm test` passes; replays unchanged.
- Owner-verifiable: the six readings above are recorded in this item's `Updated` line or in `OPEN_QUESTIONS.md`
  as a new Q, and a follow-up item or a `CLAUDE.md` fact closes it.

**Verification.** `npm test`; a Playwright run with `navigator.vibrate` stubbed to return `false` shows
`vib: false` in the readout after a simulated shot (add it to `tests/smoke.js`).

---

### WQ-030 — Transitions drill: ten shots, movement on the trigger allowed (D-111, D-112)

- **Status:** claimed:round-20261025-3 · **Priority:** P2 · **Size:** L · **Track:** drills · **Env:** any
- **Added:** 2026-10-25 by exploratory session (Transitions mockup)
- **Depends on:** — · **Blocks:** —

**Context.** Ricky (D-111, 2026-10-25) wants a fifth drill, **Transitions**: a low-ready start with one start beep,
then five sets of two shots, two at one target and then a transition to another target in view. It is the first drill
that changes the alarm rules: from the first shot to the tenth, movement with the finger on the trigger does not alarm
(the student swings between targets with the finger prepped); before the first shot and after the tenth the alarms are
the normal ones. D-112 (Claude, proposed) fills in the details below. The picker diagram is ready:
`transitions` in `docs/mockups/drills/diagrams.js`, rendered in `docs/mockups/drills/picker-landscape-5-transitions.png`,
`picker-landscape-5-transitions-scrolled.png` and `picker-portrait-5-transitions.png`. The drill framework is WQ-027
(Bill), WQ-028 (Low Ready), WQ-029 (Box); see `CLAUDE.md` sections WQ-027 to WQ-029 for the run model.

**Scope.**
- `engine.js` (0.15.0 → 0.16.0, `package.json` too):
  - `DRILL_DEFS.transitions = {delayMs: [2000, 5000], shots: 10, pairShots: 2, onTriggerFree: true, ready: true}`
    next to `bill` (engine.js:121-127). No `reps`: it takes Bill's single-string path in `drillShot` (engine.js:461)
    and `tickDrill` (engine.js:488), generalised from Bill's six to `def.shots` where it is still hard-coded (comments
    say "sixth"; check every use). The result keeps Bill's fields (`first`, `splits` (nine), `total`, `shots`, `early`,
    `alarms`, `withAlarm`, `endT`) and adds, for a def with `pairShots`, `pairSplits` (splits 1→2, 3→4, … : five) and
    `transitions` (2→3, 4→5, … : four) and `avgTransition`.
  - The window (D-112 d): a helper `freeOnTrigger()` true when `st.drill` is a def with `onTriggerFree`, phase `live`,
    and at least one run shot (`d.shots.length > 0`), and `st.trig` is set. In `tick()` the off-frame alarm block
    (engine.js:679-691, `if (!st.onRest && !st.alarmActive)`) starts no `move` alarm while it is true: the rate test,
    the press `jerkMs` test and the `offFrameDeg` drift test are all skipped. The 180 block above it (engine.js:658)
    is unchanged (D-112 e).
  - Re-taking the drift reference (D-112 f, g): inside the window, when the trigger touch ends with the finger off the
    frame (`endTrigger`, engine.js:435), set `st.qOff = st.q.slice()`; at the tenth shot (where `drillShot` moves to
    `finishing`) set `st.qOff = st.q.slice()` if the finger is off the frame and `st.trig.moveMs = 0`, so movement
    after shot 10 is judged from there. Grace periods are as today.
  - Grading (D-112 i): while a Transitions run is live, a press re-origins the trace when the pull first reaches
    `S.pullPx * K.PULL_START_FRACTION` (engine.js:57) on an unfired trigger: `tr.oh = st.aimH; tr.ov = st.aimV;
    tr.trace = []` (in `updateTrigger`, engine.js:409; mark the press so it happens once per press). No change in
    Freestyle or the other drills.
  - Packed events are unchanged (`drillBeep`, `drillEnd`, `drillCancel`). With `st.drill === null` or another drill,
    every existing recording must replay to identical events.
- `index.html`:
  - `DRILL_SVG.transitions` (port the string from `docs/mockups/drills/diagrams.js` verbatim, as the other four) and a
    fifth `DRILL_MODES` entry after `bill` (index.html:598): name "Transitions", sub "Five pairs, target to target",
    how "Low ready, finger on the frame. On the beep raise and fire two at a target, then swing to the next with the
    finger on the trigger. Five pairs; finger back on the frame to finish."
  - `drillBeep` → `Snd.timerBeep()` as Bill; `drillEnd` → `Snd.complete(0.35)` + `showDrillResult()`.
  - `showDrillResult` (index.html:640): a `transitionsRows(r)` branch: First shot, Pairs (five splits), Transitions
    (four), Average transition, Total, Shots (grades, "alarm" for unsafe shots), then the shared Early shots / With
    alarm rows and "Best clean total this session".
  - `drillLineText` (index.html:693): the D-112 k texts. Pair n = `floor(shots / 2) + 1`.
  - Recorder label `drill-transitions` after `drill-box` (index.html:579), hint "Select Transitions first. Finger on
    the frame, wait for the beep, fire two at each target with the finger on the trigger between pairs, ten shots,
    finger back on the frame. Expect: one beep, no alarm during the transitions, one drill end."
  - The picker now has five entries: in landscape (844×390) the list scrolls (see the `-scrolled` mockup); keep
    **Choose** / **Cancel** reachable, no layout change needed unless a screenshot shows clipping.
  - `window.__tdt().drill` exposes `freeOnTrigger` (bool) for the tests.
- Tests: `tests/make-synthetic.js` gains a live-generated `drill-transitions` recording (fixed seed, as `drill-box`):
  beep, two presses, a fast yaw swing (> `moveDps`, total > `offFrameDeg`) with the finger kept on the trigger, two
  presses, … ten shots, finger on the frame; `tests/expectations.js`: one `drillBeep`, no `alarmStart` between the
  first and the tenth shot, one `drillEnd`. `tests/smoke.js`: the picker lists five; a run where the same swing
  happens before the first shot alarms, one inside the window does not, one after the tenth shot (finger still on the
  trigger) alarms; a finger lifted off the trigger mid-window (not onto the frame) and moved alarms; the 180 alarm
  still fires inside the window when downrange is set.
- Docs: `CLAUDE.md` behavior spec (drills bullet) and a `## WQ-030` block (append-only); `docs/CLASS_USE.md` drill
  steps; any decision made on the way as `Claude (proposed)` in `docs/DECISIONS.md`; D-112 stays `proposed` until
  Ricky accepts it.
- Out of scope: changing the alarm rules of Freestyle or the other drills; per-target detection (the phone does not
  know where the targets are); a par time; the smoke flake noted in the parking lot.

**Acceptance.**
- Agent-verifiable: `npm test` passes (three suites); every recording other than the new `drill-transitions` replays to
  the same events as before (VERSION aside); the picker lists five drills in D-112 a order; the smoke checks above
  pass; landscape and portrait screenshots of the picker on Transitions and of a results overlay are committed in
  `docs/mockups/drills/` or `tests/` output as WQ-029 did.
- Owner-verifiable (a real iPhone and a real Android phone): a full Transitions run swinging between two or three
  targets with the finger on the trigger raises no alarm between shot 1 and shot 10; raising from low ready with the
  finger on the trigger still alarms; moving after shot 10 without the finger on the frame alarms; the result shows
  five pair splits and four transitions.

**Verification.** Run through `orchestrated-feature`. `npm test` (twice, report PASS counts); `npm run test:replay`
before and after with the list of recordings whose outcome changed (expected: none but the new one); screenshots as
above. Record in the completion entry the VERSION, the new test counts, and any D-112 point that changed.

---

## Parking lot

Ideas noted but not yet turned into items (an exploratory session may
promote one with `work-queue-add`):

- **Stale synthetic recordings** (WQ-027 test writer, 2026-10-25): the committed `tests/recordings/synthetic/` set other than
  `drill-bill` was generated with engine 0.12.3; `node tests/make-synthetic.js` today changes all 11 files (`app` field) and the
  logs of `clean-press`, `jerked-press`, `press-wobble`, `trigger-sweep` (D-72/D-87 trigger geometry). Regenerate in a commit of
  its own and confirm every expectation still passes; routine, no decision needed.
- **Timing-sensitive summary checks in `tests/smoke.js`** (WQ-023 agent, 2026-10-24): one `npm test` run under container load
  reported "3 failed", two of them the summary grading checks (a shot Jerked instead of Moved); seven reruns passed. Worth a
  look if it recurs: the simulated motion burst that should grade Moved may cross the Jerked limit when frames are slow.
  Update (WQ-029, 2026-10-25): it recurs — the same three checks ("trigger reset allows follow-up; drift graded as moved" and the
  two summary checks) failed in 2 of 6 sequential unloaded smoke runs now that the suite runs over 360 checks; the failing state
  shows `lastGrade "Jerked"` with `rotEMA` ≈ 12, so the suspect is the CDP motion timing in that old block, not the engine.
  Promote to an item: make that block measure from rAF frames or drive the motion deterministically.
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
- **Dial cap derived from the guard's front edge** (from WQ-020): `layout()` reserves a fixed 160 px beside the dial
  so Set downrange clears the guard; computing it from the measured guard rectangle would survive future
  `TRIGGER_FWD_PX` changes. Needs a Ricky decision.
- **`CLAUDE.md` says recordings go "one folder per phone"** — the 2026-10-20 set has been moved to
  `pixel-11/`; nothing left to do unless a second Pixel appears.
