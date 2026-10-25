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
next_id: WQ-032
updated: 2026-10-25
```

## Index

| ID | Title | Pri | Size | Status | Depends on | Track |
|----|-------|-----|------|--------|------------|-------|
| WQ-031 | Let only one fresh touch control the engine; ignore later fingers (D-113, D-115) | P1 | M | blocked:owner-machine | — | alarm |
| WQ-006 | Record axis and clean-press drills on an iPhone and a second Android phone | P1 | S | blocked:owner-machine | — | recordings |
| WQ-023 | Find out why the shot vibration never fires on Android | P2 | S | blocked:owner-machine | — | platform |

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

### WQ-031 — Let only one fresh touch control the engine; ignore later fingers (D-113, D-115)

- **Status:** blocked:owner-machine · **Priority:** P1 · **Size:** M · **Track:** alarm · **Env:** any
- **Added:** 2026-10-25 by queue-add session (Ricky's request) · **Updated:** 2026-10-25 by the same session (D-115: a
  finger that lands while another controls is ignored for its whole life, not only when it reaches the other zone;
  title, scope and acceptance rewritten); 2026-10-25 by the same session (renumbered from WQ-030 and D-111–D-113: the Transitions drill took WQ-030, D-111 and D-112 on `ccr-8fe231fe-xlcpfb`); 2026-10-25 by the orchestration session at the merge of WQ-030 (Transitions): `engine.js` is now 0.16.0, so this item bumps 0.16.0 → 0.17.0; `restTouch()` is at engine.js:397 still, `updateTrigger()` at engine.js:415 and the state object at engine.js:281ff; the engine now also has `st.drillFree` / `freeOnTrigger()` (a trigger touch keeps the Transitions window open, D-112 d) and `retakeOrigin()` on the trigger object (`minPull`), which an ignored touch must never reach; the 45th recording `synthetic/drill-transitions.json` is single-touch; 2026-10-25 by the orchestration session (round-20261025-4, execution agent on opus): the agent half landed — `engine.js` 0.17.0 (2527dea engine: `resolveControl()` in `touches()`, `st.ctrl` / `st.ignored`, `restTouch()` and `updateTrigger()` skip ignored ids; 3ac4afd tests: five smoke scenarios, synthetic `two-finger` recording + expectation, `trigOnTs` in replay.js; 758865d docs + D-120; 8049b05→a008ec5 and 4b0128c: the smoke and roundtrip drill press helpers lifted nothing before `touchStart [TRG]`, so every drill press so far was a two-finger press — they now lift first; merge 8274ee8). All 45 earlier recordings replay byte-identical (the multi-touch rows in the three `free` recordings are grip fingers while the frame finger controls), so no drill expectation changed; `npm test` 799 PASS / 0 FAIL on the merged branch (replay 46 recordings). Deviations: the trigger zone also counts as wanting control (D-120 a); no recording's events changed. Remaining, owner half on the Pixel 11 (or S20+) and the iPhone 15 from the deployed page: (1) one finger flat on the frame, a second finger pulls the trigger three times → no shot, no click/flash; (2) lift the first finger with the second still on the trigger and pull again → still no shot and the state goes off frame (alarm if the phone moves); lift it and press once normally with one finger → fires; (3) trigger held, a second finger on the strip → no OK tone, and moving the phone alarms as usual; after the trigger finger lifts, the strip finger still gives no OK tone; (4) two fingers on the frame one after the other, lift the first → frame contact lost (alarm if the phone moves). Report the four results in this item's Updated line or in a chat line. A recorder label for this check does not exist yet: the `two-finger` expectation is tuned to the synthetic timeline, so a structural expectation plus a recorder label and a `docs/RECORDINGS.md` row would be a small follow-up if recordings of the owner half are wanted
- **Depends on:** — · **Blocks:** —

**Context.** Ricky (2026-10-25, D-113, D-115): the engine must not accept two fingers at once. Today a student can
keep one finger flat on the frame strip and press the trigger with another: `updateTrigger()` (`engine.js:409`)
engages the first touch found in `zoneFor('trigger', vw)` regardless of other touches, and `restTouch()`
(`engine.js:397`) returns any touch in `ZONES.rest` except the engaged trigger touch (D-75). So the trainer reads
"safe" and "on the trigger" at the same time, which defeats the drill. The reverse also works: with the trigger
engaged, a second finger on the frame strip sets `onRest` and silences the off-frame alarm and drift limit (D-56).
D-115 settles it: **only fresh contact can control the engine state** — a touch that lands while another touch is
controlling is ignored until it is lifted, even after the controlling finger lifts. D-114 (b)–(d) (Claude, proposed)
fix the remaining details; D-114 (a) is superseded by D-115. Real recordings contain multi-touch rows (counted
2026-10-25 by unpacking every `t` row with `TDT.unpackTouchList`): `pixel-11/tdt-free-2026-10-20-22-40-27.json`
(813 rows with >1 touch), `pixel-11/tdt-free-2026-10-20-23-27-38.json` (5753),
`iphone-15/tdt-free-2026-10-21-03-38-03.json` (1); no other recording has any.

**Scope.**
- `engine.js`: decide in `touches()` (the only place a new touch id is first seen) and keep the result in state
  (e.g. `st.ignored`, a set of touch ids, created with the state at `engine.js:281`ff; ids no longer in the list are
  dropped on every `touches()` call). Definitions:
  - A touch is **controlling** while it counts as frame contact (in `ZONES.rest`, raw zone test, not the debounced
    `onRest`, D-114 c) or is the engaged trigger touch (`st.trig.id`).
  - A touch first seen while another touch is controlling is **ignored** for its whole life (D-115): it never
    counts as frame contact, never engages the trigger, wherever it moves, and stays ignored after the controlling
    touch lifts. This includes a second finger laid on the frame beside the first: when the first lifts, frame
    contact is lost (debounce and off-frame rules as usual) — a deliberate change from today.
  - At most one touch controls at a time (D-113). A non-ignored touch that did not control when it appeared (e.g. a
    finger on the grip, which is not touch-sensitive) may later take control only while no other touch controls;
    if it enters the frame strip or trigger zone while another touch controls, it becomes ignored too.
  - One finger sliding from the frame strip into the trigger zone is the same touch and engages as today (D-114 b);
    D-75 (the trigger touch never counts as frame contact) stays.
  - Several new touches in the same `touches()` call with no controlling touch before: a frame touch wins over a
    trigger touch (D-114 d); otherwise the first in list order; the rest are ignored.
  - `restTouch()` and `updateTrigger()` skip ignored ids. A pause (`setPaused`) does not clear the set: touches held
    across a pause keep their status, so the decision never depends on tick timing; replays must stay deterministic.
  - Mouse fallback (`onMouse`) is single-pointer; nothing to change there. `index.html` needs no change unless a
    test hook in `window.__tdt()` helps (e.g. `ignored` count) — keep `__tdt` read-only.
- Bump `VERSION` (outputs change for the same inputs; 0.16.0 → 0.17.0, see the Updated line).
- Run `npm run test:replay` before and after; report which recordings change outcome (expected: the three `free`
  recordings above, possibly only in events, not in drill expectations). Do not edit recordings (CLAUDE.md working
  rules); if a drill expectation fails, stop and report instead of loosening it.
- Add synthetic coverage in `tests/smoke.js` (CDP multi-touch is already used there): (1) finger on frame + second
  finger pulls the trigger → no `trigOn`, no `shot`, state stays SAFE; (2) the frame finger then lifts while the
  second finger is still down and pulls again → still no `trigOn` or shot, and the state goes off frame; the second
  finger lifted and placed again on the trigger fires normally; (3) trigger engaged + second finger on the strip →
  no OK tone, movement alarms as usual, and after the trigger finger lifts the strip finger still gives no frame
  contact; (4) two fingers laid on the frame one after the other, the first lifts → frame contact lost; (5) one
  finger sliding from the strip into the trigger zone and pulling still fires. Optionally a synthetic recording in
  `tests/make-synthetic.js` (`two-finger`) with an expectation in `tests/expectations.js`.
- Docs (hub files, append-only blocks): a `## WQ-031` block in `CLAUDE.md` describing the rule and the ignored set,
  and one Behavior-spec bullet next to "Trigger wins": "**One finger** (D-113, D-115): only a touch that lands while
  no other touch controls can count; a later finger is ignored until it is lifted." Any further detail decided goes
  in `docs/DECISIONS.md` as `Claude (proposed)`.
- Out of scope: trigger geometry, zones, pull distance, the frame debounce (`K.REST_LOSS_DEBOUNCE_MS`), the drills,
  any page layout; the stale synthetic set in the parking lot (regenerate only the new file).

**Acceptance.**
- Agent-verifiable: `npm test` passes (all three suites); the five smoke scenarios above pass; `VERSION` is 0.17.0;
  the completion entry lists every recording whose replayed events change and says no drill expectation changed.
- Owner-verifiable: on a real iPhone and a real Android phone, with one finger flat on the frame a second finger
  cannot fire the trigger, not even after the first finger lifts; with the trigger held, a second finger on the strip
  gives no OK tone and the movement alarm still sounds; a normal one-finger press still fires.

**Verification.** `npm run test:replay` output before/after (outcome changes quoted in the completion entry);
`npm test` totals; the orchestrator returns the item `blocked:owner-machine` for the phone half.

---

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
