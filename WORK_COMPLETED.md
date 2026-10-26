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

### WQ-039 — Write docs/ARCHITECTURE.md for contributors and a documentation map in the README

- **Closed:** 2026-10-26 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) read the state-machine and files sections against CLAUDE.md and archived · **Round:** round-20261025-7
- **Commits / PR:** e07e5b9 "WQ-039: add docs/ARCHITECTURE.md and a README documentation list"; merge on the orchestration branch

**What was done.** `docs/ARCHITECTURE.md` (new, about 1300 words, plain prose with D-numbers only as asides): Two files, one rule; Files served (manifest, SVG and the four PNG icons, the render script); The engine's contract (the `createEngine` calls, all 14 events, `summarize`, the page-side `onMotion` / `onTouch` / `onMouse` / `tick` / `onEvent` / `Snd` / `window.__tdt`); The state machine (debounce, press jerk allowance, off-frame drift, 180 rule, trigger wins, one finger, pauses); Zones and axes; Recordings are tests; Adding a drill (`DRILL_DEFS`, `tickDrill`, `drillShot`, `mulberry32`, `DRILL_MODES`, `DRILL_SVG`, `drillLineText`, `showDrillResult` and its row builders, sounds, recorder labels, tests, and that a new drill needs a Ricky decision). `README.md`: a "## Documentation" list, one line per file and folder in `docs/` plus `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CHANGELOG.md`. `CLAUDE.md`: one pointer sentence under the Architecture rule.

**Why.** Public-release review (2026-10-25): the only description of how the trainer works was CLAUDE.md, written for agents and 42 KB long, and the README never listed `docs/`.

**Deviations.** (1) The README list's lead-in carries "(WQ-039)" per the hub-file rule (the orchestrator strips the WQ ids from the public README in the round's tidy commit). (2) The agent reported, rather than fixed, CLAUDE.md "Layout of this repo" being behind the files added in rounds 5–7 (CHANGELOG, CONTRIBUTING, conduct, security, the workflow, `tests/axis-estimate.js`, `docs/axis-estimate-2026-10-20.txt`, `docs/mockups/`, `docs/screenshots/`, `docs/ARCHITECTURE.md`); its second report, that hard constraint 1 lacks the PNG icons, was wrong on the merged tree (WQ-037 appended them).

**Verification.** Agent: grep pass over every engine, page, event, file and decision name written (all found; listed in its report); `npm test` all three suites passed; `node tests/replay.js` "all passed (46 recordings)". Orchestrator: "Files served" and "The state machine" sections read against CLAUDE.md (accurate), README and CLAUDE.md diffs read (appends only).

**Follow-ups.** The orchestrator refreshes CLAUDE.md "Layout of this repo" in the round's tidy commit (a docs follow-through, not a new item). README "Develop" could link `docs/ARCHITECTURE.md` in its one-line split sentence (same tidy commit).

---

---

### WQ-041 — Put two screenshots in the README

- **Closed:** 2026-10-26 · **Outcome:** done
- **Executed by:** execution agent on sonnet (docs/tooling S item); orchestration session (Fable 5.1) viewed both images, checked the ignore rule and archived · **Round:** round-20261025-7
- **Commits / PR:** df71bca "WQ-041: two README screenshots; .gitignore gains the docs/screenshots exception"; merge on the orchestration branch

**What was done.** Two 852×393 Playwright captures of the current `index.html`: `docs/screenshots/readme/armed.png` (38.8 KB: SAFE pill, green frame strip, the shot radar with a short trace and "Last: Clean 0.51°" after one shot) and `docs/screenshots/readme/picker.png` (44.7 KB: the five drills). `.gitignore`: one appended line `!docs/screenshots/**` (hub file, append only). `README.md`: a centred two-image block with alt text after the first paragraph. Both PNGs were added with a plain `git add`, no `-f`.

**Why.** Public-release review (2026-10-25): the README was text only, and the per-item screenshots were all force-added against the global `*.png` rule.

**Deviations.** None in the work. The "armed with trace" shot needed one shot fired first, because the trace is drawn around a trigger press, not while resting on the frame; the page was not changed. Both images are Chromium captures, not phone photos (the owner may replace them later).

**Verification.** Agent: both PNGs under 200 KB; `git add .` staged exactly the two PNGs, `.gitignore` and `README.md`; `git status` clean after the commit. Orchestrator: `armed.png` viewed (SAFE, strip, radar trace), README diff read. NOT run: `npm test` (no code changed); viewing the README on GitHub happens when the branch is pushed (the orchestration branch carries it now, the owner can open it there).

**Follow-ups.** None. WQ-042 (social preview) can use `docs/screenshots/readme/armed.png`.

---

---

### WQ-036 — Make the trigger-reset smoke block deterministic

- **Closed:** 2026-10-26 · **Outcome:** done
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff, re-ran the smoke suite on the merged branch and archived · **Round:** round-20261025-6
- **Commits / PR:** bc70f45 "WQ-036: run the smoke press block on a held test clock"; merge on the orchestration branch

**What was done.** `tests/smoke.js` only: `holdClock()` replaces `performance.now` inside the page (from `page.evaluate`) with a virtual clock that only the motion helpers advance, and `releaseClock()` lets real time run on from where the virtual clock stopped (a fixed offset, so time never jumps). A shared `sample()` helper, used by `motion` and `wobble`, advances the virtual clock 16 ms per sample and waits one rendered frame while the clock is held (so the page's tick sees the sample), and waits 16 ms of real time otherwise. The block from "trigger reset allows follow-up; drift graded as moved" through the third shot fired during an alarm runs between `holdClock()` and `releaseClock()`; the six −15 °/s samples now always integrate to 1.44° (Moved). `tests/roundtrip.js` needed no change. D-126 (`Claude (proposed)`) records the mechanism; `CLAUDE.md` has a `## WQ-036` block.

**Why.** Promoted from the parking lot by the public-release review (2026-10-25): the block failed in 2 of 6 unloaded runs because each sample's `dt` was whatever the event loop gave, so a slow frame turned the same samples into a Jerked grade; the flake kept the browser suites out of CI (WQ-033).

**Deviations.** None in the work. Mechanism: the held page clock rather than the item's preferred page hook (would have changed `index.html`), synchronous timestamped bursts (the engine's `jerkMs` count needs ticks between samples) or the recorder's replay path (would test Node, not the page wiring). One wall-clock wait remains inside the held block (`waitForTimeout(50)` after the follow-up pull); the shot fires on the touch event, so it does not affect the outcome.

**Verification.** Agent: `for i in $(seq 10); do node tests/smoke.js | tail -1; done` → "all passed" 10/10; the same loop with `tests/roundtrip.js` → 10/10; `npm run test:replay` "all passed (46 recordings)"; `npm test` exit 0, 809 PASS lines, 0 FAIL; engine `VERSION` 0.17.0, `index.html` and `engine.js` untouched. Orchestrator: diff read (42 lines in `tests/smoke.js`, docs otherwise); smoke suite re-run on the merged branch (see the round report). Not applicable: real phones.

**Follow-ups.** With the block deterministic, the browser suites can join CI: a small hygiene item (extend `.github/workflows/test.yml` with a `browser` job that installs Playwright's Chromium and runs `tests/smoke.js` and `tests/roundtrip.js`; keep `replay` as the required check until the browser job has a record). Added to the parking lot.

---

---

### WQ-034 — Link the page to its source and add contributing notes to the README

- **Closed:** 2026-10-25 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and the new files and archived · **Round:** round-20261025-6
- **Commits / PR:** d1d9295 "WQ-034: link the page to its source; add contributing, conduct and security notes"; merge on the orchestration branch

**What was done.** `index.html`: the Ko-fi `p.tip` on `#startOv` ends with a plain "Source on GitHub" anchor (`target="_blank" rel="noopener noreferrer"`, D-63 style), above the WQ-032 lines. New files: `CONTRIBUTING.md` (issues with phone / OS / browser / engine line; a recording is the best attachment; `npm test` before a pull request and the `replay` check green; thresholds change only with the replay suite; the CHANGELOG rule; where planning lives; conduct and security pointers), `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1; reports via GitHub issues or the Ko-fi page's message form, no e-mail address), `SECURITY.md` (three lines), `.github/ISSUE_TEMPLATE/bug_report.md` (phone, OS, browser, engine version, hand and grip, what happened, steps, recording; label `bug`). `README.md`: "## Project files" and a "Report a problem" line appended after "Develop". `docs/RECORDINGS.md`: a "Contributing a recording" consent paragraph and the notes hint now "phone model, grip, hand; no names". D-125 (`Claude (proposed)`) records the consent wording. Screenshots `docs/screenshots/wq-034/` (852×393 and 667×375, top and bottom).

**Why.** Public-release review (2026-10-25): the page never named its repository, and nothing told a visitor how the project is run, how to report a problem, or what a contributed recording contains.

**Deviations.** (1) The consent text lists everything a recording actually holds (also frame times, screen size and pixel ratio, settings, drill label, notes, date and time, and the trainer's events), not the item's "user agent, motion samples and touch positions and nothing else", which was incomplete (D-125 b). (2) The recorder how-to's notes hint lost "who" to agree with the no-names rule. (3) The issue template also asks for hand and grip and sets the default `bug` label. (4) No release tag (out of scope; the owner's suggested first tag is `v0.17.0`).

**Verification.** Agent: `npm test` exit 0 (replay "all passed (46 recordings)", smoke and roundtrip "all passed", 0 FAIL, no flake); engine untouched at 0.17.0; Playwright on `#startOv` at 852×393 and 667×375: the Ko-fi line with the new link stays on one line, no horizontal scroll, **Start** top unchanged at 500 px; both anchors carry `target=_blank` and `rel="noopener noreferrer"`; every file named in `CONTRIBUTING.md` and the README exists; `git ls-files` lists the four new files and four screenshots. Orchestrator: diff and new files read in full (conduct file's contact section checked for the no-e-mail rule). Not applicable: real phones.

**Follow-ups.** None. (Q20, moving the planning files out of the root, is still open; the README paragraph explains them in place.)

---

---

### WQ-040 — Add a browser-support and known-issues section to the README

- **Closed:** 2026-10-25 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on sonnet (docs S item); orchestration session (Fable 5.1) checked each bullet against CLAUDE.md and archived · **Round:** round-20261025-6
- **Commits / PR:** 3dc80ef "WQ-040: README browser support and known limitations; class setup note"; merge on the orchestration branch

**What was done.** `README.md`: two `###` subsections under "Use it", before "Deploy": "Supported browsers" (iPhone Safari 17 or newer, Android Chrome; tested on iPhone 15 iOS 18.7, Pixel 11 and Galaxy S20+ on Chrome 155) and "Known limitations" (seven bullets: HTTPS only; laptops get a mouse demo and the WQ-045 No motion data banner; no vibration on iPhone and none felt on Android yet, the shot is a click and a flash; Silent mode; the 180 check off until Set downrange and lost when the page goes to the background; gyro drift of a few degrees over minutes; iPhone portrait swings up to about 4 s against the 3 s hold). `docs/CLASS_USE.md` "Student setup": a WQ-040 note after the WQ-045 one (click and flash, no iPhone vibration, Silent mode off).

**Why.** Public-release review (2026-10-25): hard constraint 4 and the platform facts in CLAUDE.md were not public, so users opening the link would meet the limitations unwarned.

**Deviations.** (1) Two `###` subsections instead of one paragraph plus a list. (2) Silent mode is worded "can mute the page on some iOS versions" (CLAUDE.md only states the iOS 17+ `audioSession` fix). (3) Vibration on Android stays "not felt so far" (WQ-023 open).

**Verification.** Orchestrator: every bullet traced to a source: HTTPS (hard constraint 2); laptop mouse fallback and the banner (Additions, WQ-045); vibration (Known platform facts "Vibration", WQ-023); Silent mode (`Snd` audioSession note); Set downrange and downrange lost on a motion gap > `ORIENT_GAP_MS` (D-26, D-31, state machine); drift (Q10, D-61); portrait (Orientation fact, D-60). Agent: `npm run test:replay` "all passed (46 recordings)". NOT run: the browser suites (docs-only change).

**Follow-ups.** None.

---

---

### WQ-032 — Add a one-line disclaimer and privacy line to the start screen and the README

- **Closed:** 2026-10-25 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff and screenshots and archived · **Round:** round-20261025-5
- **Commits / PR:** 3addf4a "WQ-032: add disclaimer and privacy line to start screen and README"; merge on the orchestration branch

**What was done.** `index.html`: two `p.tip` lines under the Ko-fi line inside `#startOv`: `#disclaimer` ("A dry, phone-only teaching aid for trigger-finger discipline. Not firearms training; use it with a qualified instructor and never with a real firearm. Provided as is, no warranty (MIT).") and `#privacy` ("Nothing leaves the phone: no accounts, no analytics, no network requests; settings stay in this browser."); no CSS change. `README.md`: the disclaimer sentence as a paragraph after "No install, no accounts, no data collection". `docs/CLASS_USE.md`: a first "Before class" bullet "Tell students what it is: …". `docs/DECISIONS.md`: D-122 (`Claude (proposed)`) records the wording. Screenshots `docs/screenshots/wq-032/` (landscape 852×393 and 667×375, portrait 390×844, each top and scrolled to the bottom).

**Why.** Public-release review (2026-10-25): the public link goes to people outside the classes and nothing on the page said what the tool is not (hard constraint 5) or that nothing leaves the phone (constraint 3); the MIT licence is not read from a phone.

**Deviations.** (1) The acceptance line "without pushing **Start** off screen" was already unmet before the change in landscape: at 852×393 and 667×375 **Start** sits at 500 px from the top and `#startOv` scrolls (scrollHeight 702); the new lines are below **Start** so they move nothing, and **Start** is fully visible in portrait, which is the view before the phone is turned. The agent left the start-screen layout alone (out of the item's scope); see Follow-ups. (2) The disclaimer takes two lines in both landscape sizes and three in portrait; the privacy line one in landscape and two in portrait. (3) Six screenshots (896 KB) rather than three, because each size was captured at the top and at the bottom.

**Verification.** Agent: `npm test` exit 0 (replay "all passed (46 recordings)", smoke "all passed", roundtrip "all passed", no FAIL; the smoke flake did not appear); engine `VERSION` 0.17.0 unchanged; a Playwright script measured the bounding boxes and took the screenshots. Orchestrator: diff read (2 lines in `index.html`, appends elsewhere), the 852×393 bottom screenshot checked by eye, `npm test` on the merged branch (see the round report). Not applicable: real phones.

**Follow-ups.** Pre-existing: in landscape at 375–393 px height **Start** is below the fold of the start screen (a compact landscape start screen would be a small ui item; parking lot). D-122 stays proposed until Ricky ratifies or rewords it.

---

---

### WQ-035 — Regenerate the stale synthetic recordings

- **Closed:** 2026-10-25 · **Outcome:** done
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) re-ran the generator and the replay suite on the merged branch and archived · **Round:** round-20261025-5
- **Commits / PR:** 9c8cae8 "WQ-035: tests: regenerate synthetic recordings with engine 0.17.0"; merge (orchestration branch, after 9438dc1)

**What was done.** `node tests/make-synthetic.js` (`npm run synthetic`) run with engine 0.17.0 and the whole `tests/recordings/synthetic/` folder committed in one commit: 15 of the 16 files changed (`two-finger.json` was already current). Every file now carries `"app":"0.17.0"`; the `settings` object gained `beepHz: 1650` and `beepMs: 350` (current `DEFAULTS`, D-109/D-110) where missing; touch rows changed only in `clean-press` (31 rows), `jerked-press` (10), `press-wobble` (61) and `trigger-sweep` (1), from the trigger geometry moves (D-72, D-87), with row counts unchanged. `observed` events changed in no file. `tests/make-synthetic.js` and `tests/expectations.js` untouched.

**Why.** Parking-lot hygiene promoted by the public-release review (2026-10-25): eleven non-drill synthetic files still said `app 0.12.3`, so a contributor running `npm run synthetic` saw a large unexplained diff.

**Deviations.** None in the work: the generator was already stable (two runs `diff -r` identical), so the item's conditional fix to `tests/make-synthetic.js` was not needed. The commit subject keeps the item's wording behind the required `WQ-035:` prefix.

**Verification.** Agent: `node tests/replay.js` before and after, both "all passed (46 recordings)" with byte-identical output (so no recording changed outcome and every expectation holds); `node tests/make-synthetic.js && git status --short` empty after the commit; `npm test` rc 0, 799 PASS lines, 0 FAIL. Orchestrator on the merged branch: generator re-run leaves 0 changed files, 0 files lack `"app":"0.17.0"`, `node tests/replay.js` "all passed (46 recordings)". Nothing skipped.

**Follow-ups.** None. The parking-lot entry "Stale synthetic recordings → promoted to WQ-035" can be dropped at the next parking-lot tidy.

---

---

### WQ-033 — Run the replay suite in GitHub Actions and pin Playwright

- **Closed:** 2026-10-25 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff, re-ran the replay suite and archived · **Round:** round-20261025-5
- **Commits / PR:** 6d653ad "WQ-033: run the replay suite in GitHub Actions; pin Playwright" (the agent's commit was c39a1d9 before the orchestrator rewrote its trailer; the Actions run cited below ran on c39a1d9, same tree); merge 9438dc1

**What was done.** `.github/workflows/test.yml` (new): workflow `tests`, job `replay` on `ubuntu-latest`, `actions/checkout@v4`, `actions/setup-node@v4` with `node-version: 22`, then `node tests/replay.js` directly (no `npm install`, no cache; `permissions: contents: read`). `package.json`: `"playwright": "1.63.0"` (exact pin, was `^1.47.0`) and `"engines": {"node": ">=20"}`. `README.md` "Develop": two sentences after the test commands (the replay suite runs in Actions on every push and pull request; the browser suites are not in CI yet, run `npm test` locally before a merge). No lockfile, no test changes.

**Why.** Public-release review (2026-10-25): the only workflow on GitHub was the Pages build; the replay suite needs no browser and is the natural pull-request gate (WQ-047 will require it). The caret range let a fresh `npm install` resolve a Playwright whose Chromium build differed from the one installed, breaking the browser suites until reinstalled.

**Deviations.** (1) The workflow triggers on every `push` (no branch filter) plus `pull_request`, not only on push to `main`: a main-only trigger could never be seen green before the owner-gated merge to `main`; the suite takes seconds. (2) Playwright is pinned to 1.63.0, the version installed system-wide in the executing session and the one the three suites run under, because `npm install` cannot run there; `npm ls playwright` after a fresh install was not available. (3) The agent pushed its item branch `wq-033` to `origin` (permitted for this item only) to get the run; the orchestrator's attempt to delete the remote branch afterwards was refused (HTTP 403 from the git proxy), so `origin/wq-033` still exists and the owner may delete it.

**Verification.** Agent: GitHub Actions run https://github.com/Tangineering/Trigger-Trainer/actions/runs/40239879519 (job `replay`, conclusion success, commit c39a1d9), log line "all passed (46 recordings)"; local `node tests/replay.js` "all passed (46 recordings)"; local `npm test` exit 0 (replay all passed, smoke all passed, roundtrip all passed). Orchestrator: `node tests/replay.js` on the merged branch "all passed (46 recordings)"; diff reviewed (three files, README append only). NOT run: the clean-clone `npm install && npx playwright install chromium && npm test` acceptance line (`npm install` is forbidden in the cloud session) — owner, once, on a clean clone.

**Follow-ups.** The Actions log warns that `actions/checkout@v4` and `actions/setup-node@v4` are forced onto Node.js 24 (Node 20 runner deprecation); moving both to v5 is a one-line hygiene item when wanted (parking lot). Once WQ-036 removes the smoke flake, the browser suites can join CI (noted in WQ-036's follow-ups when it lands). WQ-047 (branch ruleset requiring `replay`) is now unblocked on the agent side but stays owner-machine.

---

---

### WQ-038 — Start a user-facing CHANGELOG and a version-tag convention

- **Closed:** 2026-10-25 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on sonnet (docs S item); orchestration session (Fable 5.1) reviewed the diff against the `VERSION` history and archived · **Round:** round-20261025-5
- **Commits / PR:** f1f60d4 "WQ-038: add CHANGELOG and the version-tag convention"; merge f8e9101; aa92ca4 "WQ-038: name the collapsed section 0.12.6 and before" (orchestrator)

**What was done.** `CHANGELOG.md` (new, Keep-a-Changelog form, newest first): sections 0.17.0 (one finger controls the trainer), 0.16.0 (Transitions), 0.15.0 (Box Drill), 0.14.0 (Low Ready), 0.13.0 (drill picker, Freestyle, Bill Drill), two to five user-facing lines each in `docs/CLASS_USE.md` wording with no WQ numbers, and one collapsed "0.12.6 and before" section (base trainer, settings and summary, axis order default, drift alarm and portrait hold, layout rework; a note that 0.12.4–0.12.6 were the trigger-zone and sensitivity-preset steps). `CLAUDE.md` "Working rules": one appended bullet (every `VERSION` bump adds a CHANGELOG section in the same commit; the owner tags `vX.Y.Z` on `main` after the merge; agents never push tags). `README.md` "Develop": the same convention sentence (CONTRIBUTING.md does not exist yet, WQ-034) and a link line to the changelog.

**Why.** Public-release review (2026-10-25): the only history was `WORK_COMPLETED.md` and the engine `VERSION` constant; no tags, no releases, so neither a user nor a GitHub visitor could see what changed when.

**Deviations.** (1) The item's premise that 0.12.3 was the last pre-drill version was wrong: the `VERSION` history (`git log -G"VERSION = '" -- engine.js`) shows 0.12.4 (WQ-024), 0.12.5 (WQ-025) and 0.12.6 (WQ-026) between 0.12.3 and 0.13.0; the agent folded them into the collapsed section with a note, and the orchestrator renamed that section's heading from "0.12.3 and before" to "0.12.6 and before". (2) The 0.17.0 section was written from the CLAUDE.md WQ-031 block, since WQ-031 is still in the queue (owner half). (3) All five dated sections carry 2026-10-25, the commit dates of the bumps. (4) The convention sentence sits in README "Develop", not in CONTRIBUTING.md (not yet created); WQ-034 may move it. (5) No tag pushed; the owner's suggested first tag is `v0.17.0` on `main` after this round merges.

**Verification.** Orchestrator: each section cross-read against the bump commits 568483a (0.13.0), beb7423 (0.14.0), 130efb3 (0.15.0), 873d709 (0.16.0), 2527dea (0.17.0) and the WQ-027–WQ-031 archive entries / CLAUDE.md blocks; `git diff --stat` shows only the three files, appends only. Agent: `node tests/replay.js` "all passed (46 recordings)". NOT run: the browser suites (docs-only change, no code touched).

**Follow-ups.** Owner: tag `v0.17.0` on `main` once this round is merged. No new queue item.

---

---

### WQ-030 — Transitions drill: ten shots, movement on the trigger allowed (D-111, D-112)

- **Closed:** 2026-10-25 · **Outcome:** done-with-deviations
- **Executed by:** `orchestrated-feature` in the orchestration session (Fable 5.1): implementer on opus (two rounds), independent test writer on sonnet (two rounds), integrity reviewer on opus, correctness reviewer on sonnet; the orchestration session adjudicated, ran the suites and the byte-identity diff, and did the final review · **Round:** round-20261025-3
- **Commits / PR:** 873d709 "WQ-030: engine Transitions drill (window, drift re-takes, press-start grading)"; b7037bf "WQ-030: page Transitions drill (picker entry, status line, results, recorder label)"; c2093b4 "WQ-030: docs for the Transitions drill (CLAUDE.md, README, class use, recordings, D-113, D-114)"; 50b4b33 "WQ-030: tests for the Transitions drill (synthetic recording, expectations, replay window checks, smoke, roundtrip, screenshots)"; 991d0c4 "WQ-030: grade from the press start by running minimum, close the window on drill changes, compact landscape picker"; 02812fa "WQ-030: docs for the review fixes (grading origin, window close, compact picker, Transitions exception, Q18)"; fbce005 "WQ-030: tests for the review fixes (running-minimum grading origin, window close, compact picker, structural expectations)"; merge 0c2ccc0 into the orchestration branch

**What was done.** `engine.js` 0.15.0 → 0.16.0 (`package.json` too): `DRILL_DEFS.transitions = {delayMs: [2000, 5000], shots: 10, pairShots: 2, onTriggerFree: true, ready: true}` on Bill's single-string path (comments generalised from "sixth" to the last shot, `def.shots`). The window (D-112 d): `freeOnTrigger()` (def with `onTriggerFree`, phase live, at least one run shot, a trigger touch exists) is stored per tick in `st.drillFree` and gates the whole off-frame `move` alarm block (rate, `jerkMs`, `offFrameDeg`); the 180 block is untouched. Drift reference re-takes with the `if (st.qOff) st.qOff = st.q.slice()` idiom at a trigger lift inside the window (`endTrigger`), at the tenth shot (which also resets `st.trig.moveMs`), and in `startDrill` / `cancelDrill` when they end a run inside the window (`closeWindow()`, which also clears `st.drillFree`, as does `setPaused(true)`). Grading (D-112 i): each trigger object carries `minPull`; while a Transitions run is live and the trigger unfired, `retakeOrigin()` re-takes the grade origin and clears the trace on every touch update and every tick until the pull is 15 % of `pullPx` above the lowest pull of the attempt, then freezes. Result: Bill's keys plus `pairSplits` (five), `transitions` (four), `avgTransition`, only for a def with `pairShots`. Packed events unchanged. `index.html`: `DRILL_SVG.transitions` (the mockup verbatim), fifth `DRILL_MODES` entry ("Five pairs, target to target"), `transitionsRows()` (First shot, Pairs, Transitions, Average transition, Total, Shots, then the shared rows and Best clean total), the D-112 k status texts, recorder label `drill-transitions`, `__tdt().drill.freeOnTrigger`, and a compact picker rule for landscape screens up to 430 px tall so five entries, the diagram and both buttons fit at 844×390 without scrolling. Tests: adaptive synthetic `drill-transitions` (seed 20261031; four 40° swings at 80 °/s with the trigger touch kept), structural expectations for any recording with the label plus tight synthetic-only checks, a replay.js engine block (swing before shot 1 / mid-window lift / after shot 10 / in Bill and Freestyle alarms, inside the window it does not and `drillFree` is asserted; drift re-takes at the lift and at shot 10; `jerkMs` restart; 180 inside the window; latched alarm; pause; reset-ride and aborted-press grading with Bill pairs; `closeWindow`; early shot; seed coercion; swing-stimulus assertions from the `m` rows), smoke `// WQ-030` block (picker with five, both viewports with no scrolling at 844×390, six runs, status texts, results rows against observed frames, Again, Change drill, gear cancel with `freeOnTrigger` false while paused), roundtrip Transitions recording (identical replay; the same log as Bill alarms), screenshots `docs/screenshots/wq-030/{picker,results}-{landscape,portrait}.png`. Docs: `CLAUDE.md` (Drills bullet, state machine, WQ-027 block wording, `## WQ-030` block), `README.md`, `docs/CLASS_USE.md`, `docs/RECORDINGS.md`, D-117 and D-118 (`Claude (proposed)`; D-113 / D-114 on the branch, renumbered at the merge with `main` under D-116; the commit subjects keep the old numbers), `OPEN_QUESTIONS.md` Q18.

**Why.** D-111 (Ricky, 2026-10-25): a fifth drill, Transitions: low-ready start, one beep, five pairs at different targets, and for this drill only movement with the finger on the trigger from the first shot to the tenth; D-112 (proposed) details; built on the WQ-027–WQ-029 framework.

**Deviations.** (1) D-112 i refined (review finding, HIGH): the grade origin is not frozen once per press at the first 15 % pull (a reset ridden between targets or an aborted partial press then graded the swing, dev 40°) but follows the muzzle until the pull is 15 % above the lowest pull of the attempt (`minPull`), on every touch update and every tick (D-117). (2) `startDrill` / `cancelDrill` re-take the drift reference when they end a run inside the window, and `st.drillFree` is cleared on pause and on drill changes (review findings, API hazards not reachable from the page). (3) The picker got a compact landscape rule instead of scrolling (the mockup's "scrolled" variant); D-118 says so. (4) `OPEN_QUESTIONS.md` Q18 (outside the item's file list) records a design question for Ricky: inside the window only the 180 rule guards the muzzle, and a finger lifted off the trigger mid-swing alarms within a few frames while keeping it on never does. (5) The Transitions expectations are structural for any recording with the label; the timing and grade checks run on the synthetic recording only, so a real phone recording is not failed by synthetic timings. (6) `avgTransition` shows "—" when null (unreachable with ten shots). (7) CLAUDE.md and CLASS_USE "all Freestyle rules stay on during a drill" now carry the Transitions exception. (8) Screenshots live in `docs/screenshots/wq-030/` (the item offered `docs/mockups/drills/` or test output).

**Verification.** Orchestrator: `npm test` on the finished worktree branch, exit 0, three suites "all passed", 0 FAIL (776 PASS lines in total; the test writer's two runs: replay 267 PASS, smoke 435 PASS, roundtrip 74 PASS, 0 FAIL each), and again on the merged orchestration branch (776 PASS lines, 0 FAIL, exit 0); replay "all passed (45 recordings)". Direct event diff of the 44 pre-existing recordings through engine 0.15.0 and 0.16.0 (before and after the fix round, and on the merged tree): 0 differ; `synthetic/drill-transitions.json` the only new key. `grep -cE "Math\.random|performance\.now|document" engine.js` = 0; no model names in the diff; clean tree after `npm test`. Orchestrator hand-fed trace: one beep; pair 1 opens the window; a lift onto the frame, a swing on the frame and a re-engaged swing on the trigger raise no alarm; ten Clean shots; the swing after shot 10 alarms 117 ms later; the result carries `pairSplits` / `transitions` / `avgTransition`; a Freestyle press right after the run grades the swing (Jerked 40°) and alarms, so nothing leaks. Agent simulations: reset-ride and aborted-press shots Clean (dev 0) in Transitions and Jerked 41 in Bill; `cancelDrill` / `startDrill('bill')` mid-window give one `drillCancel` and no alarm; picker bounding boxes inside the viewport with no scroll at 844×390, 390×844, 667×375 and 932×430. NOT verified (owner, an iPhone and an Android phone): a full run swinging between two or three targets with the finger on the trigger raises no alarm between shot 1 and shot 10; raising from low ready with the finger on the trigger still alarms; moving after shot 10 without the finger on the frame alarms; the results show five pair splits and four transitions; the compact landscape picker on a real phone screen (Safari landscape with the toolbar visible).

**Follow-ups.** Q18 (`OPEN_QUESTIONS.md`) for Ricky: a large-angle cap inside the window, a grace on the drift test after a mid-swing lift, both, or leave as D-112 f; the answer becomes a decision and a queue item. D-112, D-117, D-118 stay `proposed` until Ricky accepts them. Untested in the browser: the Early-shots row for Transitions (engine-level covered). No new queue item.

---

---

### WQ-029 — Box Drill: five positions, move cue after 2+ shots (D-95, D-98)

- **Closed:** 2026-10-25 · **Outcome:** done-with-deviations
- **Executed by:** `orchestrated-feature` in the orchestration session (Fable 5.1): implementer on opus (two rounds), independent test writer on sonnet (three rounds), integrity reviewer on opus, correctness reviewer on sonnet; the orchestration session adjudicated, ran the suites and the byte-identity diff, and did the final review · **Round:** round-20261025-2
- **Commits / PR:** 130efb3 "WQ-029: Box Drill in the engine and the page"; 2b06181 "WQ-029: document the Box Drill (D-107, D-108)"; 7452c84 "WQ-029: Box Drill tests, synthetic recording and screenshots"; 3b293c8 "WQ-029: mark the next Box position when a 180 alarm spans the cue; review fixes"; f404ce1 "WQ-029: tests for the review fixes (spanning 180 alarm, split text, finishing cancel)"; cb9d88b "WQ-029: measure the WQ-027 cancel-restart beep gap from the arming at Resume"; merge into the orchestration branch

**What was done.** `engine.js` 0.14.0 → 0.15.0 (`package.json` too): `DRILL_DEFS.box = {delayMs: [1000, 4000], reps: 5, shotsPerRep: 2, cueHoldMs: 0, cue: 'move', next: 'live', ready: true}` and `lowready` gains `cue: 'lowready', next: 'standby'`, so Low Ready and Box share one per-rep code path in `tickDrill`; `cur.startT` (beep, or the previous cue for Box); with `cueHoldMs` 0 the move cue comes at the first tick with the finger on the frame after ≥ 2 shots, in the same tick as and after that tick's `ok`; after the cue the next position is live at once (no beep, no delay, no `rng` draw); position result `{rep, startT, beepT, time, splits, shots, early, alarms, withAlarm}`; run result `{drill, seed, beepT, reps, total (beep → last shot of position 5), early, alarms, withAlarm, endT}`; a 180 alarm still sounding at a move cue marks the next position (fix round). `index.html`: Box `ready: true` with D-95 text, `boxRows()` (per-position `time x.xx s · split(s) … s · grades`, "Total (beep to last shot)", shared Early / With alarm rows, "Best clean total this session"), status texts (D-108, "of 2" from `shotsPerRep`), `Snd.cue3(0.35)` for `cue: 'move'` (after the OK tone, D-98 g), recorder label `drill-box`. Tests: adaptive synthetic `drill-box` (position 2 three shots, position 3 a one-shot return held 1.3 s), 19 expectation checks, replay.js Box determinism block (positions open at the cue, pause in live and in finishing, 180 alarm at the beep and spanning a cue, third shot at position 5, early shot, seed coercion, `resetStats`), smoke `// WQ-029` block (~100 checks: picker order with four modes, three runs with the rAF observer, cue frame = return frame, one-shot return gives no cue, alarm position, Best clean total over runs, gear cancel, Again, Change drill, leading-zero and ≥ 1 s split rendering, bounding boxes), roundtrip Box recording (identical replay; 1 beep, 4 move cues, 1 end, 0 cancels), six WQ-027/028 checks updated for Box being visible, the WQ-027 cancel-restart beep check re-sequenced (its observer now starts before Resume, which is when the finger still on the frame re-arms and redraws the delay), screenshots `docs/screenshots/wq-029/{picker,results}-{landscape,portrait}.png`. Docs: `CLAUDE.md` (WQ-029 block; WQ-027/028 blocks and the Behavior-spec Drills bullet updated for all three drills; `ready: false` paths noted as unused until a future drill), `docs/RECORDINGS.md`, `docs/CLASS_USE.md` Box bullet with the spot layout, `README.md`, D-107 and D-108 (`Claude (proposed)`).

**Why.** D-95 (Ricky, 2026-10-24): four marked spots, five positions ending back at spot 1, at least two shots per position, three quick beeps when the finger returns to the frame as the cue to move, student-paced, completion tone at the last position; D-98 details; built on the WQ-027/028 framework.

**Deviations.** (1) The item's draft texts became D-108 ("Move to spot n · fire 2 or more", "Back at spot 1 · fire 2 or more", "Spot 1 (last)", "Finger on the frame to move / finish"). (2) A 180 alarm still sounding at a move cue marks the next position (review finding; D-107). (3) A cancel loses the positions done; position time = previous cue (or the beep) → first shot; total = beep → last shot at position 5 (D-107). (4) Box splits are written "splits .xx · .xx s" (one split: "split .xx s"); suffix order early then alarm, as Low Ready. (5) Screenshot path `wq-029/` (the item's `wq-024/` was a numbering leftover). (6) The `ready: false` code paths are now unused (every drill is ready) and left in place for a future drill. (7) The stale-synthetic drift (parking lot, from WQ-027) is unchanged: only `drill-box.json` was added.

**Verification.** Orchestrator on the finished branch: `npm test` three times (two with nothing else running): two runs exit 0, three suites "all passed", 0 FAIL (replay "all passed (44 recordings)" 184 PASS, smoke 360 PASS, roundtrip 60 PASS; 420 PASS lines); one run failed only the WQ-027 cancel-restart beep check (933 ms), which cb9d88b then fixed (its arming reference was a later arming than the one that drew the delay); after that fix the test writer saw the check pass in 6 of 6 sequential runs while the pre-existing summary-grading flake (parking lot) appeared in 2 of 6. Direct event diff of the 43 pre-existing recordings through engine 0.14.0 and 0.15.0: 0 differ; `synthetic/drill-box.json` the only new key and unchanged by the fix round. `grep -cE "Math\.random|performance\.now|document" engine.js` = 0; clean tree after `npm test`. Agent Node simulations: 1 beep, 4 move cues each at the same `t` as the `ok`, one-shot return gives no cue, total = last shot − beep, a pause gives one `drillCancel`, a move alarm escalating to 180 across cue 1 counts once and marks positions 1 and 2. NOT verified (owner, an iPhone and an Android phone): walking between spots with the finger on the frame does not alarm; touching the trigger while walking does; the move cue is heard after the OK tone; the completion tone plays at the last position.

**Follow-ups.** Parking lot: the pre-existing summary-grading smoke flake is now seen in up to 2 of 6 sequential runs (the suite is longer); the WQ-029 test writer suspects CDP motion timing in that old block (`lastGrade "Jerked"` with `rotEMA` ≈ 12) rather than the engine. No new queue item.

---

---

### WQ-028 — Low Ready drill with the three-beep cue (D-96, D-98)

- **Closed:** 2026-10-25 · **Outcome:** done-with-deviations
- **Executed by:** `orchestrated-feature` in the orchestration session (Fable 5.1): implementer on opus (two rounds), independent test writer on sonnet (three rounds), integrity reviewer on opus, correctness reviewer on sonnet; the orchestration session adjudicated, ran the suites and the byte-identity diff, and did the final review · **Round:** round-20261025-1
- **Commits / PR:** beb7423 "WQ-028: Low Ready drill (five reps, three-beep cue)"; 975917d "WQ-028: document Low Ready; log D-105, D-106"; 14d18aa "WQ-028: tests for the Low Ready drill"; b97d44a "WQ-028: make Low Ready browser timing checks load-tolerant"; 59c3c23 "WQ-028: count Low Ready alarms between reps once; best average reaction"; 5423e5a "WQ-028: document the Low Ready fix round; amend D-105, D-106"; fe8f464 "WQ-028: tests for the Low Ready fix round"; merge into the orchestration branch

**What was done.** `engine.js` 0.13.0 → 0.14.0 (`package.json` too): `DRILL_DEFS.lowready = {delayMs: [2000, 5000], reps: 5, shotsPerRep: 2, cueHoldMs: 750, ready: true}`; a def with `reps` takes new Low Ready branches of `drillShot` / `tickDrill` (per-rep `cur`, `reps`, `cueDueAt`, `earlyPending`, `alarmsPending`, `alarmCounted`, `alarmInPending`; the 750 ms cue timer runs only with the finger on the frame and restarts when it leaves; reps 1–4 emit `drillCue {cue: 'lowready', rep}` and draw the next 2–5 s delay; rep 5 emits `drillEnd` with `{reps, total, avgReaction, bestReaction, early, alarms, withAlarm}`); `packEvent` `[t, 'drillCue', cue, rep]`. `index.html`: `Snd.cue3()`, Low Ready `ready: true` with D-96 text, `lowReadyRows()` in the results overlay (per-rep reaction / split / grades, Total, Average and Best reaction over no-alarm reps, "Best average reaction this session"), status texts (D-106), `complete(0)` at the Low Ready end, recorder label `drill-low-ready`, `__tdt().drill` fields. Tests: adaptive synthetic `drill-low-ready` (a live engine decides the next frame's touches; rep 2 restarts the 750 ms, rep 4 has three shots), 16 expectation checks, replay.js Low Ready determinism + alarm-spanning-beeps block, smoke `// WQ-028` block (two five-rep runs: restart, one-shot rep, alarm rep, alarm between reps, early shots, three-shot rep, gear in standby and during the cue timer, Again, Change drill, bounding boxes), roundtrip Low Ready recording (identical replay, 5 beeps / 4 cues / 1 end / 0 cancels), screenshots `docs/screenshots/wq-028/{picker,results}-{landscape,portrait}.png`. Docs: `CLAUDE.md` (WQ-028 block; WQ-027 block updated; `createEngine`/`Snd` rows; state-machine sentence), `docs/RECORDINGS.md`, `docs/CLASS_USE.md` Low Ready bullet, `README.md`, D-105 and D-106 (`Claude (proposed)`).

**Why.** D-96 (Ricky, 2026-10-24): competition-style low ready with no muzzle-angle check, two shots per rep, the three-beep cue 750 ms after the finger is back, 2–5 s to the next beep, five reps; D-98 details; built on WQ-027's framework.

**Deviations.** (1) Alarm accounting beyond the item (review findings, accepted): an alarm episode that starts between reps counts into the run and the next rep; one episode counts once even when it spans beeps; an alarm sounding at a beep marks that rep (D-105 amended). (2) Low Ready's session-best row is the best average reaction over no-alarm runs, not the best total, because the total includes up to 12 s of seeded delays (orchestrator's call, D-105). (3) A cancel between reps loses the reps done (D-105). (4) Status texts and the "Done" note are D-106; the item's "Back to low ready" text is not used. (5) `docs/CLASS_USE.md` heading became "Timed drills (Bill Drill, Low Ready)". (6) Screenshot path `wq-028/` (the item's `wq-023/` was a numbering leftover). (7) The browser cue-timing checks measure from rAF frames with a load-tolerant upper bound (−1 frame / +max(2 frames, 100 ms)); the Node checks keep one frame. (8) The roundtrip test's WQ-027 "another seed" check now scans seeds in Node instead of a fixed offset (it flaked once when the offset seed gave no beep).

**Verification.** Orchestrator on the finished branch with nothing else running: `npm test` twice, exit 0, three suites "all passed", 0 FAIL (replay "all passed (43 recordings)" 132 PASS, smoke 271 PASS, roundtrip 47 PASS; 318 PASS lines in total); direct event diff of the 42 pre-existing recordings (41 real + `drill-bill`) through engine 0.13.0 and 0.14.0: 0 differ, `synthetic/drill-low-ready.json` the only new key; `grep -cE "Math\.random|performance\.now|document" engine.js` = 0; clean tree after `npm test`. Under concurrent load the smoke suite reproduced the known pre-existing timing flake (summary grading checks) in one run of several; no WQ-028 check failed in any unloaded run. Agent Node simulations: 5 beeps / 4 cues / 1 end; cue 752 ms after the OK tick; restart measured from the second return; a 180 alarm spanning two beeps counts once; an alarm between reps marks the run and the next rep. NOT verified (owner, an iPhone and an Android phone): five reps run without touching the screen except the frame and trigger; the three beeps are clearly different from the start beep, the OK tone and the downrange double beep; the completion tone follows rep 5.

**Follow-ups.** None new (the stale-synthetic parking-lot note from WQ-027 still stands).

---

---

### WQ-027 — Drill framework, start-screen drill picker and the Bill Drill (D-93, D-94, D-97, D-98)

- **Closed:** 2026-10-25 · **Outcome:** done-with-deviations
- **Executed by:** `orchestrated-feature` in the orchestration session (Fable 5.1): implementer on opus (two rounds), independent test writer on sonnet (two rounds), integrity reviewer on opus, correctness reviewer on sonnet; the orchestration session adjudicated, ran the suites and the byte-identity diff, and did the final review · **Round:** round-20261024-5
- **Commits / PR:** 568483a "WQ-027: add drill framework and Bill Drill to the engine"; 9942214 "WQ-027: add drill picker, Bill Drill run, sounds and results overlay"; e9b7b11 "WQ-027: document drills, recording rows r/x and decisions D-99 to D-103"; ff0e89b "WQ-027: tests for the drill framework and Bill Drill, synthetic drill-bill, screenshots"; 773bc91 "WQ-027: count alarm episodes, hold the beep clear of the OK tone, cancel only started runs"; c22e58e "WQ-027: document the review fixes (D-102 refined, D-104)"; 85bd43f "WQ-027: strengthen drill tests, cover beep hold, alarm runs and seed coercion; gate screenshots"; merge ce8747d; orchestrator 820d2b3 "WQ-027: class-use note says results last for the session"

**What was done.** `engine.js` 0.12.6 → 0.13.0 (`package.json` too): `mulberry32(seed)` and `DRILL_DEFS` (exported; `bill` ready, `lowready` / `box` rejected until WQ-028 / WQ-029), `startDrill(t, id, seed)` / `cancelDrill(t)` on the engine object, `st.drill` with phases `standby → live → finishing → ended` driven by `tickDrill()` at the end of `tick()` and `drillShot()` from `fire()`, `st.drillRuns` (cleared by `resetStats`), events `drillBeep {drill, rep}`, `drillEnd {drill, result}`, `drillCancel {drill}`, packed as `[t,'drillBeep',rep]`, `[t,'drillEnd',drill,total]`, `[t,'drillCancel']`, replay rows `['r', t, drill, seed]` and `['x', t]`, `K.DRILL_BEEP_HOLD_MS` 350 (the beep waits until the finger has been on the frame that long, D-104). Bill result: `first`, five `splits`, `total`, per-shot `{grade, dev, unsafe}`, `early`, `alarms` (episodes from the beep to the end plus one already sounding at the beep), `withAlarm`. `index.html`: `DRILL_SVG` (all four diagrams inline from `docs/mockups/drills/diagrams.js`) and `DRILL_MODES` in D-93 order (Low Ready and Box hidden, `ready: false`), `#drillBtn` on the start screen, picker `#drillOv` (list left / diagram right, stacked in portrait), selection in `localStorage['tdt.drill']`, `beginDrillRun()` from Start, the recorder start, **Again** and Restore defaults while running, `leaveToStart()` from **Change drill** and **New session**, `Snd.timerBeep()` and `Snd.complete()`, `#drillLine` under the status pill, results overlay `#drillResOv` (pauses the engine while open), recorder label `drill-bill`, `__tdt()` fields. Tests: synthetic `drill-bill` (finger lifted 1.2–1.9 s so the deferred beep and the 350 ms hold are exercised; beep 2250 ms after arming, total 5715.667 ms), `tests/expectations.js` (11 checks), `tests/replay.js` drill counts plus a 14-check determinism / seed-coercion / cancel-semantics block, `tests/smoke.js` +87 checks (picker, persistence, fallback for a stored not-ready id, Bill run end to end against an rAF observer, early shot, deferred beep, alarm run and best-clean logic, 180 alarm sounding at the beep, gear cancel before and after the delay starts, Again, Change drill, not-ready rejection, bounding boxes; PNG writes gated behind `WQ_SCREENSHOTS`), `tests/roundtrip.js` +8 (a recorded Bill run replays to identical events, `r` first row, `x` row, no `drillCancel` from the results pause). Docs: `CLAUDE.md` (behaviour bullet, engine and page table rows, state-machine paragraph, WQ-027 block), `docs/RECORDINGS.md`, `docs/CLASS_USE.md` "Timed drills (Bill Drill)", `README.md` bullet, D-99–D-104 (`Claude (proposed)`), screenshots `docs/screenshots/wq-027/{start,picker,results}-{landscape,portrait}.png`.

**Why.** D-93 (Ricky, 2026-10-24): timed drills next to today's trainer, Freestyle the default, diagrams in the picker; D-97 Bill Drill; D-94 completion tone; D-98 the accepted details (seeded engine timing so recordings replay exactly, pause cancels, results session-only).

**Deviations.** (1) All four diagrams are ported, not only Freestyle and Bill (D-103); Low Ready and Box stay hidden. (2) D-104 (review finding, accepted by the orchestrator): the start beep is held until the finger has been on the frame 350 ms, so a beep deferred by the finger being off at the due time never overlaps the OK tone; the hold is in the engine because the beep time is the reaction-time reference. Normal runs are unaffected. (3) D-102 refined: a pause cancels only a run that is live, finishing, or in standby with its delay started; opening Settings before the finger ever touched the frame emits nothing. (4) "With alarm" counts alarm episodes (a move alarm escalating to 180 is one) plus an alarm already sounding at the beep (review finding R1/C4). (5) `docs/CLASS_USE.md` already had a "Drills" section, so the new one is "Timed drills (Bill Drill)". (6) The item's screenshot path `docs/screenshots/wq-022/` was a numbering leftover; `wq-027/` is used. (7) Results overlay choices D-99 (shots fired during an alarm show "alarm"), D-100 (best clean total per drill, no alarm), D-101 (picker over the start screen; Change drill returns to the start screen without opening the picker). (8) Rejected review finding C5 (Restore defaults while recording): impossible, opening Settings stops the recording.

**Verification.** Orchestrator on the merged branch: `npm test` twice, exit 0, three suites "all passed", 0 FAIL (replay 101 PASS "all passed (42 recordings)", smoke 176 PASS, roundtrip 33 PASS); direct event diff of the 41 pre-existing recordings through engine 0.12.6 and 0.13.0: 0 differ (`synthetic/drill-bill.json` is the only new key); `grep -cE "Math\.random|performance\.now|document" engine.js` = 0; the tree is clean after `npm test`. Test writer: smoke run four times, one run under concurrent load failed three pre-existing checks (the known timing flake in the parking lot), three clean. NOT verified (owner, an iPhone and an Android phone): the start beep is loud and unmistakable and the completion tone sounds like "done"; six fast shots with full resets all break and the results show believable times; whether a fast string alarms under the 300 ms jerk allowance (`jerkMs`, D-47) — report it, do not change the threshold.

**Follow-ups.** Parking lot: the committed synthetic recordings other than `drill-bill` are stale (engine 0.12.3; `clean-press`, `jerked-press`, `press-wobble`, `trigger-sweep` also differ in content since the D-72/D-87 trigger geometry) — regenerating them is routine but changes 11 files, left for its own commit. Start-beep envelope (exponential decay via `tone()`; a flat 0.3 s envelope if it sounds like a ping on phones) waits for the owner's judgement.

---

---

### WQ-026 — Sensitivity drop-down as presets with Custom; remove the engine multiplier (D-91)

- **Closed:** 2026-10-24 · **Outcome:** done-with-deviations
- **Executed by:** execution agent on opus; orchestration session (Fable 5.1) reviewed the diff, folded the CLAUDE.md blocks and re-ran the suites · **Round:** round-20261024-4
- **Commits / PR:** 45f926f "WQ-026: sensitivity drop-down sets slider presets, shows Custom; remove engine multiplier (D-91)"; a6c9930 "WQ-026: document sensitivity presets (D-92, CLAUDE.md, class use)"; orchestrator: "WQ-026: fold the superseded WQ-025 block into one CLAUDE.md section"

**What was done.** `engine.js`: `DEFAULTS.sensitivity`, `SENSITIVITY`, `limitsFor` and their exports removed; `tick()` reads `S.moveDps`, `S.moveAcc`, `S.offFrameDeg` directly again; `VERSION` and `package.json` 0.12.5 → 0.12.6. `index.html`: `SENS_PRESETS` (1.3 / 1 / 0.7) and `sensPreset(key)` = `DEFAULTS` × factor rounded to the slider step (Low 32.5 / 1.95 / 6.5, Default 25 / 1.5 / 5, High 17.5 / 1.05 / 3.5); `applySensitivity(key)` writes the three values into `S`, saves and syncs the sliders; `sensitivityFor(S)` returns the matching preset (half-step tolerance) or `'custom'`, used by `buildSettings()` and by the three sliders' `input` handler, so the select flips to the disabled, code-only **Custom** option while sliding and back to a preset when the values match again. Slider steps 0.5 °/s, 0.05 m/s², 0.5° with `trim: true` outputs (`32.5 °/s`, `1.95 m/s²`, `6.5 °`). The effective-value suffix, `sliderShows` and the debug-readout scaling from WQ-025 are gone. Fifteen `WQ-026:` smoke checks replace the twelve `WQ-025:` ones (order, placement, Low/High/Default values and outputs, D-64 store/drop with no preset key, Custom on slide and back, Restore defaults, no engine setting, 20 °/s burst alarms under High and not under Default); the roundtrip High case records with the preset values. Docs: `CLAUDE.md` now has one "WQ-025 / WQ-026" section (orchestrator folded the two), `docs/CLASS_USE.md` Before-class sentence, D-92 (`Claude (proposed)`), screenshots `docs/screenshots/wq-026/movement-alarm-{default,low,custom}.png`.

**Why.** D-91 (Ricky, 2026-10-24): the named sensitivities are specific values the user can slide on from, not a multiplier; a hand-moved slider shows Custom.

**Deviations.** (1) The three sliders drop trailing zeros via a per-slider `trim` flag; other sliders keep the general format. (2) Option labels stay "Low (limits +30%)" / "High (limits −30%)", now meaning relative to the defaults. (3) A `sensitivity` key left in `localStorage` by WQ-025 (never deployed to `main`) is ignored at load and dropped at the next save; no migration. (4) The detail row is D-92, a new ID.

**Verification.** Agent: `npm test` twice, exit 0 — replay 71 PASS / 0 FAIL ("all passed (41 recordings)"), smoke 89 PASS / 0 FAIL, roundtrip 19 PASS / 0 FAIL; `npm run test:replay` before/after differs only in the version string; direct event diff of all 41 recordings through the old and new engine: 0 differ. Orchestrator on the merged branch: `grep -n 'sensitivity\|SENSITIVITY\|limitsFor' engine.js` finds nothing; `npm test` twice, 108 PASS / 0 FAIL both times (replay "all passed (41 recordings)", smoke and roundtrip "all passed"). NOT verified (owner, any phone): pick High, a gentle off-frame movement that passed under Default alarms; nudge one slider → Custom; Restore defaults → Default.

**Follow-ups.** None.

---

---

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

