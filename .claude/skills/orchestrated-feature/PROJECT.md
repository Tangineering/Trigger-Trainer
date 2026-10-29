# orchestrated-feature — project specifics

<!-- Fill in once per repo. The `orchestrated-feature` skill reads this file
before every round; SKILL.md stays generic so the kit can refresh it. Keep
entries short and verified. A section left as a placeholder makes the skill
derive it from CLAUDE.md / README / CI and propose text for it here. -->

## Code layout

- `engine.js` — all trainer logic and the record/replay helpers; no DOM, no
  `performance.now()`, no `window`. Runs in the browser as `TDT` and in Node
  via `require`.
- `index.html` — markup, CSS and UI wiring only: browser events → engine
  inputs, engine events → sound, vibration and pixels. Settings (`S`,
  `SLIDERS`), `Snd`, the recorder, the Settings and Summary overlays.
- `manifest.webmanifest`, `icon.svg` — static companions.
- `tests/` — Node replay harness, Playwright browser tests, drill
  expectations, synthetic-recording generator; real phone recordings under
  `tests/recordings/<phone>/`.

## Checks

- **Fast checks** (implementer may run): `node -e "require('./engine.js')"`
  (engine loads in Node); `npm run test:replay`.
- **Test suite**: `npm test` — `tests/replay.js` (every recording against
  `tests/expectations.js`, live == replay, axis diagnosis), `tests/smoke.js`
  (browser state machine with simulated touch and `DeviceMotionEvent`),
  `tests/roundtrip.js` (record in the page, replay in Node, identical events).
  The two browser suites need Playwright (`npm install` in a new worktree).
- **Slow regression checks** (orchestrator only): `npm run test:replay`
  before and after the change, stating which recordings change outcome.
  `node tests/make-synthetic.js` regenerates `tests/recordings/synthetic/`
  when a drill or the generator changes.
- **UI runtime verification**: serve the repo root statically and drive
  `index.html` in a browser with the mouse fallback; `window.__tdt()` gives a
  read-only state snapshot. Sensor and touch behavior is owner-verifiable
  only (a real iPhone and a real Android phone): ship the mechanism and
  return the item `blocked:owner-machine` for that half.
- **Documentation pass**: `CLAUDE.md` (architecture tables, state machine,
  platform facts), `docs/DECISIONS.md` (a `Claude (proposed)` row for every
  decision made), `docs/RECORDINGS.md` (drills, file format),
  `docs/CLASS_USE.md` (student-facing steps), `README.md` when user-visible
  behavior changes. Bump `VERSION` in `engine.js` when outputs change for the
  same inputs.

## Model overrides

<!-- The defaults are the role table in `.claude/skills/work-queue-run/MODELS.md`
(Opus implementer and integrity reviewer; Sonnet test-writer and correctness
reviewer; Sonnet/Haiku research; the orchestrator never below Opus tier).
List ONLY departures from that table, one per line, each with its reason —
and keep the table's hard rules (nothing below Sonnet edits, nothing below
Opus judges, the independent check on a different model). Normally empty. -->

None.

## Integration-surface checklist

For a setting, a threshold or an engine event, the places a reader or writer
can live:

- `engine.js`: `DEFAULTS`, `ZONES`, `K`, `createEngine` state, the emitted
  event list, `summarize`, `replay` and its `overrides`.
- `index.html`: `S` and its `localStorage['tdt.settings.v2']` load (a diff
  against `DEFAULTS` since D-64; a `v1` whole-object save is migrated once,
  D-66; bump the key on an incompatible schema change), `SLIDERS`, `onEvent`, the Settings
  readout, the Summary table, `window.__tdt()`.
- Tests: `tests/expectations.js`, `tests/make-synthetic.js`, the drill list
  in `index.html` (`id`, `name`, `hint`), `tests/smoke.js`.
- Docs: `CLAUDE.md` tables, `docs/RECORDINGS.md` drill table,
  `docs/CLASS_USE.md`.

## Mechanisms to mirror

- A new tunable setting → `jerkMs` (D-35): default in `engine.js`
  `DEFAULTS`, read in the press branch of `tick`, Settings slider in
  `index.html` `SLIDERS`, drill `press-wobble` in the drill list,
  `tests/make-synthetic.js` and `tests/expectations.js`, row in
  `docs/RECORDINGS.md`.

## Conventions and invariants

- Every decision lives in `engine.js`; every engine input carries its own
  timestamp. The engine never reads `performance.now()`, `window` or the DOM.
- Static files, no build step, no runtime dependencies, no CDN scripts.
- No data leaves the phone: no network calls, analytics or cookies;
  `localStorage` access is wrapped in try/catch and the page works without it.
- Live == replay: a recording made with the current `VERSION` replays to
  identical events. Bump `VERSION` when outputs change; not for refactors
  that keep replays identical.
- Degrade gracefully on missing capabilities (no vibration on iOS, no touch
  radius, no orientation lock).
- Hub files for parallel items are append-only, one block per item id:
  `CLAUDE.md`, `README.md`, `docs/OPEN_QUESTIONS.md`, `docs/DECISIONS.md`,
  `docs/IDEAS.md`. Items that touch `engine.js` or `index.html` never run in
  parallel with each other.

## Protected paths

- `tests/recordings/` except `synthetic/` — real phone recordings are ground
  truth; never edit one to make a test pass. `synthetic/` changes only
  through `tests/make-synthetic.js`.

## Failure-mode instances

| Failure mode | Instance in this repo |
|---|---|
