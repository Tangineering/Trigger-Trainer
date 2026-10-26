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
next_id: WQ-048
updated: 2026-10-26
```

## Index

| ID | Title | Pri | Size | Status | Depends on | Track |
|----|-------|-----|------|--------|------------|-------|
| WQ-031 | Let only one fresh touch control the engine; ignore later fingers (D-113, D-115) | P1 | M | blocked:owner-machine | — | alarm |
| WQ-006 | Record axis and clean-press drills on an iPhone and a second Android phone | P1 | S | blocked:owner-machine | — | recordings |
| WQ-045 | Tell the user when no motion data arrives after Start | P1 | S | blocked:owner-machine | — | platform |
| WQ-023 | Find out why the shot vibration never fires on Android | P2 | S | blocked:owner-machine | — | platform |
| WQ-037 | Add PNG home-screen icons for iOS and Android | P2 | S | claimed:round-20261025-6 | — | ui |
| WQ-039 | Write docs/ARCHITECTURE.md for contributors and a documentation map in the README | P2 | S | queued | — | docs |
| WQ-042 | Set the GitHub repository description, topics, website and social preview | P2 | S | blocked:owner-machine | — | docs |
| WQ-043 | Offline use: cache the page with a service worker (D-121) | P2 | M | queued | WQ-037 | platform |
| WQ-046 | Deploy the public page from a release branch instead of main (Q19) | P2 | S | blocked:user | — | hygiene |
| WQ-047 | Protect main: require a pull request and the replay check | P2 | S | blocked:owner-machine | — | hygiene |
| WQ-041 | Put two screenshots in the README | P3 | S | queued | — | docs |
| WQ-044 | Accessibility pass on the page (D-121) | P3 | S | queued | — | ui |

Status values: `queued` · `claimed:<session or round>` · `blocked:<what>` ·
`blocked:user` (needs a decision only the owner can make — the item says which)
· `blocked:owner-machine` (needs data, hardware or a platform only the owner
has — the item says exactly what to run).

Mechanical edits (claim, un-claim, archive, invariant check) go through
`python scripts/wq.py …` (any Python 3, stdlib only); see `work-queue-run`.

Tracks: axis · platform · recordings · grading · alarm · layout · decisions · docs · ui · drills · hygiene

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

### WQ-037 — Add PNG home-screen icons for iOS and Android

- **Status:** claimed:round-20261025-6 · **Priority:** P2 · **Size:** S · **Track:** ui · **Env:** any
- **Added:** 2026-10-25 by public-release review session
- **Depends on:** — · **Blocks:** WQ-043

**Context.** The page ships one icon, `icon.svg` (512-unit viewBox: dark rounded square, grey slide, green frame strip,
trigger guard), linked at `index.html:11` and as the only `icons` entry in `manifest.webmanifest:10`–12. iOS Safari
takes no SVG for the home-screen icon and there is no `apple-touch-icon` link, so **Add to Home Screen** on an iPhone
shows a page screenshot; Android Chrome wants 192 and 512 px PNGs (and a `maskable` entry) for the install prompt and
the launcher. Hard constraint 1 (CLAUDE.md line 40) names the static companions; PNG icons are new companions.

**Scope.**
- Render `icon.svg` to `icon-180.png` (apple-touch-icon), `icon-192.png` and `icon-512.png` with a script that is
  committed under `scripts/` or `tests/` (Playwright can rasterise the SVG; no new dependency). Keep the SVG as the
  source; note the command in `README.md` "Develop".
- Add `<link rel="apple-touch-icon" href="icon-180.png">` next to `index.html:11`; add the two PNG entries to the
  manifest, the 512 one also with `"purpose": "maskable"` if the artwork survives the safe zone (check against the
  maskable circle; pad the SVG for the maskable render if it does not).
- Append the new files to CLAUDE.md hard constraint 1's companion list and the "Layout of this repo" block (append
  only) and log a `Claude (proposed)` decision row for the new companions.
- Out of scope: any change to the artwork itself; a service worker or install prompt (WQ-043); `index.html` changes
  beyond the one link. Touches `index.html`: do not run in parallel with WQ-032, WQ-034, WQ-043 or WQ-044.

**Acceptance.**
- Agent-verifiable: the three PNGs exist, are referenced as above, `npm test` passes, engine `VERSION` unchanged; a
  Playwright check that `GET` of each icon from a static server returns 200 and the manifest parses.
- Owner-verifiable: **Add to Home Screen** on the iPhone 15 shows the trainer icon, not a screenshot; Chrome on a
  Pixel 11 or S20+ shows it in the install prompt and the launcher.

**Verification.** `npm test`; the icon fetch check; owner screenshots of the two home screens recorded in the
completion entry.

---

### WQ-039 — Write docs/ARCHITECTURE.md for contributors and a documentation map in the README

- **Status:** queued · **Priority:** P2 · **Size:** S · **Track:** docs · **Env:** any
- **Added:** 2026-10-25 by public-release review session
- **Depends on:** — · **Blocks:** —

**Context.** The clearest description of how the trainer works is CLAUDE.md "Architecture" (line 97: the engine /
page split, every input carries its timestamp, the state machine) and "Known platform facts" (line 157), written as
an operating manual for agents and sprinkled with queue and decision numbers. `README.md` "Develop" (line 40) says
only "`index.html` is the UI; `engine.js` is the logic" and never lists `docs/` (`CLASS_USE.md`, `RECORDINGS.md`,
`DECISIONS.md`, `IDEAS.md`, `PROPOSAL_2026-10-20.md`). A contributor has to find CLAUDE.md and read 42 KB.

**Scope.**
- Add `docs/ARCHITECTURE.md` (one to two screens): the two-file split and why (replayable recordings, D-17), the
  input/event contract of `createEngine` (the table in CLAUDE.md "Architecture" condensed), the state machine
  paragraph, the zones and axis-mapping summary, how a recording becomes a test (pointer to `docs/RECORDINGS.md`),
  and how to add a drill (where `DRILL_DEFS`, `DRILL_MODES`, `drillLineText` and `showDrillResult` live). Plain
  prose, no WQ/D numbers except as "see DECISIONS.md D-nn" asides. Do not move text out of CLAUDE.md; the manual
  stays the source of truth for agents and may say "contributor version: docs/ARCHITECTURE.md".
- Append a "Documentation" list to `README.md` naming every file in `docs/` with one line each, plus
  `CONTRIBUTING.md` and `CHANGELOG.md` when they exist.
- Out of scope: changing any behaviour; editing CLAUDE.md beyond the one pointer; the known-issues section (WQ-040).

**Acceptance.**
- `docs/ARCHITECTURE.md` exists; every function, constant and file it names exists (`grep` each one).
- The README documentation list names every file in `docs/` that exists at merge time.
- `npm test` unchanged.

**Verification.** The grep pass over the names; completion entry lists any CLAUDE.md statement found to be stale on
the way (fix in CLAUDE.md only if trivially wrong, else report).

---

### WQ-041 — Put two screenshots in the README

- **Status:** queued · **Priority:** P3 · **Size:** S · **Track:** docs · **Env:** browser
- **Added:** 2026-10-25 by public-release review session
- **Depends on:** — · **Blocks:** —

**Context.** `README.md` is text only. `docs/screenshots/` holds per-item Playwright captures (latest
`docs/screenshots/wq-030/start-landscape.png`, `picker-landscape.png`, `results-landscape.png`), none referenced
anywhere. `.gitignore` excludes `*.png` globally, so those files were force-added; new ones need `git add -f` or a
`!docs/screenshots/**` exception.

**Scope.**
- Capture two fresh 852×393 CSS px screenshots with Playwright from the current `index.html`: the trainer armed with
  the finger on the frame (green strip, trace visible) and the drill picker, into `docs/screenshots/readme/`. Keep
  them under 200 KB each.
- Add `!docs/screenshots/**` to `.gitignore` (rewrites a hub file: say so in the commit; it is a one-line append).
- Embed both at the top of `README.md` after the first paragraph with alt text.
- Out of scope: real-phone photos (owner may replace later); any page change.

**Acceptance.**
- The README renders both images on GitHub; the files are tracked; `git status` clean after `git add .` (the
  gitignore exception works).

**Verification.** View the README on the pushed branch; completion entry notes the sizes.

---

### WQ-042 — Set the GitHub repository description, topics, website and social preview

- **Status:** blocked:owner-machine · **Priority:** P2 · **Size:** S · **Track:** docs · **Env:** owner-machine
- **Added:** 2026-10-25 by public-release review session
- **Depends on:** — · **Blocks:** —

**Context.** The repository `Tangineering/Trigger-Trainer` is public with Pages enabled, but the GitHub API shows no
description, no topics and no homepage, and no social preview image is set (checked 2026-10-25). Search and link
previews therefore show a bare name. These are repository settings only the owner can change; no agent tool in this
project writes them.

**Scope.** (owner, about five minutes, on github.com → repository → ⚙ next to About, and Settings → General → Social
preview)
- Description: "Free phone-based trigger-finger discipline trainer for pistol classes. No install, no accounts, no
  data collection."
- Website: `https://tangineering.github.io/Trigger-Trainer/` (tick "Use your GitHub Pages website").
- Topics: `firearms-training`, `dry-fire`, `trigger-discipline`, `pwa`, `devicemotion`, `static-site`,
  `github-pages`, `javascript`, `training-aid`.
- Social preview: a 1280×640 image; the WQ-041 start-screen screenshot on the dark background will do until a
  designed one exists.
- Out of scope: branch protection (decide once WQ-033's check exists); GitHub Discussions.

**Acceptance.**
- Owner-verifiable: the About box shows description, website and topics; a pasted repo link previews with the image.

**Verification.** Owner reports done; the archiving session confirms via the GitHub API (`search_repositories`
with `minimal_output: false` shows `description`, `homepage`, `topics`).

---

### WQ-043 — Offline use: cache the page with a service worker (D-121)

- **Status:** queued · **Priority:** P2 · **Size:** M · **Track:** platform · **Env:** any
- **Added:** 2026-10-25 by public-release review session (Ricky promoted idea I-11, D-121)
- **Depends on:** WQ-037 · **Blocks:** —

**Context.** Ranges and training halls often have no signal. After the first load the page needs nothing from the
network (hard constraint 3), yet a reload with no connection fails, and the iOS home-screen app shows the Safari
error page. D-121 (Ricky, 2026-10-25) adds a service worker to the static companions, relaxing hard constraint 1's
file list; constraints 2 and 3 are untouched (the worker only caches the site's own files, no network calls
elsewhere). The manifest already declares `display: fullscreen`, `orientation: landscape` and `start_url ./`.

**Scope.**
- Add `sw.js` at the repo root (same scope as the page): install caches `./`, `index.html`, `engine.js`,
  `manifest.webmanifest`, `icon.svg` and the WQ-037 PNGs under a cache name that embeds the engine `VERSION`
  (read by fetching `engine.js`? No: the worker cannot `require` it; instead the page registers the worker with
  `?v=<TDT.VERSION>` and the worker takes the version from its own URL, so a version bump produces a new cache and
  the old one is deleted on activate). Strategy: network first with cache fallback for `index.html` and `engine.js`
  (so a deploy reaches the phone when online), cache first for the icons.
- Register from `index.html` after Start, inside a feature check (`'serviceWorker' in navigator`) and a try/catch;
  failure changes nothing. No update prompt UI; a short note in Settings' version line ("offline ready") once the
  worker controls the page is enough, in the existing `versionLine` element (`index.html:1332`).
- Document: README "Use it" gets one line ("after the first load the page works without a connection"); CLAUDE.md
  hard constraint 1 companion list and "Layout of this repo" get `sw.js` (append); `docs/ARCHITECTURE.md` (WQ-039)
  gets a paragraph if it exists.
- Out of scope: caching anything cross-origin (nothing is loaded cross-origin; keep it so); background sync,
  push, periodic update checks; any engine change. Touches `index.html`: not in parallel with WQ-032, WQ-034,
  WQ-037, WQ-044.

**Acceptance.**
- Agent-verifiable: a Playwright test (new section in `tests/smoke.js` or a small `tests/offline.js` served from a
  local static server) loads the page, waits for the worker to control it, switches the context offline, reloads and
  finds `#startOv` rendered and `TDT.VERSION` the same; after changing the registered version string the old cache
  is gone. `npm test` passes; recordings unchanged; engine `VERSION` unchanged (the page's outputs for the same
  inputs are identical; the worker is outside the engine).
- Owner-verifiable: on the iPhone 15 (home-screen app and Safari tab) and an Android phone, load once online, enable
  flight mode, reopen: the trainer starts and drills run; after a deploy, the next online open picks up the new
  version within two loads.

**Verification.** The offline test in the suite; owner check recorded in the completion entry with the engine
versions seen before and after a deploy.

---

### WQ-044 — Accessibility pass on the page (D-121)

- **Status:** queued · **Priority:** P3 · **Size:** S · **Track:** ui · **Env:** browser
- **Added:** 2026-10-25 by public-release review session (Ricky promoted idea I-12, D-121)
- **Depends on:** — · **Blocks:** —

**Context.** `index.html` carries three `aria-` attributes in total, `user-scalable=no` in the viewport meta
(`index.html:5`), and a full-screen white flash on every shot (`#flash`, `index.html:103`–105, 0.75 → 0 opacity in
120 ms) with no `prefers-reduced-motion` or reduced-flash handling. The alarms are loud by design and the start
screen warns about them (`index.html:226`), but nothing warns about the flash. A motion drill is inherently visual
and physical, so this is a bounded pass, not a WCAG programme.

**Scope.**
- Add one sentence about the shot flash to the start screen's warning box (`index.html:226`) and honour
  `prefers-reduced-motion: reduce` by replacing the full-screen flash with a brief border or trigger highlight
  (keep the `shot` sound unchanged).
- Add a Settings toggle **Shot flash** (default on; stored only when changed, D-64) so a photosensitive student can
  turn it off without changing the system setting. Keep the audible and vibration cues.
- Label the interactive controls: `aria-label` on icon-only buttons (**● REC**, Set downrange, the picker's
  Choose/Cancel if they are icon-only), `role="dialog"` + `aria-modal` on the overlays (`#startOv`, Settings,
  summary, `#drillOv`, `#drillResOv`), `aria-live="polite"` on `#drillLine` and the status pill so a screen reader
  announces the phase. Keep `user-scalable=no` (the drill needs a stable layout) but document why in a comment.
- Check colour contrast of the status pill texts and the `tip` class against the dark background with a contrast
  checker; fix anything under 4.5:1 that is text.
- Out of scope: engine changes; keyboard operation of the drill itself (it is a touch and motion drill); redesign.
  Touches `index.html`: not in parallel with WQ-032, WQ-034, WQ-037, WQ-043.

**Acceptance.**
- With `prefers-reduced-motion: reduce` emulated in Playwright, a shot produces no `#flash.go` opacity animation;
  with the toggle off the same holds under normal motion settings; with both default the flash is unchanged.
- The ARIA attributes are present (Playwright assertions); contrast figures recorded.
- `npm test` passes; engine `VERSION` unchanged; the setting round-trips through `localStorage` only when changed.

**Verification.** New smoke checks; contrast numbers and screenshots in the completion entry.

---

### WQ-045 — Tell the user when no motion data arrives after Start

- **Status:** blocked:owner-machine · **Priority:** P1 · **Size:** S · **Track:** platform · **Env:** any
- **Added:** 2026-10-25 by public-release review session · **Updated:** 2026-10-25 by the orchestration session (round-20261025-5, execution agent on opus): the agent half landed in 7d4cdc3 (merged on the orchestration branch): `index.html` records `lastMotionT` on the page clock in `onMotion` (an all-null `devicemotion` event does not count, D-123 e), `updateMotionBanner(t)` in `tick()` opens `#motionBanner` (rear ~46 % of the slide, `pointer-events: none`, D-123 a) after 2 s with no sample since Start or 5 s with no sample while running, visible and landscape, the first sample hides it, the engine is never paused; the fix line follows the feature check (Safari steps where `DeviceMotionEvent.requestPermission` exists in a secure context, else "Open the page over HTTPS on a phone"); the pill reads "NO MOTION · <state>" (D-124); `__tdt()` adds `motionSeen`, `motionBannerOpen`; the old `#warnLine` "No motion sensor data" text is gone (D-123 d); smoke block `// WQ-045` (10 checks); `docs/CLASS_USE.md` note; `CLAUDE.md` block. `npm test` exit 0 in the worktree (replay 46 recordings, smoke incl. the new block, roundtrip; 0 FAIL), engine `VERSION` 0.17.0 unchanged, no recording changed. Remaining, owner half: (1) iPhone 15, Safari: open the deployed page, tap Start, tap **Don't Allow** on the motion prompt → after about 2 s the banner "No motion data. The alarms cannot work." with the Safari steps, and the pill prefixed NO MOTION; follow the steps (close the tab, reopen, Allow) → no banner and the alarms work. (2) Pixel 11 or S20+, Chrome: normal use → the banner never appears, including after a return from the background. Report both in a chat line
- **Depends on:** — · **Blocks:** —

**Context.** `start()` (`index.html:1194`–1211) awaits `DeviceMotionEvent.requestPermission()` inside a try/catch and
ignores the result, binds `onMotion` (`index.html:886`) and starts the trainer. If the student taps **Don't Allow** on
iPhone, has Motion & Orientation Access off in Safari settings, opens the page on a laptop or over plain HTTP, no
`devicemotion` sample ever arrives: the movement alarm, the drift limit and the 180 rule are silently inert, the
drills still beep and count shots, and the only hint is the debug readout's "no motion data yet" line
(`index.html:1168`). iOS remembers a denial for the site until the tab is closed (or Safari's site settings are
reset), so the student cannot fix it by tapping Start again. The page already has an overlay pattern for a blocking
condition (`#rotateOv`, `index.html:354`) and a status pill (`#status`, `index.html:200`).

**Scope.**
- Track the time of the last `devicemotion` sample in `index.html` (page state, not the engine). From Start, if no
  sample has arrived within 2 s while the page is visible and landscape, show a non-modal banner over the slide:
  "No motion data. The alarms cannot work." plus the platform-specific fix chosen by feature checks, not user agent
  (D-53): where `DeviceMotionEvent.requestPermission` exists, "Close this tab, reopen the link and tap Allow; or
  Settings → Safari → Motion & Orientation Access"; otherwise "Open the page over HTTPS on a phone". Hide it at the
  first sample. Do not pause the engine (a laptop demo with the mouse fallback must keep working): the banner informs.
- Also show the banner when samples stop for more than 5 s while running (a tab moved to the background and back
  without motion on some Android builds); hide on the next sample.
- Put the same state into the status pill text ("NO MOTION") while the banner shows, and into `window.__tdt()` as
  `motionSeen` and `motionBannerOpen`.
- `docs/CLASS_USE.md` "Student setup" gets the iPhone fix as a one-line note (append).
- Out of scope: engine changes; the recorder; changing the permission flow itself (the prompt can only be shown once
  per tab by iOS). Touches `index.html`: not in parallel with WQ-032, WQ-034, WQ-037, WQ-043, WQ-044.

**Acceptance.**
- Agent-verifiable: a `tests/smoke.js` section starts the trainer with no `DeviceMotionEvent` dispatched and sees the
  banner and the pill after 2 s; dispatches one sample and sees both clear; the existing sections (which dispatch
  motion within 2 s of Start) are unchanged and still pass. `npm test` passes; recordings unchanged; engine
  `VERSION` unchanged.
- Owner-verifiable: on the iPhone 15, tap **Don't Allow**: the banner appears with the Safari instructions; follow
  them and the trainer works. On an Android phone the banner never appears in normal use.

**Verification.** The smoke section; owner check recorded in the completion entry.

---

### WQ-046 — Deploy the public page from a release branch instead of main (Q19)

- **Status:** blocked:user · **Priority:** P2 · **Size:** S · **Track:** hygiene · **Env:** any
- **Added:** 2026-10-25 by public-release review session
- **Depends on:** — · **Blocks:** —

**Context.** GitHub Pages serves `main` from the root (README "Deploy", `README.md:31`–35; the Pages workflow runs on
every push to `main`, 49 runs so far). Every merged item is therefore live at once, before its owner-verifiable half:
WQ-031 (one-finger rule) reached the public page on 2026-10-25 with its iPhone and Android checks still open. With
the link now public, "merged" and "released" should be different states.

**Owner decision needed.** (Q19 in `OPEN_QUESTIONS.md`) Which of these:
- (a) A `release` branch: Pages serves `release`; you fast-forward it to `main` after the phone pass (one command, or
  a button in a tiny manual workflow). Simple, visible in the branch list, no tags required.
- (b) Tags: Pages deploys via a GitHub Actions workflow triggered by pushing a `vX.Y.Z` tag (WQ-038's convention),
  so a release is exactly a tag. Cleaner history, one more workflow file, and the Pages source switches from
  "branch" to "GitHub Actions".
- (c) Keep deploying `main` and accept that the phone pass happens on the live page (status quo).
One line answers it; (a) is the smaller change.

**Scope.** (once decided; written for (a), adjust for (b))
- Create `release` from the current `main` and switch Pages to it (owner: repository Settings → Pages → Branch;
  record the step in the completion entry).
- README "Deploy" and `docs/CLASS_USE.md` "Before class" (append): the public page follows `release`; `main` is the
  development branch; how to release (`git push origin main:release` after the owner check).
- `.claude/skills/work-queue-run/SKILL.md`: the archive step notes whether an item is on `release` yet, so the
  completion entry says when it reached the phones (append one bullet).
- Out of scope: branch protection (WQ-047); the tag convention itself (WQ-038); any page change.

**Acceptance.**
- The Pages workflow runs for pushes to the chosen source and not for `main`; the live page serves the engine
  version of that source (owner reads the `Engine x.y.z` line in Settings).
- README and the run skill describe the flow.

**Verification.** Actions run list after one release push; owner confirms the version line.

---

### WQ-047 — Protect main: require a pull request and the replay check

- **Status:** blocked:owner-machine · **Priority:** P2 · **Size:** S · **Track:** hygiene · **Env:** owner-machine
- **Added:** 2026-10-25 by public-release review session
- **Depends on:** — (WQ-033 landed 2026-10-25: the `replay` job exists) · **Blocks:** —

**Context.** `main` has no protection: any push lands and deploys. Once WQ-033 gives the repository a `replay` check
on pull requests, a branch rule can require it. Repository settings are the owner's; the queue's own flow (merge
commits from item branches, `queue:` commits straight to `main` by orchestration sessions) has to keep working, so
the rule must allow the owner's own pushes.

**Scope.** (owner, Settings → Rules → Rulesets → New branch ruleset, target `main`)
- Require status check `replay` (the WQ-033 job name) to pass before merging.
- Require a pull request before merging, 0 approvals (you are the only maintainer), with a bypass for the
  repository admin so orchestration sessions can still push `queue:` commits and merge item branches directly.
- Block force pushes and deletion of `main`.
- Then update `.claude/skills/work-queue-run/SKILL.md` (append): outside contributors' work arrives as pull
  requests and needs the check green; the orchestrator's merges use the bypass.
- Out of scope: required reviews from others; protecting `release` (fold in when WQ-046 lands: same rule, no PR
  requirement).

**Acceptance.**
- Owner-verifiable: a pull request from a fork with a failing replay suite cannot be merged; the owner's direct push
  of a `queue:` commit still lands.

**Verification.** Owner reports the ruleset; the next orchestration round confirms its `queue:` push works and
records it in this item's completion entry.

---

## Parking lot

Ideas noted but not yet turned into items (an exploratory session may
promote one with `work-queue-add`):

- **Browser suites in CI** (from WQ-036, 2026-10-26): the smoke press block is deterministic now (held test clock, D-126), so a
  `browser` job in `.github/workflows/test.yml` (install Playwright's Chromium, run `tests/smoke.js` and `tests/roundtrip.js`)
  is possible; keep `replay` as the only required check until the browser job has a record. Also move `actions/checkout`
  and `actions/setup-node` to v5 (WQ-033 saw the Node 20 runner deprecation warning).
- **Compact landscape start screen** (from WQ-032, 2026-10-25): at 375–393 px height **Start** sits 500 px down `#startOv`,
  below the fold; a smaller landscape layout would show it without scrolling. Pre-existing, not caused by WQ-032.
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
- **Custom domain for the public page** (public-release review, 2026-10-25): waiting on Q21 (`OPEN_QUESTIONS.md`) for
  the hostname; then one owner-machine item (DNS CNAME, Pages setting, `CNAME` file on the served branch), sequenced
  before WQ-037 and WQ-043 and after Q19.
- **Move the planning files (`WORK_QUEUE.md`, `WORK_COMPLETED.md`, `OPEN_QUESTIONS.md`, `CLAUDE.md`, `.claude/`) out of
  the repository root** so a GitHub visitor sees the product files first. Waiting on Q20 (`OPEN_QUESTIONS.md`): every
  skill, `scripts/wq.py` and the manuals cite the root paths, so it is one careful commit once Ricky decides.
- **`CLAUDE.md` says recordings go "one folder per phone"** — the 2026-10-20 set has been moved to
  `pixel-11/`; nothing left to do unless a second Pixel appears.
