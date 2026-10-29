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
next_id: WQ-054
updated: 2026-10-29
```

## Index

| ID | Title | Pri | Size | Status | Depends on | Track |
|----|-------|-----|------|--------|------------|-------|
| WQ-051 | Class Low Ready: shared-clock start beeps when a class code is entered (D-135, D-136) | P1 | L | blocked:owner-machine | — | drills |
| WQ-031 | Let only one fresh touch control the engine; ignore later fingers (D-113, D-115) | P1 | M | blocked:owner-machine | — | alarm |
| WQ-006 | Record axis and clean-press drills on an iPhone and a second Android phone | P1 | S | blocked:owner-machine | — | recordings |
| WQ-045 | Tell the user when no motion data arrives after Start | P1 | S | blocked:owner-machine | — | platform |
| WQ-050 | Stale motion data pauses the trainer and opens Settings (D-134) | P1 | M | queued | — | platform |
| WQ-053 | Class code is session-only: cleared on a new session from the start screen (D-139) | P1 | S | queued | — | drills |
| WQ-023 | Find out why the shot vibration never fires on Android | P2 | S | blocked:owner-machine | — | platform |
| WQ-037 | Add PNG home-screen icons for iOS and Android | P2 | S | blocked:owner-machine | — | ui |
| WQ-042 | Set the GitHub repository description, topics, website and social preview | P2 | S | blocked:owner-machine | — | docs |
| WQ-043 | Offline use: cache the page with a service worker (D-121) | P2 | M | blocked:owner-machine | — | platform |
| WQ-047 | Protect main: require a pull request and the replay check | P2 | S | blocked:owner-machine | — | hygiene |
| WQ-049 | Run the browser suites (smoke, roundtrip) in GitHub Actions | P2 | S | queued | — | hygiene |

Status values: `queued` · `claimed:<session or round>` · `blocked:<what>` ·
`blocked:user` (needs a decision only the owner can make — the item says which)
· `blocked:owner-machine` (needs data, hardware or a platform only the owner
has — the item says exactly what to run).

Mechanical edits (claim, un-claim, archive, invariant check) go through
`python scripts/wq.py …` (any Python 3, stdlib only); see `work-queue-run`.

Tracks: axis · platform · recordings · grading · alarm · layout · decisions · docs · ui · drills · hygiene

---

## Items

### WQ-051 — Class Low Ready: shared-clock start beeps when a class code is entered (D-135, D-136)

- **Status:** blocked:owner-machine · **Priority:** P1 · **Size:** L · **Track:** drills · **Env:** any
- **Added:** 2026-10-27 by queue-add session (Ricky's request) · **Updated:** 2026-10-27 by the same session (Q22 answered,
  D-136: no separate drill — an optional class code entered when choosing Low Ready turns the shared clock on; 10 s cycle;
  a phone not ready at a slot stays silent and waits for the next one; status queued); 2026-10-27 by the orchestration session (orchestrated-feature round, Opus implementer, Sonnet test writer, Opus + Sonnet
  reviewers): the agent half landed in 92afd28 on `ccr-c9b0912d-5568lc` — `engine.js` 0.18.0 (`startDrill(t, id, seed, wall)`,
  `slotAt` / `nextSlotAfter`, silent skip, `syncWall`, rows `r`+wall and `w`, `DEFAULTS.classCycleMs`), page (class code field,
  Class cycle slider, countdown line, results row), synthetic `drill-low-ready-class`, replay / smoke / roundtrip sections,
  docs and D-137; `npm test` 946 PASS / 0 FAIL (replay 47 recordings, all 46 earlier ones byte-identical); screenshots in
  `docs/screenshots/wq-051/`. Deviations: the jitter seed uses `Math.imul` (D-137 f); the cycle is floored at 3 s; Choose stores
  the code only with Low Ready highlighted (D-137 c). Remaining, owner half (iPhone 15 and Pixel 11 side by side, deployed page):
  same code on both, fingers on the frame right after a beep → the next five beeps sound as one; results open on both with five
  reps and a Class code row; a phone that lifts the finger before a beep stays silent and rejoins at a later beep. Not on
  `release` yet
- **Depends on:** — · **Blocks:** —

**Context.** Ricky (2026-10-27): Low Ready is run in class with the whole room on it at once, but every phone draws
its own start-beep delay (`engine.js:567-569`, `d.dueAt = t + lo + d.rng() * (hi - lo)` from the run's seeded
`mulberry32`, and again after each cue at `engine.js:628-629`), and the delay only starts when *that* phone's finger
is on the frame. Twenty phones therefore beep at twenty different moments, every student hears everyone else's beeps,
and reaction times cannot be compared. The phones have no connection to each other and must not get one (hard
constraint 3), so synchronisation comes from the one thing every phone shares: the wall clock. Network-set clocks
agree across a room to within tens of milliseconds. D-135 (Claude, proposed) is the design; D-136 (Ricky) accepts it
and settles the open points: it is **not** a separate drill — the instructor announces a **class code**, each student
types it when choosing Low Ready, and the code seeds the shared schedule; no code → the ordinary Low Ready (D-96).

**Scope.**
- `engine.js` (`VERSION` 0.17.0 → 0.18.0). `startDrill(t, id, seed, wall)` (`engine.js:691`) takes an optional
  fourth argument, the page's wall-clock reading (`Date.now()`, ms) taken at the same instant as `t`; when it is a
  finite number and the def is `lowready`, the run is **shared**: `d.shared = true`, `d.wallOff = wall - t`. Any
  other def ignores `wall`. Shared schedule (D-135): slot `k` (integer ≥ 0) beeps at wall time
  `k * S.classCycleMs + jitter(k)` with `jitter(k) = mulberry32((seed + k * 0x9E3779B9) >>> 0)() * K.CLASS_JITTER_MS`
  (3000) — a pure function of the clock and the class code, so every phone with the same code agrees to the ms. In
  `tickDrill` (`engine.js:561`), for a shared run: where the ordinary run draws `dueAt` (rep 1 at the first armed tick
  on the frame, `engine.js:567`; later reps at the cue, `engine.js:628`), the shared run sets `dueAt` to the first
  slot whose wall time is at least `K.CLASS_JOIN_MS` (1500) after the current `t + wallOff`. At the first tick with
  `t >= dueAt`: if the finger is on the frame for at least `DRILL_BEEP_HOLD_MS` (the existing condition at
  `engine.js:573`) the beep fires as today; otherwise (D-136 e) the slot is skipped silently and `dueAt` moves to the
  next slot after `t + wallOff` (no join margin needed). The run's `rng` is not used for delays in a shared run. New
  engine method `syncWall(t, wall)` updates `d.wallOff` of a shared run (no-op otherwise); the page calls it whenever
  running resumes, since `performance.now()` and `Date.now()` can part company while the page is hidden. New
  `DEFAULTS.classCycleMs: 10000` (read only in `tickDrill`). Rep result and run result add `shared: true` in a shared
  run (absent otherwise, so the ordinary Low Ready result object is byte-identical). Row format (`engine.js:835`,
  `docs/RECORDINGS.md`): `['r', t, drill, seed, wall]` — the fifth element is absent in every existing recording and
  `replay` passes `undefined`; `['w', t, wall]` → `syncWall`. All 46 recordings must replay to identical events.
- `index.html`. Picker: when Low Ready is highlighted, a text field **Class code (optional)** with the hint "Everyone
  in the room enters the same code; beeps then sound at the same time on every phone. Leave empty to train alone."
  appears under the diagram; **Choose** stores it in `localStorage['tdt.classCode']` (trimmed; the key is removed when
  empty), like `drillSel` (`index.html:1406-1407`). The code is a short word or number; the page turns it into the
  engine seed with a 32-bit FNV-1a hash of the lower-cased trimmed string (a small page function, tested in smoke).
  `beginDrillRun(t)` (`index.html:695-697`): for Low Ready with a code, `engine.startDrill(t, 'lowready', hash, wall)`
  with `wall = Date.now()` taken next to `t`, and `logRow(['r', t, 'lowready', hash, wall])`; without a code, as today.
  Where running resumes (the `tick` un-pause path and `visibilitychange`), `engine.syncWall(t, Date.now())` and
  `logRow(['w', t, wall])` for a shared run. Start-screen drill button shows "Low Ready · class <code>". Settings →
  Other: slider **Class cycle** (`classCycleMs`, 6–30 s, step 1 s, shown in seconds; D-136 default 10 s).
  `drillLineText` (shared run): "Rep n of 5 · next beep in m s" (ceil of the seconds to `dueAt`), "Rep n of 5 ·
  finger on the frame" when a slot was skipped and the finger is off; the rest as Low Ready. Results: `lowReadyRows`
  unchanged; a "Class code" row at the top of a shared run's results. Recorder label `drill-low-ready-class`.
- `tests/`: synthetic shared recording + expectation (`tests/make-synthetic.js`, `tests/expectations.js`) with a known
  `wall`, so every beep's wall time is asserted to the ms and lies on the schedule; smoke section `WQ-051`: (1) two
  engines created in Node-style via the page's `TDT` with the same code and `wall` and different `t` emit `drillBeep`
  at the same wall times for all five reps; (2) finger off the frame at a slot → no beep, the next slot beeps; (3)
  picker field shows only for Low Ready, empty code → ordinary run (`['r', …]` row has four elements); (4) hash is
  stable and case-insensitive; roundtrip press sequence for a shared run. `window.__tdt().drill` adds `shared`,
  `nextBeepIn`; `window.__tdt()` adds `classCode`.
- Docs: `CLAUDE.md` WQ-051 block (append) and the Low Ready line of the Behavior spec; `docs/CLASS_USE.md` Low Ready
  bullet gains the class script ("announce a code, everyone types it, finger on the frame right after a beep, you all
  join the next one"); `CHANGELOG.md` 0.18.0 section; `docs/RECORDINGS.md` rows `r` (fifth element) and `w`;
  D-135 status → active.
- Out of scope: Bill, Box, Transitions; an instructor master phone (needs a connection); microphone beep detection.

**Acceptance.**
- `npm test` passes; `npm run test:replay` reports every existing recording unchanged.
- Two engines with the same code and `wall`, different `t` and start times inside one cycle, emit `drillBeep` at
  identical wall times for five reps; different codes give different jitter.
- A phone whose finger is off the frame (or on it under 350 ms) at a slot stays silent and beeps at the next slot it
  is ready for.
- Without a code the `r` row has four elements and the run is the ordinary Low Ready.
- Owner-verifiable (iPhone 15 and Pixel 11 side by side, deployed page): same code on both, fingers on the frame right
  after a beep → the next five beeps sound as one; results open on both with five reps; a phone that lifts the finger
  before a beep stays silent and rejoins at a later beep.

**Verification.** `npm test`; the two-engine check as a smoke assertion; screenshots of the picker with the code field
(844×390 and portrait), the countdown drill line and the results in `docs/screenshots/wq-051/`. Record in the
completion entry the hash function used and any replay or layout deviation.

---

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

- **Status:** blocked:owner-machine · **Priority:** P2 · **Size:** S · **Track:** ui · **Env:** any
- **Added:** 2026-10-25 by public-release review session · **Updated:** 2026-10-26 by the orchestration session (round-20261025-6, execution agent on opus): the agent half landed in fafba65 (merged on the orchestration branch): `scripts/render-icons.js` (system Playwright Chromium, no dependency) renders `icon.svg` to `icon-180.png` (opaque, corners filled with the icon's #121417 since iOS masks itself), `icon-192.png`, `icon-512.png` (purpose `any`) and a fourth file `icon-maskable-512.png` (the artwork at 0.75 scale on a full-bleed background, farthest artwork pixel 198 px from the centre against the 204.8 px safe circle; the unpadded art reaches ~264 px, so `icon-512.png` is not marked maskable, D-127); `<link rel="apple-touch-icon" href="icon-180.png">` after the SVG icon link; the manifest keeps the SVG first and adds the three PNG entries; smoke block `// WQ-037` serves the tree over a throwaway HTTP server and checks 200 for the page, the manifest and every icon with its stated size; CLAUDE.md constraint 1 companions and layout, README "Develop" render command. `npm test` exit 0 (replay 46 recordings, smoke, roundtrip; 0 FAIL), engine `VERSION` 0.17.0 unchanged. Remaining, owner half, from the deployed page: (1) iPhone 15 Safari → Share → **Add to Home Screen** → the trainer icon (dark square, green strip), not a page screenshot; (2) Pixel 11 or S20+ Chrome → menu → **Add to Home screen** / Install → the icon in the prompt and on the launcher, with the round or squircle crop showing the whole pistol. Report both in a chat line. WQ-043 may proceed on the agent side (it only needs the files to exist)
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

- **Status:** blocked:owner-machine · **Priority:** P2 · **Size:** M · **Track:** platform · **Env:** any
- **Added:** 2026-10-25 by public-release review session (Ricky promoted idea I-11, D-121) · **Updated:** 2026-10-26 by the orchestration session (round-20261025-7, execution agent on opus): the agent half landed in 6c7bcec (merged on the orchestration branch): `sw.js` (version from `?v=`, cache `tdt-<VERSION>` holding `./`, `index.html`, `engine.js`, `manifest.webmanifest`, `icon.svg` and the four PNG icons; page, engine and manifest network first with cache fallback, icons cache first; only GET, only this origin, only the listed paths; old `tdt-` caches deleted on activate; `skipWaiting` + `clients.claim`, D-128); `registerOffline()` at the end of `start()` registers `sw.js?v=<TDT.VERSION>` with `updateViaCache: 'none'` only on http(s) with service workers, in a try/catch; `renderVersionLine()` appends " · offline ready" once a worker controls the page; smoke block `// WQ-043` (9 checks on a localhost server: registration, cache name and contents, offline reload shows `#startOv` with the same `TDT.VERSION`, no request leaves the origin, a new version string leaves only the new cache); README "Use it" line, CLAUDE.md constraint 1 and layout, `## WQ-043` block, ARCHITECTURE "Files served" paragraph. `npm test` exit 0 (replay 46 recordings, smoke, roundtrip; 0 FAIL); engine `VERSION` 0.17.0 unchanged. Deviations: manifest network first (D-128 b); no network timeout before the cache answers (D-128 e, a follow-up if reloads on a weak signal feel slow). Remaining, owner half, from the deployed page: (1) iPhone 15, as a home-screen app and as a Safari tab, and (2) a Pixel 11 or S20+: load once online, tap Start (the worker registers at Start; Settings then shows "Engine 0.17.0 · offline ready" on the next open), turn on flight mode, close and reopen → the trainer starts and a drill runs; (3) after the next deploy, open online: the Settings engine line shows the new version within two loads. Report in a chat line
- **Depends on:** — (WQ-037's files landed 2026-10-26; its owner check is independent) · **Blocks:** —

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

### WQ-047 — Protect main: require a pull request and the replay check

- **Status:** blocked:owner-machine · **Priority:** P2 · **Size:** S · **Track:** hygiene · **Env:** owner-machine
- **Added:** 2026-10-25 by public-release review session · **Updated:** 2026-10-27 by review-triage session: WQ-049 adds a `browser` job; keep `replay` as the only required check until that job has a record of green runs, then add `browser`
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

### WQ-053 — Class code is session-only: cleared on a new session from the start screen (D-139)

- **Status:** queued · **Priority:** P1 · **Size:** S · **Track:** drills · **Env:** any
- **Added:** 2026-10-29 by review session (Ricky's decision D-139 in chat, 2026-10-29)
- **Depends on:** — · **Blocks:** —

**Context.** WQ-051 (D-136, D-137 c) keeps the Low Ready class code in `localStorage['tdt.classCode']`: `index.html:690`
(`CLASS_KEY`), `:692`–693 (`classCode` loaded at page load), `:1452`–1456 (**Choose** with Low Ready highlighted stores
the cleaned code or removes the key). So a code typed in class is still there days later, the start button keeps reading
"Low Ready · class CODE" and a student who forgot it gets the shared-clock run instead of the ordinary Low Ready. Ricky
(2026-10-29, D-139): the code clears itself on a new session from the start screen; **Again** on the results screen keeps
it. D-139's reading: the code is session-only (in memory, never stored), **New session** clears it, **Change drill** and
**Again** keep it. Paths: `beginDrillRun(t)` (`index.html:726`, reads `classCode`), `leaveToStart()` (`index.html:737`,
called by **Change drill** `#drillChange` and **New session** `#sumNew`), `$('drillAgain')` (`index.html:1460`, calls
`beginDrillRun` directly), `openPicker()` (`index.html:723`, fills `#classCode` from `classCode`), `renderDrillBtn`
(`index.html:705`, the "· class CODE" suffix), `showDrillResult` (`index.html:750`, the Class code row reads `classCode`).
Smoke checks that assert the stored key: `tests/smoke.js:2245`, `:2247`–2252, `:2265`–2275, `:2291` (`ls('tdt.classCode')`).

**Scope.**
- `index.html` only; engine 0.18.1 unchanged; nothing new is logged (a shared run still logs its `r` row with the wall
  clock; a run without a code logs the four-element row as today).
- `classCode` stays a page variable but is never written to `localStorage`: **Choose** (`index.html:1452`–1456) sets
  `classCode = cleanCode($('classCode').value)` only while Low Ready is highlighted (D-137 c unchanged) and no longer
  calls `setItem`. At load (`index.html:692`–693) start with `classCode = ''` and remove a stale `tdt.classCode` key once
  (`try { localStorage.removeItem(CLASS_KEY); } catch (e) {}`), so phones that stored a code under 0.18.0 / 0.18.1 start
  clean. Keep `CLASS_KEY` for that removal; update the comment at `index.html:688`–689 (session-only, D-139).
- **New session** (`#sumNew`): clear `classCode` (`classCode = ''`) before `leaveToStart()` so the start button and the
  picker field show no code. **Change drill** (`#drillChange`) and **Again** (`#drillAgain`) do not touch it. Put the
  clearing in the `#sumNew` handler (or a `clearClassCode()` helper it calls), not in `leaveToStart()`, since
  **Change drill** shares that function.
- `window.__tdt().classCode` keeps reporting the in-memory code.
- `tests/smoke.js` WQ-051 section: the checks that read `ls('tdt.classCode')` change to the in-memory value through
  `__tdt().classCode` (`:2245` "Choose stores the trimmed code" → stored in memory and `tdt.classCode` absent; `:2267`
  Box leaves it untouched; `:2270` blank removes it; `:2273` whitespace; `:2275` 24-char cap; `:2291` Restore defaults keeps
  it). Add checks: (1) **New session** from the summary clears the code (`__tdt().classCode === ''`, `#drillBtn` text has
  no "class"); (2) after a shared run ends, **Again** keeps the code and starts another shared run (`drill.shared`);
  (3) **Change drill** keeps the code and the picker field shows it; (4) a page reload with `tdt.classCode` pre-seeded in
  `localStorage` starts with no code and the key removed. Keep every other check. The WQ-051 roundtrip section
  (`tests/roundtrip.js`) sets the code through the picker in the same page; check it still passes unchanged.
- Docs: `docs/CLASS_USE.md:67`–69 (class code paragraph): say the code lasts for the session and is cleared by **New
  session** and by reopening the page; **Again** repeats the class run. `CLAUDE.md` WQ-051 block, Behavior and Page
  paragraphs: `localStorage['tdt.classCode']` → in memory only, cleared at load and by **New session** (D-139); `CLASS_KEY`
  only removes a stale key. `CHANGELOG.md` `[Unreleased]` **Changed**: the class code no longer survives a new session
  or a reload (page change, no engine version change). `docs/ARCHITECTURE.md`, `README.md`, `docs/RECORDINGS.md`: only if they
  state that the code is stored (`grep -n "classCode\|class code"`).
- Out of scope: `engine.js`; the drill selection key `tdt.drill` (still stored); the slider `classCycleMs`; WQ-050's
  motion-banner code in `index.html` (do not run in parallel with WQ-050: both edit `index.html`).

**Acceptance.**
- Agent-verifiable: `grep -n "setItem(CLASS_KEY" index.html` finds nothing; `npm test` passes (replay, smoke, roundtrip)
  with every recording replaying to identical events and engine `VERSION` still 0.18.1; the four new smoke checks pass;
  `docs/CLASS_USE.md`, `CLAUDE.md` and `CHANGELOG.md` updated as above; `python scripts/wq.py check` passes.
- Owner-verifiable: on a phone, choose Low Ready with a code, run it, tap **Again** (still a class run, the drill line
  counts down to the next beep), finish, **New session** → the start button reads "Low Ready" with no code and the next run
  is the ordinary Low Ready; reopen the page → no code.

**Verification.** `npm test` totals (PASS / FAIL) in the completion entry; the D-139 row exists in `docs/DECISIONS.md`
(added with this item).

---

### WQ-049 — Run the browser suites (smoke, roundtrip) in GitHub Actions

- **Status:** queued · **Priority:** P2 · **Size:** S · **Track:** hygiene · **Env:** any
- **Added:** 2026-10-27 by review-triage session (promoted from the parking lot; ChatGPT's blind review of 2026-10-26 raised it as its first finding)
- **Depends on:** — · **Blocks:** —

**Context.** `.github/workflows/test.yml` (WQ-033) runs one job, `replay`, which executes `node tests/replay.js` only.
`tests/smoke.js` (browser state machine, icons, offline, accessibility) and `tests/roundtrip.js` (record in the page,
replay in Node) run only when a contributor remembers `npm test` locally; `README.md:89`–90 says so. A change can pass
the replay suite and still break Start, the touch wiring, the recorder or the service worker. WQ-036 (D-126) made the
smoke press block deterministic (held test clock), which was the reason the browser suites were kept out of CI.
Both suites use `require('playwright')` and `chromium.launch()` with no options (`tests/smoke.js:3`, `:19`;
`tests/roundtrip.js:4`, `:22`); `package.json` pins `playwright` 1.63.0 and has no lockfile.

**Scope.**
- Add a second job `browser` to `.github/workflows/test.yml`: checkout, `actions/setup-node` with Node 22, `npm install`
  (no lockfile, so not `npm ci`), `npx playwright install --with-deps chromium`, then `node tests/smoke.js` and
  `node tests/roundtrip.js` as two steps so the log shows which suite failed. Same `permissions: contents: read`.
- Move `actions/checkout` and `actions/setup-node` to v5 in both jobs (WQ-033 saw the Node 20 runner deprecation
  warning on v4).
- Keep `replay` as the only check WQ-047 requires until `browser` has a record of green runs; say so in a comment in
  the workflow file and in WQ-047's Updated line.
- `README.md:89`–90: the two sentences become "All three suites run in GitHub Actions on every push and pull request
  (`.github/workflows/test.yml`, jobs `replay` and `browser`)". `CLAUDE.md` layout line for `test.yml` (append the job name).
- If a smoke or roundtrip check fails on the runner but passes locally, fix the test's timing (held clock, waits on
  state rather than sleeps), never the page, and record the flaky check in the completion entry; if it cannot be made
  stable in this item, leave the step `continue-on-error: true` with a comment naming the check and open a follow-up.
- Out of scope: the replay job's content; branch protection (WQ-047); any change to `index.html` or `engine.js`.

**Acceptance.**
- Agent-verifiable: the workflow file parses; `npm test` passes locally; the Actions run on the pushed branch shows
  both jobs green (the executing session reads the run via the GitHub tools or the owner reports it); the three
  suites' PASS/FAIL counts in the Actions log equal the local counts.
- README and CLAUDE.md updated as above.

**Verification.** The Actions run URL and both jobs' durations in the completion entry.

---

### WQ-050 — Stale motion data pauses the trainer and opens Settings (D-134)

- **Status:** queued · **Priority:** P1 · **Size:** M · **Track:** platform · **Env:** any
- **Added:** 2026-10-27 by review-triage session (Ricky's decision D-134 in chat, 2026-10-27, on ChatGPT's blind review finding "missing motion must never read as stationary")
- **Depends on:** — (WQ-045's agent half landed 7d4cdc3; its owner check is independent) · **Blocks:** —

**Context.** When `devicemotion` samples stop, the engine has no way to know: `motion()` is simply not called, so
`st.rotNow`, the rate EMA, the orientation `st.q` and `devOff` all freeze at their last values (`engine.js:310`–321 run
only per sample). The engine reads no clock of its own (CLAUDE.md, Architecture), so from its view the phone is
perfectly still: a finger off the frame never alarms, a muzzle swing past 90° is not seen, and the OK tone still
plays. WQ-045 (D-123, D-124) added the page-side banner `#motionBanner` ("No motion data. The alarms cannot work."),
shown by `updateMotionBanner(t)` (`index.html:975`) after `NO_MOTION_START_MS` 2 s with no sample this run or
`NO_MOTION_GAP_MS` 5 s after samples (`index.html:967`), with the pill prefixed "NO MOTION · "; D-123 chose to inform
only and never pause, so a laptop demo with the mouse fallback (`onMouse`, `index.html:953`) keeps working. Ricky
decided (D-134): once the data is stale enough that the trainer is no longer useful, the page takes the user to the
pause / Settings screen instead of training on. The existing pause path is `setEnginePaused(...)` in `tick()`
(`index.html:1002`), which already pauses while Settings is open (`settingsOpen`); `openSettings(section)`
(`index.html:1294`) opens Settings scrolled to a section.

**Scope.**
- `index.html` only; the engine stays at 0.17.0 and nothing new is logged in a recording (the pause itself is already
  logged as a `['p', t, 1]` row, so replays stay identical).
- When `updateMotionBanner(t)` turns the banner on (both the 2 s and the 5 s condition; it already only watches while
  running, visible and landscape), and no recording is in progress, call `openSettings('motion')`: Settings opens,
  which pauses and disarms the engine through the existing `settingsOpen` path (alarm silenced, drill run cancelled
  by `setPaused`, D-98 e / D-107). During a recording, stop it first (`stopRecording(false)` already reopens Settings at
  the recorder) and then show the notice as below.
- Settings gets a **Motion data** section at the top (`section` id `motion`): the banner's text and the feature-checked
  fix line from `motionFixText()`; while Settings is open the live readout (`renderLive`) keeps updating it, so the
  user sees when samples resume ("Motion data OK").
- Closing Settings resumes as today. To keep a laptop demo (never any motion) usable, the automatic opening is armed
  once per no-motion episode: after the user closes Settings with motion still absent, it does not reopen until a
  sample has arrived and the data has gone stale again (new page flag, e.g. `motionPauseArmed`). The banner and the
  pill prefix keep showing meanwhile (D-124 unchanged).
- `window.__tdt()` adds `motionPaused` (true while Settings was opened by this path and motion is still absent).
- Hub files (append-only blocks): `CLAUDE.md` gets a `## WQ-050` block after `## WQ-045` describing the rule and the
  one-per-episode arming; `docs/CLASS_USE.md` student setup note (the trainer opens Settings when motion data stops;
  follow the fix line); `docs/DECISIONS.md` rows for anything the agent decides beyond this text (`Claude (proposed)`,
  numbers from `python scripts/wq.py next`), in particular the once-per-episode arming if kept.
- Out of scope: engine changes; the recorder format; the thresholds (2 s / 5 s stay; a Ricky decision if they move);
  the 180 rule's own gap handling (`ORIENT_GAP_MS`). Touches `index.html`: do not run in parallel with another item
  that edits it.

**Acceptance.**
- Agent-verifiable: the `WQ-045` smoke section (`tests/smoke.js:1921`ff) is updated: 2 s after Start with no motion,
  Settings is open, the engine is paused (`__tdt().paused`), the Motion data section shows the fix line and the pill
  prefix still reads NO MOTION; closing Settings resumes and does not reopen while motion stays absent; one sample,
  then 5 s without, reopens Settings; a drill run in standby at that moment is cancelled with no completion tone. The
  mouse-fallback checks elsewhere in the smoke suite still pass (close Settings once where needed). `npm test` passes;
  every recording replays to identical events; engine `VERSION` unchanged.
- Owner-verifiable: iPhone 15, Safari, tap **Don't Allow** on the motion prompt → about 2 s after Start, Settings opens
  with the Motion data section and the Safari steps; follow them → the trainer runs and Settings does not reopen.
  Pixel 11 or S20+: normal use never opens Settings by itself, including after a return from the background.

**Verification.** The smoke section; `npm test` output and the owner's two reports in the completion entry.

---

## Parking lot

Ideas noted but not yet turned into items (an exploratory session may
promote one with `work-queue-add`):

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
