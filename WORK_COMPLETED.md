# WORK_COMPLETED.md — archive of finished queue items

Items rotate here from `WORK_QUEUE.md` when they are done (or deliberately
closed). Newest first. Each entry keeps its `WQ-NNN` ID and records **what
was done, why, and any deviation** from the item as written — the deviation
field is the important one: it is where the next session learns that the
plan met reality.

Entry template (copy verbatim; keep every heading even when the answer is
"none"):

```markdown
### WQ-NNN — <title as it stood in the queue>

- **Closed:** YYYY-MM-DD · **Outcome:** done | done-with-deviations | closed-wontdo | superseded-by WQ-MMM
- **Executed by:** <role> on <model>, plus <reviewer role / model, …> when any · **Round:** <orchestration round id, if any>
- **Commits / PR:** <hashes or PR link on the branch>

**What was done.** Two to six sentences. Name files and functions touched.

**Why.** The context the item carried, in one or two sentences, plus anything
learned during execution that changes the reasoning.

**Deviations.** What differs from the item's scope or acceptance text, and
why. "None" if none. A dropped sub-scope goes here AND becomes a new queue
item if it is still wanted.

**Verification.** What was run and its result (test counts, regression-check results,
manual checks). Say "not verified" plainly where that is the truth.

**Follow-ups.** New `WQ-` IDs raised from this work, or "none".
```

---

## Entries

### WQ-025 — Overall sensitivity drop-down (Low / Default / High) and drift slider order (D-89)

- **Closed:** 2026-10-24 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261024-3
- **Commits / PR:** eb88797 "WQ-025: overall sensitivity drop-down scales the three movement limits (D-89)"; 42117e8 "WQ-025: document overall sensitivity (D-90, CLAUDE.md, class use)"

**What was done.** `engine.js`: `DEFAULTS.sensitivity = 'default'`, frozen `SENSITIVITY = {low: 1.3, default: 1, high: 0.7}`, helper `limitsFor(S)` → `{moveDps, moveAcc, offFrameDeg}` × factor (unknown value → 1), both exported; `tick()` calls it once per tick (live `S`, since the page mutates `S` in place) and uses it at the rate/acceleration test and the off-frame drift test; `graceMs`, `jerkMs`, `steadyDeg`, `limit180Deg`, `pullPx` untouched. `VERSION` and `package.json` 0.12.4 → 0.12.5. `index.html`: `#sensitivity` `<select>` in a `.chk` row with a help line under the Movement alarm `<h2>`, above `#sliders1`; `buildSettings()`/`bindSettings()` wire it (save on change, slider outputs refreshed via a `sliderShows` list); under Low/High the `moveDps`, `moveAcc`, `offFrameDeg` outputs append the effective value (`25 °/s (→ 17.5 °/s)`); `renderDebug()` shows the effective limits; `SLIDERS.sliders1` reordered to moveDps, moveAcc, offFrameDeg, graceMs, jerkMs; Restore defaults returns the select to Default. Tests: twelve `WQ-025:` smoke checks (order, placement, D-64 store/drop, outputs under Low/High/Default, Restore defaults, a 20 °/s off-frame burst alarms under High and not under Default) and a roundtrip case recorded under High. Docs: `CLAUDE.md` WQ-025 block, one sentence in `docs/CLASS_USE.md` Before class, D-90 (`Claude (proposed)`), screenshots `docs/screenshots/wq-025/movement-alarm-{default,high,low}.png`.

**Why.** D-89 (Ricky, 2026-10-24): one control to make the whole movement alarm looser or stricter per student without touching the sliders; the drift slider belongs with the two rate limits it is scaled with.

**Deviations.** (1) Effective values are shown with one more decimal than the slider step, trailing zeros dropped (`→ 17.5 °/s`, `→ 1.05 m/s²`, `→ 3.5 °`), not rounded to the step as the item's example suggested, so the number shown is the limit the alarm uses. (2) The debug readout's three limit figures now show the effective limits (not asked, but the raw values would have been wrong under Low/High). (3) The item's owner-verifiable line said 7° under Low; the correct figure is 6.5° (5 × 1.3). The agent reported a duplicate D-89 row in `docs/DECISIONS.md`; the merged file has one row per ID (D-85…D-90), so nothing was changed.

**Verification.** Agent: `npm test` exit 0 — replay 71 PASS / 0 FAIL ("all passed (41 recordings)"), smoke 86 PASS / 0 FAIL, roundtrip 19 PASS / 0 FAIL; `npm run test:replay` before/after differs only in the version string; a direct event diff of all 41 recordings through the old and new engine: 0 differ, 0 carry `sensitivity`; mutation check (factor removed from `moveDps`) fails 3 smoke checks. Orchestrator on the merged branch: `npm test` twice, 105 PASS / 0 FAIL both times (replay "all passed (41 recordings)", smoke and roundtrip "all passed"). NOT verified (owner, any phone): under High a gentle off-frame movement that passes under Default alarms; under Low one that alarms under Default passes; drift limit 6.5° under Low, 3.5° under High at the 5° default.

**Follow-ups.** `docs/RECORDINGS.md` could list `sensitivity` among the recorded settings keys (the file documents the row format, not every key; left as is).

---

---

### WQ-024 — Trigger zone to the guard front, blade 5 px forward, label centred (D-87)

- **Closed:** 2026-10-24 · **Outcome:** done
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff, bumped `package.json` and re-ran the suites · **Round:** round-20261024-2
- **Commits / PR:** b235466 "WQ-024: Extend the trigger zone to the guard front, blade 5 px forward, label centred (D-87)"; faa6d45 "WQ-024: Log D-88 blade and label placement, note it in CLAUDE.md"; f4166bb "WQ-024: Add trigger screenshots at 852x393 and 667x375, both hands"; cfeeef9 "WQ-024: bump package version to 0.12.4" (orchestrator)

**What was done.** `engine.js`: `ZONES.trigger.w` .22 → .28 (x stays .28), so the trigger zone's front edge coincides with the guard zone's front edge after the shared `K.TRIGGER_FWD_PX`; `VERSION` 0.12.3 → 0.12.4. `index.html`: `sizeBlade()` sets `--bladeOff` = `(0.06 + 0.14·0.22)·W − BLADE_FWD_PX` (5 px) and `--gapMid` = `(bladeOff + GUARD.bar)/2` on `#trigZone`; the blade (`right: var(--bladeOff)`) and the label (`right: var(--gapMid); transform: translate(50%,-50%)`) use them, mirrored under `.lh`; blade width, top, height rule (D-79) and pull `translateX` unchanged. `tests/smoke.js`: per hand, a touch 10 px behind the guard's front edge (in the new strip) emits `trigOn`; the label box lies strictly between the blade face and the guard bar's inner edge, centred ±1 px, at 852 × 393 and 667 × 375 in both hands. D-88 (`Claude (proposed)`) holds the measurements; `CLAUDE.md` gained a WQ-024 block; screenshots in `docs/screenshots/wq-024/`.

**Why.** D-87 (Ricky, 2026-10-24): the rearward over-reach of the trigger zone is wanted, and the same should hold forward to the guard; blade a little further forward; label centred in the gap.

**Deviations.** None in behaviour. `package.json` `version` was outside the agent's files; the orchestrator bumped it to 0.12.4. The `CLAUDE.md` ZONES row stated no changed number, so the agent appended a block instead of editing it.

**Verification.** Agent, Playwright: blade face moved 4.98–5.01 px toward the muzzle at both viewports and hands; gap 65.4 px (852) / 48.6 px (667); label 28.6 px wide, 18.4 / 10.0 px clear on each side, centre error ≤ 0.01 px; `zoneFor('trigger')` and `zoneFor('guard')` share their front edge for every W from 300 to 3000. Replay: event lists of all 41 recordings identical before and after (JSON diff); every expectation passes. Orchestrator on the merged branch: `npm test` three times, 89 PASS / 0 FAIL each (replay "all passed (41 recordings)", smoke, roundtrip "all passed"). NOT verified (owner, any phone, both hands): trigger engages from its rear edge to the guard's front bar; blade slightly forward; TRIGGER text midway between blade and bar.

**Follow-ups.** None; the owner check joins the WQ-006 list by reference.

---

---

### WQ-022 — Replace the start-screen text with Ricky's wording (D-85, D-86)

- **Closed:** 2026-10-24 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261024-1
- **Commits / PR:** 4b04ca5 "WQ-022: Replace the start-screen text with Ricky's wording (D-85, D-86)"; orchestrator follow-through on `docs/CLASS_USE.md` ("muzzle toward the end marked MUZZLE", was "the arrow")

**What was done.** `index.html` `#startOv`: the warning sentence and the six-step list are replaced with the D-86 text — "**⚠ Loud alarms.** Hold **Test sound** and set the volume before you start. Keep the phone away from your ears." · 1. "Point the muzzle downrange and tap **Set downrange**. From then on, pointing more than 90° away triggers alarm." · 2. "Index finger flat on the frame strip = safe." · 3. "Finger off the strip or on trigger = hold still. Any movement sounds an alarm until the finger is back on the strip." · 4. "Pull the trigger straight back to fire. Return finger to frame before moving." · footnote `<p class="tip">` "Left-handed? Settings → Shooting hand." `<p id="platformNote">` and its text assignment are gone. `README.md:8` says "The shot is a click and a flash."; `docs/CLASS_USE.md` Student setup puts Set downrange (step 4, "under the muzzle") before the finger-on-frame step. Screenshots: `docs/screenshots/wq-022/start-852x393.png`, `start-667x375.png`.

**Why.** D-85 and D-86 (Ricky, 2026-10-24): the trainer screen labels the muzzle, strip, trigger and button itself, so the start screen keeps only the rules a student cannot see; the platform note promised an Android vibration never observed (WQ-023).

**Deviations.** `README.md:21` ("tap **Start**, and turn the phone sideways") stays: the acceptance line was written for start-screen text, and the README sentence is usage advice that remains true (the page asks for landscape after Start). `docs/CLASS_USE.md` steps 2–3 keep "Turn the phone sideways" for the same reason; the orchestrator replaced its "toward the arrow" with the MUZZLE tag.

**Verification.** Agent and orchestrator: `npm test` all three suites pass (replay "all passed (41 recordings)", smoke "all passed", roundtrip "all passed"); `npm run test:replay` output byte-identical before and after, no `VERSION` bump. Agent, Playwright at 852 × 393 and 667 × 375: `getElementById('platformNote') === null`; `.loud` box bottom at 249 px with scrollTop 0, so the warning and **Test sound** are visible without scrolling (D-29). Not run on a phone (text only).

**Follow-ups.** None.

---

---

### WQ-021 — Let the 180 limit slider go down to 30° (D-84)

- **Closed:** 2026-10-22 · **Outcome:** done
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261022-8
- **Commits / PR:** 3b2f198 "WQ-021: let the 180 limit slider go down to 30° (D-84)" (fast-forwarded to main)

**What was done.** `index.html` `SLIDERS.sliders180` entry for `limit180Deg`: `min: 45` → `min: 30` (`max: 90, step: 5` unchanged); help text "90° is the 180 rule. Lower it for a tighter safe zone, down to 30°." `tests/smoke.js` gained "180 limit slider goes down to 30° (D-84)", reading the `min` attribute of `#s_sliders180_limit180Deg`. `engine.js` unchanged, no `VERSION` bump, no DECISIONS row beyond D-84.

**Why.** D-84 (Ricky, 2026-10-22). The engine applies the limit as given with a 5° hysteresis and the dial's warning band starts at limit − 20, so 30° needs no engine change.

**Deviations.** None. `buildSettings()` only sets and displays the value and the browser clamps a range input natively, so a stored value below the old floor needed no handling; `docs/CLASS_USE.md` does not quote 45°.

**Verification.** Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (41 recordings)", smoke "all passed", roundtrip "all passed"). Agent: `npm run test:replay` before/after diff empty; `grep -n "min: 45" index.html` finds nothing. NOT verified (owner, any phone): Settings → Limit from downrange reaches 30°; at 30° a swing past 30° from downrange alarms and clears below 25° with the finger on the frame.

**Follow-ups.** None; the owner check is listed in WQ-006.

---

### WQ-020 — Move the trigger another 20 px toward the muzzle (D-82)

- **Closed:** 2026-10-21 · **Outcome:** done-with-deviations (agent-verifiable half; the on-phone check is tracked under WQ-006)
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and the 667×375 screenshot and re-ran the suites · **Round:** round-20261021-7
- **Commits / PR:** 01e36bd "WQ-020: Move the trigger another 20 px toward the muzzle (D-82)", 04d4177 "WQ-020: Reserve 160 px beside the dial so Set downrange clears the guard", 9a2196f "WQ-020: Log D-83 (guard follows the trigger, dial cap 160 px)" (merged to main as 0e16de5)

**What was done.** `engine.js` `K.TRIGGER_FWD_PX` 20 → 40 (comment cites D-82); `VERSION` and `package.json` 0.12.2 → 0.12.3. The guard's front edge follows through the existing `zoneFor` rule. The 11 synthetic recordings were regenerated (their trigger touches come from the zone centre). `index.html` `layout()` reserves 160 px beside the dial instead of 140 so Set downrange clears the wider guard at 667×375. Four screenshots in `docs/screenshots/wq-020/`. D-83 (`Claude (proposed)`): the guard follows the trigger; the dial-cap change; the measurements.

**Why.** D-82 (Ricky, 2026-10-21): "move the trigger another 20px towards the muzzle."

**Deviations.** `index.html` did need a change: at 667×375 the guard's front edge overlapped the Set downrange button by 13.4 px, so the dial cap moved from `tr.width − 140` to `tr.width − 160`; the dial there shrinks from 113.5 to 95.5 px (852×393 unchanged). `CLAUDE.md` unchanged (its `zoneFor` row carries no number).

**Verification.** Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (41 recordings)", smoke "all passed", roundtrip "all passed"); viewed `667x375-right.png`. Agent's Playwright measurements, both viewports and hands: trigger zone and guard front edge 40.0 px (±0.03) forward of the `ZONES` fractions; blade inside the guard at full 72 px travel (rear edge 147 / 105 px forward of the guard's rear end, tip 28–30 px above the bar); label 5.98 px from the blade with 35.8 / 19.0 px to the front bar; Set downrange clear of the guard by 16.8 px at 852 and 6.6 px at 667 (same as before D-82); dial clear by 154.9 / 144.7 px. Event-level replay of all 30 real recordings against the pre-change engine: only `pixel-11/tdt-free-2026-10-20-22-40-27.json` changes — one trigger touch at x ≈ 463 px (viewport 852 wide) was 17 px forward of the old zone's front edge (446 px) and is inside the new one (466 px), so that press engages 343 ms earlier (`trigOn` 98583.5 instead of 98926.4) and its shot breaks at 98934.7 instead of 98943.3; event counts identical; every expectation passes. `npm run test:replay` before/after identical apart from version strings. NOT verified (owner, any phone, both hands): the trigger sits where the finger expects it and a full press still breaks without the finger running off the zone.

**Follow-ups.** Parked (needs a Ricky decision): derive the dial cap from the guard's measured front edge instead of the fixed 160 px, so a future `TRIGGER_FWD_PX` change cannot reach the Set downrange button again.

---

### WQ-019 — Widen the `offFrameDeg` default back to 5° (D-81)

- **Closed:** 2026-10-21 · **Outcome:** done
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff, fixed one stale comment, and re-ran the suites · **Round:** round-20261021-7
- **Commits / PR:** df6cc66 "WQ-019: Widen offFrameDeg default back to 5° (D-81)", 7cb08fe "WQ-019: Update the smoke-test comment to the 5° default" (orchestrator) — on main

**What was done.** `engine.js` `DEFAULTS.offFrameDeg` 3 → 5 (comment "D-56, 5° (D-81)"); `VERSION` and `package.json` 0.12.1 → 0.12.2. `CLAUDE.md` line 63 reads "(5°)"; `docs/CLASS_USE.md` says "5° by default" in both places. The smoke test reads the limit from `TDT.DEFAULTS`, so its D-56 checks followed without edits; the orchestrator updated the stale comment on `tests/smoke.js` line 181. Settings slider and synthetic recordings unchanged.

**Why.** D-81 (Ricky, 2026-10-21): the 3° limit of D-77 was too tight in use.

**Deviations.** None. `package-lock.json` (untracked) still says 0.12.1 and was left alone.

**Verification.** Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (41 recordings)", smoke "all passed", roundtrip "all passed"). Agent's replay before/after: the only outcome change is `pixel-11/tdt-free-2026-10-20-22-40-27.json` alarms 4 → 3; every other difference is the version string in INFO lines (the two `samsung-s20` axis recordings, made with 0.12.1, moved from "PASS replay reproduces the live run" to "INFO … replay still matches"). Smoke D-56 checks ran with `LIM = 5`: "slow drift off the frame to just under 5°: no alarm", "… past 5°: move alarm", "… then still: no alarm", "slow drift past 5° during a press: move alarm", short jerk `devOff < LIM`. NOT verified (owner, Pixel 11 and iPhone 15, drift slider never moved): Settings shows 5° after loading the updated page.

**Follow-ups.** None.

---

### WQ-018 — Lengthen the trigger blade to half the gap above the guard bar (D-78)

- **Closed:** 2026-10-21 · **Outcome:** done
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and a screenshot and re-ran the suites · **Round:** round-20261021-6
- **Commits / PR:** 40e2fb8 "WQ-018: Lengthen the trigger blade to half the gap above the guard bar (D-78)", 151ae0b "WQ-018: Log D-79 blade sizing and vertical trigger label", d2150d5 "WQ-018: Add blade screenshots at 852x393 and 667x375, both hands" (merged to main as 17168f2)

**What was done.** `index.html`: new `sizeBlade(z, g)`, called from `layout()` after `drawGuard()`, sets the `#blade` height in px so the tip sits exactly halfway between the D-71 tip (64% of the trigger zone) and the guard bar's inner edge (guard zone bottom minus `GUARD.bar`); the CSS height is an 87% fallback; top, width, `right: 14%` and the `translateX` pull shift are unchanged. The trigger label is absolutely positioned on the muzzle side of the blade, 6 px away, vertically centred and set with `writing-mode: vertical-rl`; `.lh .trigger .label` mirrors it. D-79 (`Claude (proposed)`) records the sizing method and the label placement. Screenshots in `docs/screenshots/wq-018/`. `engine.js`, `VERSION` (0.12.1) and the tests are unchanged.

**Why.** D-78 (Ricky, 2026-10-21): "increase the length of the trigger itself to take up half of the empty space between the bottom tip of the trigger and the trigger guard."

**Deviations.** None to the blade. The label placement is the agent's choice (D-79): the muzzle-side gap between the blade and the guard's front bar is 53 px at 667×375, too narrow for the 106 px horizontal label, and the rear side is swept by the 72 px pull, so the label stands vertically; in `vertical-rl` the "TRIGGER" column is on the right in both hands, so the text order is not mirrored.

**Verification.** Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (39 recordings)", smoke "all passed", roundtrip "all passed"); viewed `852x393-right.png`. Agent's Playwright measurements (`getBoundingClientRect`): 852×393 both hands blade tip 301.0 → 330.5 px against a target of 330.6 (bar inner edge 360.0), error −0.05 px; 667×375 both hands 287.3 → 315.3 against 315.3 (bar inner edge 343.3), error +0.03 px. Label never overlaps the blade at rest or at 72 px travel in any of the four cases. `npm run test:replay` before/after diff empty. NOT verified (owner, any phone): the longer blade reads as the trigger and the vertical label is legible.

**Follow-ups.** None; if the vertical label is unwanted, a one-line decision picks another placement.

---

### WQ-017 — Lower the `offFrameDeg` default from 5° to 3° (D-77)

- **Closed:** 2026-10-21 · **Outcome:** done-with-deviations (agent-verifiable half; the phone check is listed under Verification and tracked in WQ-006)
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261021-6
- **Commits / PR:** 748ed57 "WQ-017: Lower the offFrameDeg default from 5° to 3° (D-77)" (fast-forwarded to main)

**What was done.** `engine.js` `DEFAULTS.offFrameDeg` 5 → 3 (comment cites D-77); `VERSION` and `package.json` 0.12.0 → 0.12.1. `tests/smoke.js` reads the limit as `LIM = TDT.DEFAULTS.offFrameDeg` and checks a sub-limit drift (off the frame, then holding still), a drift past `LIM` with a `move` alarm (off the frame and during a press), and the short jerk with `devOff < LIM`. `CLAUDE.md` off-frame bullet says "(3°)"; `docs/CLASS_USE.md` says 3° by default in both places.

**Why.** D-77 (Ricky, after the I-06 estimator study): slow off-frame moves alarmed late or never at 5°; on engine 0.12.0 the drift over 15 quiet off-frame periods peaks at 1.83°, so 3° trips none of them and alarms 0.3–1.4 s earlier on four of six recorded moves.

**Deviations.** `tests/recordings/synthetic/` was not regenerated: no synthetic replay changed outcome, and a trial regeneration rewrote only the header fields (`app`, `settings.offFrameDeg`), so it was reverted; the committed synthetic files still record app 0.12.0 and `offFrameDeg: 5` in their own settings. The smoke test reads the limit from `TDT.DEFAULTS` rather than the page's `S` (which sits in a closure); equal because the test clears `localStorage` first. No DECISIONS row added.

**Verification.** Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (39 recordings)", smoke "all passed", roundtrip "all passed"). Agent's replay before/after: the only outcome change is `pixel-11/tdt-free-2026-10-20-22-40-27.json` alarms 3 → 4 (the expected press at 66.8 s whose drift reaches 4.0°); every other difference is the version string in INFO lines. Smoke 66 PASS, with the five D-56 checks renamed to the 3° limit. NOT verified (owner, Pixel 11 and iPhone 15, drift slider never moved): Settings shows 3° after loading the updated page; 10 s still off the frame does not alarm; a slow sweep alarms within about a second of passing 3°; a clean press does not alarm.

**Follow-ups.** None; the owner check is listed in WQ-006.

---

### WQ-016 — Rework the frame strip, trigger guard and trigger layout; travel 60 px

- **Closed:** 2026-10-21 · **Outcome:** done-with-deviations (agent-verifiable half; the on-phone feel check is tracked under WQ-006)
- **Executed by:** execution agent on opus (first pass, round-20261021-4, returned `blocked:user` on Q17), a second execution agent on opus (D-75 rule, round-20261021-5); orchestration session (Fable 5.1) reviewed the diffs and screenshots, resolved the `docs/DECISIONS.md` merge conflict and re-ran the suites · **Round:** round-20261021-4 and round-20261021-5
- **Commits / PR:** 191ef2d "WQ-016: Rework frame strip, trigger and guard layout; travel 60 px (D-71 to D-74)", 0b8d59e "WQ-016: Log layout decisions D-71 to D-74; update Units and ZONES notes", 57eea08 "WQ-016: Add layout screenshots at 852x393 and 667x375, both hands", 71dff1f "WQ-016: Never count an engaged trigger touch as frame contact (D-75)" (merged to main as d94bb6b)

**What was done.** `engine.js` `ZONES`: `frame.h` .304; `guard {x .24, y .554, w .32, h .38}`; `rest {x .31, y .28, w .65, h .264}`; `trigger.y` .574; `target {x .60, y .55, w .38, h .43}`; new `K.TRIGGER_FWD_PX = 20` and an exported `zoneFor(name, vw)` that shifts the trigger and the guard's front edge 20 px toward the muzzle, used by the trigger hit test and by `index.html` `rectFor()`. `DEFAULTS.pullPx` 60; `VERSION` and `package.json` 0.12.0. The guard is an inline SVG whose path `drawGuard()` rebuilds in `layout()` (straight front edge, 40 px front corner, bottom run, 22 px rear curve, 30° rear leg clipped flush at the grip edge, 10 px fillet; radii scale with `innerWidth/852`; `.lh` mirrors it). `restTouch()` skips the touch whose id is `st.trig.id` (D-75), so an engaged trigger touch never counts as frame contact. Tests: `smoke.js`, `roundtrip.js` and `make-synthetic.js` use `zoneFor('trigger', W)` and pull 70–75 px; `synthetic/` regenerated; 9 new smoke checks (drawn trigger/rest centres engage and arm in both hands; D-75 slide-into-strip cases). Docs: D-71 (Ricky, with the verbatim requests), D-72 to D-74 (`Claude (proposed)`), `CLAUDE.md` Units line, `ZONES` row and a D-75 Behavior-spec bullet; screenshots in `docs/screenshots/wq-016/`.

**Why.** Ricky's four layout requests of 2026-10-21 (D-71): taller frame strip, strip extended rearwards, guard blending into the grip, trigger 20 px forward with 60 px travel. The first pass changed the replayed events of five real recordings and stopped per Scope (Q17); Ricky answered with the trigger-wins rule (D-75), which removed the one unwanted change and, as it turned out, one of the accepted ones.

**Deviations.** (1) `target` moved from x .58, w .40 to x .60, w .38 and `layout()` caps the dial at `tr.width − 140` because the guard's new front edge ran through the Set downrange button at 667 px wide (dial 113 px there, unchanged at 852; D-74). (2) Screenshots match `*.png` in `.gitignore`, so they were added with `git add -f`; `.gitignore` unchanged. (3) The first agent finished and committed the whole item instead of stopping at the first replay difference, leaving a complete branch; recordings untouched. (4) Synthetic `press-wobble` now grades its shot Jerked instead of Moved (the regenerated 70 px pull is faster); its expectations pass. (5) Final replay comparison against the pre-WQ-016 engine shows three changes, not the four Q17 accepted: `iphone-15/press-wobble` replays identically again because its 811 ms earlier `alarmStop` came from a trigger touch counting as frame contact, which D-75 forbids.

**Verification.** Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (38 recordings)", smoke "all passed", roundtrip "all passed"). Second agent: smoke 66 checks (63 + 3), the new D-75 check fails against the pre-rule engine; main-vs-final replay of all 23 real recordings differs in exactly `pixel-11/tdt-clean-press-2026-10-20-21-48-19` (one `ok` fewer at 93868.4), `pixel-11/tdt-free-2026-10-20-22-40-27` (`trigOn` 8 ms earlier, following shot 0.2435° → 0.076°, still Clean) and `pixel-11/tdt-free-2026-10-20-23-27-38` (one movement alarm fewer with its `alarmStop`/`ok` and a later `ok`); `iphone-15/jerked-press` and `iphone-15/press-wobble` identical to before. Orchestrator viewed `852x393-rh.png` and `667x375-lh.png`: strip, guard shape and blade inside the guard as specified. NOT verified (owner, iPhone 15 and Pixel 11, both hands): the strip, trigger and guard feel natural to hold, and a 60 px pull breaks the shot without the finger running off the trigger.

**Follow-ups.** None; the owner check is listed in WQ-006.

---

### WQ-012 — Show the run-time gyro-axis estimate in the debug readout (D-57)

- **Closed:** 2026-10-21 · **Outcome:** done-with-deviations (agent-verifiable half; the Pixel 11 readout check is deferred by Ricky and tracked under WQ-006)
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261021-3
- **Commits / PR:** af25af3 "WQ-012: Show the run-time gyro-axis estimate in the debug readout (D-57)" (merged to main as 5875c8b)

**What was done.** `engine.js` gains a module-level `createAxisEstimator()` (`AXIS_EST`, `AXIS_CANDS`): a streaming port of E-2 with fused gravity from `tests/axis-estimate.js` (0.5 s / 0.25 s windows, 48 candidates, 5° rotation minimum, 0.1 s gap rule, same candidate names and runner-up/best margin), scored once per completed window with its own quaternion integration (`st.q`, `st.prevW` and the D-62 bridge untouched). `motion()` feeds it raw a/b/g and never reads `axisMode()`; it emits no events. `st.axisEst = {cand, margin, motionS, windows}` (null until the first window), reset in `resetStats()` and after any motion gap over `ORIENT_GAP_MS`. `index.html` debug readout shows `axis est <cand> ×<margin> (<motionS>s)` or `axis est —`; `window.__tdt()` exposes `axisEst`. `tests/replay.js` prints an INFO `axisEst` line for recordings over 5 s. Docs: `CLAUDE.md` `motion(m)` row and "Gyro axis order" bullet, `docs/RECORDINGS.md`, `docs/PROPOSAL_2026-10-20.md` 3.6 step 1 marked done, D-70 (`Claude (proposed)`). No `VERSION` bump.

**Why.** D-57 (Ricky): advisory estimate in the debug readout only, collecting evidence for a later auto-switch without changing behaviour.

**Deviations.** (1) The estimator restarts after any motion gap over `ORIENT_GAP_MS`, downrange set or not (the engine's own gap reset fires only when `refSet` is true); so `pixel-11/tdt-free-2026-10-20-22-40-27.json` (a 5.4 s gap) ends with 113 windows and margin 135.99 instead of the offline 209 and 305.50. (2) A live stream has no end, so a final window shorter than 0.5 s is never counted (the harness counts it); no result changed. (3) A window is skipped if any sample lacks `acceleration` or `accelerationIncludingGravity`; the harness skips the whole recording. (4) No smoke check added. All in D-70.

**Verification.** Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (38 recordings)", smoke "all passed", roundtrip "all passed"); `npm run test:replay` carries 27 new `INFO  axisEst` lines and nothing else differs. End-of-replay estimates: every Pixel 11 recording ends `xyz`; margins 11.47 (`axis-up`), 12.36 (`axis-right`), 36.00 (the 4.5 s `safe-move`, checked by hand), and 47.20 to 251.06 for the rest. Every iPhone 15 recording ends `xyz`; lowest margins 3.04 (`clean-press`) and 3.53 (`jerked-press`), the rest 24.33 to over 999. All 11 synthetic recordings end `null` (no gravity). Agent compared against `npm run axis-estimate -- --gravity=fused`: identical estimate, margin and window count on every phone recording except the gap case above. NOT verified (owner, Pixel 11): with the sensor readout on, after a few seconds of handling the line reads `axis est xyz ×n` with n above 1.5.

**Follow-ups.** None new; the auto-switch with a confidence gate (proposal 3.6 steps 2–3) stays in the parking lot pending a Ricky decision.

---

### WQ-007 — Exclude shots fired during an alarm from the summary percentages (D-45)

- **Closed:** 2026-10-21 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261021-3
- **Commits / PR:** b399720 "WQ-007: Grade only shots fired with no alarm in the summary (D-45)" (fast-forwarded to main)

**What was done.** `engine.js` `addToTally()` counts every shot in `shots`, `unsafe` and `dirs`, but adds to the Clean/Moved/Jerked counts and `devSum`/`devN`/`best` only when `shot.unsafe` is false; `summarize()` returns a new `graded` field (`shots − unsafe`) and bases `cleanPct` on it (null when 0). `index.html` `showSummary()` computes the percentages over `graded`, labels the rows "Clean, of N shots with no alarm" (likewise Moved, Jerked), marks the movement rows "(no alarm)", and moves the during-alarm row next to the shot total as "Shots fired during an alarm (not graded below)". `tests/smoke.js`: the sustained-movement press is now completed during the alarm (a third shot) and three checks cover the summary numbers. Docs: D-39 note pointing at D-45, D-69 (`Claude (proposed)`), `docs/CLASS_USE.md` summary paragraph, `CLAUDE.md` `summarize` row. No `VERSION` bump.

**Why.** D-45 (Ricky): shots fired during an alarm stay counted, graded and plotted but leave the percentages and the steadiest-press stat.

**Deviations.** (1) "Most common miss" still counts every shot: D-45 names only the percentages and the steadiest value, so it was left and logged in D-69 for Ricky to confirm or reverse (a one-line change in `addToTally` if reversed). (2) Average movement is excluded together with the steadiest value, as the item's Scope says, although D-45's text names only "steadiest". (3) Summary rows reordered and reworded (D-69).

**Verification.** Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (38 recordings)", smoke "all passed", roundtrip "all passed"). Agent: smoke 57 PASS (54 + 3 new); `npm run test:replay` before/after diff identical. Acceptance numbers from replaying `pixel-11/tdt-press-wobble-2026-10-20-21-50-38.json`: `{"shots":3,"graded":0,"clean":0,"moved":0,"jerked":0,"cleanPct":null,"unsafeShots":3,"avgDev":null,"bestDev":null,"commonMiss":{"dir":"high-left","n":1},"moveAlarms":3,"breaks180":0}`; the sibling `…21-49-46` gives 2 shots, 2 during an alarm, 0 graded; `showSummary()` shows "0 (—)" and "—", not NaN. Not run: a visual check of the overlay on a phone (summary-only change, no sensor or touch part).

**Follow-ups.** Ricky to confirm D-69 (most-common-miss keeps alarmed shots); none otherwise.

---

### WQ-003 — Fail the replay test when `auto` disagrees with a phone's axis verdict

- **Closed:** 2026-10-21 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the replay suite · **Round:** round-20261021-2
- **Commits / PR:** caa5f4b "WQ-003: Fail the replay test when auto disagrees with a phone's axis verdict" (merged to main)

**What was done.** `tests/replay.js` gained `autoResolution(rec)`: it replays a recording with the default settings (`axisMode: 'auto'`, default flips) and finds which explicit mapping (`spec` or `ios`) gives an identical replay (packed events and aim path). After each per-device "Axis verdict" line, every axis recording from a real phone prints a PASS or FAIL line ("axis-up: auto → ios; fits: ios"); a FAIL increments `failures`. A per-recording WARN prints when `device.ios` disagrees with `/iP(hone|ad|od)/` on `device.ua`. A `mappingName()` helper is shared with `axisDiagnosis`. `docs/RECORDINGS.md` documents the FAIL check, the synthetic skip and the WARN.

**Why.** The axis verdict was INFO only; with iPhone recordings now in the repo the test must fail loudly if the `auto` default (D-52) ever stops fitting a phone. Both phones measured so far fit `ios`, so the guard passes today (D-58).

**Deviations.** (1) Synthetic recordings get an INFO line and skip the check: they pin `axisMode: 'spec'` and forcing `auto` (which resolves to `ios`) on them would fail by design. (2) The engine does not expose `axisMode()`, so the test infers what `auto` resolved to by comparing replays rather than reading the engine; `engine.js` is untouched. (3) The check runs only for a user agent with both `axis-up` and `axis-right` recordings, like the existing verdict.

**Verification.** Orchestrator on merged main: `npm run test:replay` "all passed (38 recordings)", with "PASS axis-right/axis-up: auto → ios; fits: ios" for the iPhone 15 and Pixel 11 user agents, "INFO synthetic recordings pin their own axisMode; 'auto' check skipped", and 15 "WARN device.ios is true but the user agent names no iPhone/iPad/iPod" lines (all `pixel-11/`). Agent's forced failure (temporary verdict `{'spec'}` for the Android UA, reverted before committing): "FAIL axis-right: auto → ios; fits: spec", the same for axis-up, "2 failed", exit 1. Agent's `npm test`: all three suites "all passed".

**Follow-ups.** None.

---

### WQ-014 — Bridge `devicemotion` gaps in the 180 orientation integration (D-62)

- **Closed:** 2026-10-21 · **Outcome:** done-with-deviations (agent-verifiable half; the owner-verifiable iPhone 3-minute drift run is deferred by Ricky, 2026-10-21, and tracked under WQ-006)
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261021-2
- **Commits / PR:** 08d0bf6 "WQ-014: Bridge devicemotion gaps in the 180 orientation (D-62)" (merged to main as 040b494)

**What was done.** `engine.js` `K` gains `ORIENT_BRIDGE_MS: 300`. `motion()` keeps the `MAX_DT_S`-clamped `dt` for the rate EMA and the aim trace; the quaternion step uses `dtQ` = raw gap capped at 300 ms and the mean of the previous and current body-frame rates (`st.prevW`, reset in `setDownrange` and when a gap clears `refSet`). `VERSION` and `package.json` 0.9.0 → 0.10.0. `CLAUDE.md` `motion(m)` row and the "Orientation" platform fact describe the bridge. D-65 (`Claude (proposed)`) records the first-sample rule.

**Why.** iOS Safari stops `devicemotion` for 98–123 ms at every portrait flip; crediting the gap with 100 ms of the post-gap rate lost about 9° of pitch/roll in the iPhone 15 drift drill (D-61, I-05). D-62 (Ricky): bridge with the mean rate over the gap, capped at 300 ms. WQ-011's off-frame reference orientation rides on the same integration and benefits from this.

**Deviations.** (1) The first sample after `setDownrange` (or after a gap clears downrange) adds no orientation step, the item's literal wording; before, that sample was integrated over the preceding interval, so "as today" was not exact. The agent tried the other reading: every `dev` figure moved under 0.35° and no event changed. Logged as D-65. (2) Besides the `dev` figures, some 180 `alarmStart`/`alarmStop`/`ok` timestamps in the five changed recordings move by one motion frame (16–25 ms) as the threshold crossing moves; event counts, reasons, grades and expectations are unchanged. (3) A stray comment on the `ORIENT_GAP_MS` line was moved to `HYST_180_DEG`, which it describes.

**Verification.** Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (38 recordings)", smoke "all passed", roundtrip "all passed"). Agent's replay diff before/after: only the five named recordings change (`iphone-15/180-break`, `iphone-15/free`, `pixel-11/180-break`, `pixel-11/free-…23-27-38`, `synthetic/180-break`), now reported as INFO "replay differs from the live run"; header "max" figures: `iphone-15/free` 178° → 175°, `synthetic/180-safe` 71° → 70°. End-of-replay `dev180` (agent's scratch script): `iphone-15/tdt-free-2026-10-21-03-38-03.json` 8.58° → 1.64° (target under 3.5°; equal to the uncapped offline trial, so the 300 ms cap changed nothing for these recordings); `pixel-11/tdt-free-2026-10-20-23-27-38.json` 0.73° → 0.60° (target under 1°). NOT verified: the owner line (iPhone 15 3-minute jig drift drill with engine 0.10.0, every rest under 5°) — deferred by Ricky and folded into WQ-006's remaining owner work.

**Follow-ups.** None new; the owner run is in WQ-006.

---

### WQ-015 — Store only user-changed settings so code defaults reach every phone (D-64)

- **Closed:** 2026-10-21 · **Outcome:** done (agent-verifiable half; the owner check on the Pixel 11 is listed under Verification and tracked under WQ-006's owner work)
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261021-2
- **Commits / PR:** 22f253c "WQ-015: Store only user-changed settings so code defaults reach every phone (D-64)" (fast-forwarded to main)

**What was done.** `index.html` stores settings under `tdt.settings.v2` as the diff against `DEFAULTS` (`changedFrom` helper; keys not in `DEFAULTS` are ignored); `save()` writes the diff or removes the key when it is empty; the load merges the stored diff over `DEFAULTS`, so `S` stays the full object. A `v1` save is migrated once at load when no `v2` key exists: changed keys are kept, `jerkMs` 500 is dropped (the pre-D-47 default), the result is written as `v2` and `v1` is removed. "Restore defaults" calls `clearSaved()`, which removes both keys. `tests/smoke.js` checks the `v2` diff shape and gained five checks (reload keeps the volume; a slider back at its default removes the key; a seeded `v1` migrates to `{"volume":0.35}`; Restore defaults removes the key; a reload after it keeps the default). Docs: `CLAUDE.md` `S` row, a note in `docs/CLASS_USE.md`, D-66 (`Claude (proposed)`, the migration rule).

**Why.** The whole-object `v1` save froze every default on a phone the first time any slider moved, so D-47's `jerkMs` 300 never reached the class Pixel and every future default change would be lost the same way. D-64 (Ricky, Q12 option 3).

**Deviations.** (1) `docs/CLASS_USE.md` had no sentence about saved settings, so a short note was added after the "Pick starting thresholds" bullet instead of editing one. (2) When both `v1` and `v2` exist, `v1` is removed without merging (D-66). (3) The new smoke checks click the hidden `#resetDefaults` button directly rather than opening Settings first; the handler is the same.

**Verification.** Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (38 recordings)", smoke "all passed", roundtrip "all passed"). Agent: smoke 39 PASS lines including the 5 new ones; `npm run test:replay` before/after diff empty; `grep -n "tdt.settings.v1" index.html` finds only the `KEY_V1` constant used by the migration and `clearSaved`. NOT verified (owner, Pixel 11 with its old save): after loading the updated page once, Settings shows `jerkMs` at 300, deliberately moved sliders keep their values, and a reload after "Restore defaults" keeps every slider at the code default.

**Follow-ups.** None.

---

### WQ-011 — Alarm when the muzzle drifts more than 5° while the finger is off the frame (D-56)

- **Closed:** 2026-10-21 · **Outcome:** done-with-deviations (agent-verifiable half; owner lines pending, see Verification; D-67 awaits Ricky)
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff (including the relative-quaternion product) and re-ran the suites · **Round:** round-20261021-2
- **Commits / PR:** 7e5c0da "WQ-011: Alarm when the muzzle drifts more than 5° off the frame (D-56)" (merged to main as ad21af8)

**What was done.** `engine.js`: `DEFAULTS.offFrameDeg = 5`; state `qOff`/`devOff`; `muzzleAngle(q)` shared by `deviation180()` and the new `deviationFrom(qRef)` (`conj(qRef)·st.q`). `tick()` captures `qOff` where `offSince` is set, clears it when the finger is back on the frame, computes `devOff` before the alarm block, and raises a `move` alarm (with `devOff` in the payload) when `devOff > offFrameDeg` after `graceMs` since `offSince`, in every off-frame state including presses. `qOff` is re-captured after `setDownrange()` and after a motion gap over `ORIENT_GAP_MS`, and cleared on pause. `VERSION` and `package.json` 0.10.0 → 0.11.0. `index.html`: "Max muzzle drift off the frame" slider (1–20°), a "drift off frame" debug line, `devOff` in `window.__tdt()`. `tests/smoke.js`: 9 new D-56 checks. Docs: `CLAUDE.md` Behavior spec and State machine, `docs/CLASS_USE.md`, `docs/RECORDINGS.md` drill table, D-67 (`Claude (proposed)`).

**Why.** Slow continuous movement with the finger off the frame never reached the rate thresholds, so it never alarmed (Ricky, 2026-10-20; D-56). Ricky confirmed on 2026-10-21 that the limit applies during trigger presses too.

**Deviations.** (1) `tests/expectations.js`: `jerked-press` no longer requires zero alarms (the synthetic 120 °/s jerk and the iPhone 15 follow-up string both pass 5°, which D-56 now alarms); `safe-move` accepts exactly one alarm still active at the end of the recording (the finger lifting to tap Stop while the phone drifted 5.1° in `iphone-15/safe-move`). Both are in D-67 and need Ricky's acceptance. (2) The existing smoke case "short hard jerk during the press: no alarm" moved about 16° and now alarms; it is now a 60 °/s jerk with recoil that stays under 5°, plus a `devOff < 5` assertion. (3) The drift alarm gates only on `graceMs` since leaving the frame, not the after-press/after-trigger grace. (4) `devOff` is in the event but not in `packEvent`/`observed`, so older recordings compare unchanged. (5) `qOff` is re-captured after any gap over `ORIENT_GAP_MS`, downrange set or not. (6) `qOff` is taken when the rest-loss debounce expires (where `offSince` is set), not at the raw lift instant.

**Verification.** Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (38 recordings)", smoke "all passed", roundtrip "all passed"). Agent: smoke 47 checks, run 4 times without flakes; replay before/after both "all passed (38 recordings)". Recordings whose live-equals-replay status moved from "matches" to "differs" (plain replay; the `{ offFrameDeg: 5 }` override is identical since no recording stores the key): `pixel-11/free-…22-40-27` alarms 2 → 3 (new at 63.57 s, devOff 5.2°, rotEMA 9.1 °/s, finger off 2.2 s); `pixel-11/press-wobble` ×2, `pixel-11/trigger-sweep`, `iphone-15/press-wobble`, `iphone-15/trigger-sweep` same alarm count, first alarm earlier; `iphone-15/jerked-press` alarms 0 → 1 at 2.61 s (devOff 5.1° during a follow-up string on the trigger); `iphone-15/safe-move` alarms 0 → 1 at 10.53 s (finger lifted to stop, drift 5.1°). Shot counts, grades and deviations identical everywhere; no alarm lost. `off-frame-still` gives no alarm on all three devices; `off-frame-move` still alarms. NOT verified (owner, Pixel 11 and iPhone 15): a slow ~10° sweep off the frame alarms within a second of passing 5°; holding still off the frame does not alarm; twisting about the barrel axis alone does not alarm; and whether a jerk past 5° during a press should alarm (it does now).

**Follow-ups.** Ricky to accept or change D-67 (the loosened `jerked-press` and `safe-move` expectations). Parked: give `tests/replay.js`'s summary per-alarm `devOff` so those two drills can assert "no alarm except drift past `offFrameDeg`" instead of a tolerance; optionally re-record iPhone 15 `safe-move` holding still while lifting to stop.

---

### WQ-013 — Pause on portrait only after it has persisted for 3 s (D-60)

- **Closed:** 2026-10-21 · **Outcome:** done-with-deviations (agent-verifiable half; the phone checks are deferred by Ricky and tracked under WQ-006)
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261021-2
- **Commits / PR:** 7a34fa7 "WQ-013: Pause on portrait only after it has persisted for 3 s (D-60)" (merged to main as 57fdbd9)

**What was done.** `index.html`: `PORTRAIT_HOLD_MS = 3000` with `portraitT0`/`portraitHeld` state; `tick()` starts the timer from the frame time on the first portrait frame, sets `portraitHeld` after 3 s, clears both on any landscape frame, and passes `portraitHeld` (not `isPortrait()`) to `setEnginePaused`. While portrait is pending, `onMotion` passes the last landscape `screenAngle()` and `feedTouches()` feeds the last landscape touch list with its landscape viewport while at least one touch is present (empty list once the count reaches zero); the recorder logs rows as fed. The `@media (orientation: portrait)` rule is gone; `tick()` toggles a `portrait` class and CSS shows `#rotateOv.armed.portrait`. `window.__tdt()` gained `paused` and `portraitHeld`. `tests/smoke.js` gained 7 checks. `CLAUDE.md` `tick` row and state-machine sentence updated; D-68 (`Claude (proposed)`, the touch-hold reading) appended. `engine.js` unchanged, no `VERSION` bump.

**Why.** iOS reports portrait for 1.5–3.8 s during a hard swing and the page disarmed at once, so a 180 drill on an iPhone could disarm mid-swing (Q15, D-60).

**Deviations.** (1) `docs/CLASS_USE.md` unchanged: no sentence said the trainer stops as soon as the phone turns portrait. (2) A touch that starts during a pending portrait while the held landscape list is empty is not seen until the next landscape touch event (D-68). (3) The smoke test exits fullscreen before `page.setViewportSize`, since Start requests fullscreen (D-53) and Chromium refuses to resize a fullscreen window. (4) No dedicated "OK tone not replayed" check; the 1.5 s case asserts `armed` and `onRest` stay true throughout.

**Verification.** Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (38 recordings)", smoke "all passed", roundtrip "all passed"). Agent: replay before/after diff empty; smoke 54 checks (47 + 7 new), all PASS, including "portrait for 1.5 s: still running, armed and safe, engine not paused", "portrait for 3.5 s: engine paused and disarmed", "back to landscape: unpaused but not armed until the finger is on the frame". The smoke test changes only `innerWidth`/`innerHeight`, not `screen.orientation.angle`, so the held-angle path is exercised only on a real phone. NOT verified (owner, iPhone 15 then Pixel 11): a swing through vertical with the finger on the frame gives no disarm, no overlay, no repeated OK tone, and `180-break` still alarms past 90°; 4 s of portrait shows the overlay and disarms; re-recorded `180-break` and `free` on the iPhone carry no `p` rows at the flips.

**Follow-ups.** None; the owner checks are listed in WQ-006.

---

### WQ-001 — Default the gyro axis order to x/y/z on every platform

- **Closed:** 2026-10-20 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261020-1
- **Commits / PR:** 5869e81 "WQ-001: Default the gyro axis order to x/y/z on every platform" (merged to main)

**What was done.** `engine.js` `axisMode()` resolves `auto` to `ios` (x/y/z `rotationRate` order) on every platform; `createEngine` no longer takes `opts.ios`, `replay()` no longer passes it, and `index.html` `newEngine()` calls `createEngine(S, { onEvent })`. `VERSION` and `package.json` moved 0.7.0 → 0.8.0. The Settings `axisMode` options read "x/y/z order (Chrome, iOS)" and "Spec order (x = beta, y = gamma, z = alpha)" with stored values unchanged. `tests/make-synthetic.js` writes `axisMode: 'spec'` into every synthetic recording and `tests/recordings/synthetic/` was regenerated. `tests/smoke.js` `swingUntil` now drives `rotationRate.alpha` (device x = yaw under x/y/z order), so the smoke test no longer depends on how the page detects the platform. Docs: `CLAUDE.md` "Gyro axis order" bullet and engine table, `OPEN_QUESTIONS.md` Q1 and Q11, `docs/RECORDINGS.md` format example, `docs/DECISIONS.md` D-52 (`Claude (proposed)`).

**Why.** The only real axis recordings (Pixel 11, Chrome 155) fit only x/y/z order, and the Pixel got that mapping only through the iOS misdetection (Q11). Decoupling the mapping from `isIOS` lets WQ-002 fix the detection without breaking the Pixel trace. Learned during the round: Playwright's headless Chromium 156 also exposes `DeviceMotionEvent.requestPermission`, so `main` had 2 failing smoke checks (the 180 swing assumed the spec mapping) before this item; they pass now.

**Deviations.** `docs/RECORDINGS.md` had no sentence saying replay uses the `auto` default, so the agent annotated the `device.ios` line of the format example instead. The `CLAUDE.md` engine-table row for `createEngine` was corrected in place (outside the bullet the item named) because it was wrong after the change. `index.html` dropped `ios: isIOS` from the `createEngine` call (the option no longer exists); every other `isIOS` use is left to WQ-002. `tests/replay.js` and `tests/roundtrip.js` needed no change.

**Verification.** Orchestrator re-ran `npm test` on merged main: replay "all passed (26 recordings)" with "Axis verdict … Chrome: ios" and "Axis verdict for synthetic (spec axis order): spec"; smoke "all passed"; roundtrip "all passed". All 15 `pixel-11/` recordings report "INFO recorded with engine 0.7.0 (or 0.6.0), now 0.8.0: replay still matches the live run" (none carries app 0.8.0). `grep -n "opts.ios\|ios ?" engine.js` finds nothing. NOT verified: the owner-verifiable Pixel 11 check (Settings → Gyro axis mapping on Auto: muzzle up moves the trace up, swing right moves it right) — behaviour is unchanged for the Pixel, which already resolved to `ios`.

**Follow-ups.** None new; WQ-003 (replay guard) is unblocked, and Q1 (iPhone axis order) stays open until WQ-006's iPhone recordings exist.

---

### WQ-002 — Replace the `isIOS` platform check with feature checks

- **Closed:** 2026-10-20 · **Outcome:** done
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261020-1
- **Commits / PR:** 09bec82 "WQ-002: Replace the isIOS platform check with feature checks" (merged to main)

**What was done.** In `index.html`, `start()` attempts `requestFullscreen` and `screen.orientation.lock('landscape')` whenever `document.documentElement.requestFullscreen` exists; the start-screen `platformNote` shows the iPhone text when `'vibrate' in navigator` is false and the Android text otherwise. `isIOS` is now a user-agent test only (`/iP(hone|ad|od)/`, or `MacIntel` with more than one touch point for iPadOS) and feeds only the recorder's `device.ios` field and the debug readout. `docs/DECISIONS.md` gains D-53 (`Claude (proposed)`) and D-44 reads "superseded by D-53"; `OPEN_QUESTIONS.md` Q11 is marked resolved pending a phone check; `CLAUDE.md` gets a "Platform detection" bullet and a corrected Orientation bullet.

**Why.** Android Chrome 155 exposes `DeviceMotionEvent.requestPermission`, so the Pixel 11 was detected as iOS: no fullscreen, no landscape lock, the wrong start-screen note, and `device.ios: true` in every recording. WQ-001 had already decoupled the axis mapping from `isIOS`, so this fix could not break the Pixel trace.

**Deviations.** None in scope. `createEngine` was untouched because WQ-001 had already removed `ios`. One side effect: headless Chromium (which also exposes `requestPermission`) now attempts fullscreen and the orientation lock at Start; both are in try/catch and the suites report "no page errors".

**Verification.** Orchestrator re-ran `npm test` on merged main: replay "all passed (26 recordings)", smoke "all passed", roundtrip "all passed". `grep -c "isIOS" index.html` returns 3 (definition, recorder field, debug readout). Agent additionally loaded the page in Playwright Chromium 156: Android note shown, 0 page errors. NOT verified (owner-verifiable, remaining): Pixel 11 — Start goes fullscreen and locks landscape, the Android note shows, a new recording carries `device.ios: false`; iPhone — the motion permission prompt still appears and the iPhone note shows.

**Follow-ups.** None; the owner checks above fold into WQ-006's recording session on each phone.

---

### WQ-004 — Build an offline gyro-axis estimator harness over the recordings

- **Closed:** 2026-10-20 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the harness · **Round:** round-20261020-1
- **Commits / PR:** 975ddbc "WQ-004: Add offline gyro-axis estimator harness and report" (merged to main); DECISIONS rows added by the orchestrator in the round's archive commit

**What was done.** `tests/axis-estimate.js` (Node, no dependencies, `npm run axis-estimate`) runs E-1 (derivative fit), E-2 (0.5 s window integration with the quaternion step copied from `engine.js` `motion()`) and E-3 (correlation matrix) over all 48 permutation-and-sign candidates on every recording, each with two gravity sources: `lp` (centred ±50 ms average of `accelerationIncludingGravity`) and `fused` (`accelerationIncludingGravity − acceleration`). Per recording and estimator it prints the winner or tie set, the margin, the runner-up, the motion seconds until the decision last changed, and agreement with the per-UA axis-drill verdict, then an acceptance summary. Results are in `docs/PROPOSAL_2026-10-20.md` section 3.7, the full output in `docs/axis-estimate-2026-10-20.txt`, and a "how to run" section in `docs/RECORDINGS.md`.

**Why.** Before any run-time axis estimation, the estimators had to be measured offline. Result: E-2 with `fused` gravity ranks `xyz` first on all 15 Pixel 11 recordings, minimum margin 11.47, decision within 0.7 s of motion on `180-*` and `press-wobble`; E-3 fails every criterion (**g** × d**g**/dt has no component along gravity, which is device x in landscape); `lp` gravity gives one confidently wrong answer (`axis-up`, margin 7.22), so the gravity source matters more than the estimator.

**Deviations.** (1) Two gravity sources instead of one, because the source decides the result. (2) Synthetic recordings carry no gravity and `tests/make-synthetic.js` belonged to WQ-001 this round, so the harness simulates the gravity a spec-order phone reports in a fixed pose (keyed on `rec.synthetic`, never `settings.axisMode`). (3) The synthetic acceptance line "ranks `spec` first" is met only in the weak form "no candidate above `spec`" (E-2): only `180-safe` rotates about all three axes; on 7–8 others `spec` ties for first and 2 have no motion. (4) E-3's margin uses the proposal 3.3 per-row definition. (5) The agent could not append its proposed decisions to `docs/DECISIONS.md` (file owned by WQ-001 this round); the orchestrator appended them as D-55.

**Verification.** Orchestrator ran `npm run axis-estimate` on merged main: "26 recordings, 0.7 s", 156 estimator lines; summary lines verbatim: "fused E-2: real > 5 s ranking xyz first 14/14; synthetic spec first 1, tied first 8, beaten 0, no motion 2 (of 11); drill disagreements 0; min real margin 11.47 (>= 1.5: met); decision within 3 s on 180-*/press-wobble 4/4 (met)"; "fused E-3: … min real margin 1.02 (>= 1.5: not met); decision within 3 s … 0/4 (not met)". `npm test` passes all three suites on merged main (the agent's own run showed the pre-WQ-001 smoke baseline of 2 failures; it merged after WQ-001 fixed them). Not tested: a clean clone (no `npm install` is needed by the script); any phone other than the Pixel 11.

**Follow-ups.** (a) Synthetic recordings that can identify a mapping (emit `accelerationIncludingGravity` and one three-axis drill in `tests/make-synthetic.js`) — parked in the queue's parking lot. (b) Check on an iPhone that `acceleration` is reported alongside `accelerationIncludingGravity` — folded into WQ-006's analysis half. (c) Ricky decision on proposal 3.6 step 1 (advisory E-2 with `fused` gravity in the debug readout) — raised as Q12 in `OPEN_QUESTIONS.md`.

---

### WQ-009 — Remove the contact-size (flat-finger) check (D-46)

- **Closed:** 2026-10-20 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261020-1
- **Commits / PR:** 2c75bdb "WQ-009: Remove the contact-size (flat-finger) check (D-46)" (merged to main as 3edbb5e)

**What was done.** `engine.js`: `requireFlat` and `minContactPx` left `DEFAULTS`; `sizeSupported` / `lastRestSize` left the state; the two size lines in `restTouch()` (used by `touches()`) and the per-touch `size` field that only they read were removed. `fromTouch` / `packTouches` still carry `rx`/`ry`, so old recordings parse. `index.html`: the whole "Flat-finger check" Settings section (heading, `requireFlat` checkbox, `sliders3` host with the `minContactPx` slider, `liveContact` readout) and its wiring in the checkbox arrays and `renderLive()` are gone. `CLAUDE.md` lost the "Contact size" bullet. `docs/DECISIONS.md` D-54 (`Claude (proposed)`) records the removal of the `size` field.

**Why.** D-46 (Ricky, 2026-10-20): a touch inside the frame strip is "finger on frame"; flatness is taught outside the tool. The check never worked on the Pixel 11 (every touch reports radius 0).

**Deviations.** The per-touch `size` field was also removed (nothing reads it once the check is gone; replay output unchanged). The `touches` row of the `CLAUDE.md` engine table, `docs/CLASS_USE.md`, `tests/smoke.js` and `tests/roundtrip.js` had no reference to the setting and were not edited; `window.__tdt()` never exposed `sizeSupported` / `lastRestSize`. No `VERSION` bump: `grep -rl '"requireFlat":true' tests/recordings` finds no files. Old `tdt.settings.v1` values for the two keys are ignored; the storage key is unchanged.

**Verification.** Agent: `npm run test:replay` output before and after the change diffed identical (125 lines, 26 recordings). Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (26 recordings)", smoke "all passed", roundtrip "all passed"); `grep -rn "requireFlat\|minContactPx\|sizeSupported\|lastRestSize" engine.js index.html tests/*.js` prints nothing. NOT verified (owner-verifiable, remaining): on any phone, Settings no longer shows the "Flat-finger check" section.

**Follow-ups.** None.

---

### WQ-010 — Lower the `jerkMs` default to 300 ms (D-47)

- **Closed:** 2026-10-20 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and re-ran the suites · **Round:** round-20261020-1
- **Commits / PR:** 052690b "WQ-010: Lower the jerkMs default to 300 ms (D-47)" (merged to main)

**What was done.** `engine.js` `DEFAULTS.jerkMs` 500 → 300 with the comment citing D-47; `VERSION` and `package.json` 0.8.0 → 0.9.0 (the second bump this round; 0.8.0 was WQ-001 and was never deployed). `CLAUDE.md` "State machine" paragraph now reads "exceeds `jerkMs` (default 300 ms, D-47)"; `docs/CLASS_USE.md` says "about a third of a second (300 ms by default)". The `index.html` slider range (100–1500, step 50) is unchanged.

**Why.** D-47 (Ricky, 2026-10-20): reduce the movement allowance during a press to 300 ms "for now". Learned during execution: `index.html` saves the whole settings object to `localStorage['tdt.settings.v1']`, so any phone that has saved settings keeps `jerkMs: 500` and does not pick up the new default — raised as Q12.

**Deviations.** (1) The one-off override replay over all 15 `pixel-11/` recordings changes the same three files the item named, but in the `free` recording the alarm comes earlier (45096 → 43212 ms) rather than being an extra alarm; counts are unchanged (58 events, 2 move alarms, 19 shots). D-47's note says "one extra alarm" and was left as written (Ricky row); this entry is the correction. (2) The folder has 15 recordings, not 14 as the item implied (the 2026-10-20 drift recording was added after the item was written); the extra one is identical under 300 ms. (3) The acceptance grep still finds "500 ms" at `CLAUDE.md:110` (`K.PRESS_AFTER_BREAK_MS`, not `jerkMs`) and in the D-25/D-35 history rows; none is a stale default. (4) `docs/RECORDINGS.md` and the slider never quoted 500 ms, so neither changed; no new DECISIONS row (D-35 and D-47 cover it).

**Verification.** Orchestrator on merged main: `npm test` passes all three suites (replay "all passed (26 recordings)", smoke "all passed", roundtrip "all passed"). Agent's override replay (`TDT.replay(rec)` vs `TDT.replay(rec, { jerkMs: 300 })`, throwaway script, not committed): 12 of 15 identical; `tdt-press-wobble-2026-10-20-21-49-46.json` same counts (5 alarms, 2 shots), all alarms 190–200 ms earlier; `tdt-press-wobble-2026-10-20-21-50-38.json` same counts (3 alarms, 3 shots), alarms at 3630→2913 ms and 6773→6573 ms, and the alarm near 10.1 s now fires before the shot; `tdt-free-2026-10-20-22-40-27.json` as under Deviations. Every real recording carries its own `settings` (12 with `jerkMs: 500`, 3 with none), so plain `npm run test:replay` is unchanged. Not run: any phone.

**Follow-ups.** Q12 (how a changed default reaches phones with saved settings) — a code item follows Ricky's answer; parked in the queue.

---

### WQ-005 — Record a long `free` drill with downrange set to measure gyro drift (Q10)

- **Closed:** 2026-10-20 · **Outcome:** done
- **Executed by:** Ricky (recording, Pixel 11) + recordings-review session (analysis) · **Round:** none (pre-round)
- **Commits / PR:** "Add 3-minute drift recording from the Pixel 11", "Resolve Q10: gyro drift under 2.5° over 3 minutes on the Pixel 11" on main

**What was done.** Ricky recorded `tests/recordings/pixel-11/tdt-free-2026-10-20-23-27-38.json` (173.7 s, downrange set at 1.0 s, fifteen 180 breaks up to 179°), starting, pausing at 90 s and ending on a desk jig so the phone sat in the same pose each time. The analysis replayed it with `TDT.createEngine` and read `state.q` / `state.dev180` at the three rest windows (rotation under 3 °/s for 3 s or more): 180 deviation 0.09°, 1.87°, 0.73°; full-orientation error 2.4° and 0.9° relative to the first rest; the averaged gravity vectors agree within 0.15°, confirming the jig. Q10 marked resolved in `OPEN_QUESTIONS.md`, D-49 added (`Claude (proposed)`), `docs/IDEAS.md` I-02 set to dropped.

**Why.** Orientation for the 180 rule is integrated from the gyro alone, so drift could cause false 180 alarms over a long drill. The measured drift is two orders of magnitude below the 90° limit.

**Deviations.** The item asked for "normal" training motion; the recording is far harsher (fifteen full swings past 90°), which makes the result conservative. The item's drift threshold for promoting I-02 (about 10°) was not approached, so I-02 was dropped rather than parked. D-49 is a Claude proposal pending Ricky's ratification.

**Verification.** `npm run test:replay`: the file replays identically to the live run (54 events). Rest-window analysis script run once in the review session (not committed; the numbers are in Q10 and D-49).

**Follow-ups.** WQ-006's analysis half should repeat the same drill on each new phone (noted in Q10); no new item.

---

### WQ-008 — Ratify or reject the `proposed` rows in `docs/DECISIONS.md`

- **Closed:** 2026-10-20 · **Outcome:** done
- **Executed by:** recordings-review session (Ricky answered in chat; Claude applied) · **Round:** none (pre-round)
- **Commits / PR:** see `git log --oneline -1 -- docs/DECISIONS.md` on main (commit "Ratify proposed decisions …")

**What was done.** Ricky answered the item's question in chat on 2026-10-20. In `docs/DECISIONS.md`, D-07 to D-13, D-17 to D-20, D-29, D-32, D-37, D-39, D-41 and D-43 became `Claude → Ricky accepted` / `active`; D-06 became `superseded` (modified by D-46: contact-size check removed) and D-35 `Claude → Ricky modified` (D-47: `jerkMs` 300 ms). New rows D-45 to D-48 record the answers. `CLAUDE.md` hard constraint 1 no longer says D-17 is pending.

**Why.** Twenty prototype-era choices were implemented but never ratified; the behaviour was already in use in class, so each was a yes/no for Ricky.

**Deviations.** Two answers were modifications rather than acceptances, so they became code items WQ-009 (remove contact size) and WQ-010 (`jerkMs` 300 ms) instead of being applied here. D-44 was marked `superseded` at the same time (WQ-002 replaces it), which the item did not list.

**Verification.** `grep -c "| proposed |" docs/DECISIONS.md`: 20 before, 0 after. `python scripts/wq.py check` OK.

**Follow-ups.** WQ-009, WQ-010 (both raised in the same `queue:` commit).

---

