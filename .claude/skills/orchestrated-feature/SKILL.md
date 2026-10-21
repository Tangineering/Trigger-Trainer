---
name: orchestrated-feature
description: Implement a code change through orchestrated subagents — spec with verified anchors, an Opus implementer, an independent Sonnet test-writer, parallel two-lens first-pass reviews (Opus data-integrity/invariants/parity lens + Sonnet correctness/test-fidelity lens), fixes routed back to the original agents, then the orchestrator's own final review, the repo's checks, and its documentation pass. Use for any multi-part change to the product code — size-L work-queue items, or when the user asks to "use agents", "orchestrate", or names models for the edits. Takes an argument for the planning gate — "plan-approval" (present the plan in plan mode and wait for user approval) or "direct" (plan inline and proceed immediately; the default).
---

# Orchestrated feature round

Multi-agent implementation pipeline for code changes in this repo. The stage
structure is the point: an independent reviewer whose lens is "who else reads
this value / which other code path must stay unchanged" finds what the
implementer misses, because the implementer's lens is "is my function
correct".

**Read `PROJECT.md` (next to this file) before Stage 0.** It holds everything
specific to this repo: where the code lives, the check commands, the
invariants, the integration-surface checklist, any model overrides, and the
failure-mode table. This file is the procedure; that file is the project. If
a `PROJECT.md` section is still a placeholder, derive the answer from the
repo's CLAUDE.md / README / CI config, use it for this round, and propose the
filled-in text to the user at the end.

## Models

Every agent this skill dispatches runs on the model
`.claude/skills/work-queue-run/MODELS.md` assigns to its role; the stages
below name the default from that table. `PROJECT.md`'s "Model overrides"
section is the only place a repo changes one, and it records why. The
constraints that never move: the orchestrator (you) is never below Opus tier
and never delegates adjudication or the final review; nothing that edits a
file runs below Sonnet tier; the test writer and the correctness reviewer are
**different agents** from the implementer and the integrity reviewer, on a
different model unless `MODELS.md` rule 6 forces a substitution (say so in
the report), so the independent check does not share the implementer's
blind spots; review
fixes go back to the agent that produced the artifact. Name the model beside
every agent in the final report.

## Argument: planning gate

- `plan-approval` — draft the plan, enter plan mode (EnterPlanMode), and
  present it for explicit user approval before any agent is dispatched. Use
  when the change is architecture-shaping (a new single-source-of-truth
  helper, a data or file-format change, a change to a user-visible default)
  or the user asked to see the plan first.
- `direct` (default) — plan inline and proceed straight to dispatch. Use when
  the design was already settled with the user, or the user handed over a
  work-queue item or feature list and is not watching.

Either way the plan is mandatory, and **even in `direct` mode post a short
plan summary to the user before Stage-1 dispatch**. The plan must be
user-visible, not prompt-embedded.

When this round executes a `WORK_QUEUE.md` item, the item text is the spec's
starting point: keep its anchors and its out-of-scope line verbatim, run the
round in the orchestration session itself (agents cannot spawn agents), and
end the round with the report block `work-queue-run` expects. The item gets
the same worktree an S/M item would — `.claude/worktrees/wq-NNN` on branch
`wq-NNN`, created as `work-queue-run` §3.1 says — because parallel items'
branches are merged into the orchestration checkout mid-round and would
collide with uncommitted edits there. The implementer and the test writer
work only in that worktree and receive `BRIEF_RULES.md` with its path;
reviewers read `git -C <worktree> diff HEAD`; after Stage 5 the orchestrator
commits there as `WQ-NNN: …` and merges per `work-queue-run` §4. Outside a
queue item (a feature the user hands over directly) the round works on the
current checkout and leaves the tree uncommitted for the user.

## Stage 0.5 (optional, runs before Stage 0 when needed) — Research fan-out

For open-ended rounds where the design depends on facts not yet in hand
(library or tool semantics, platform behavior, measured data properties),
fan out parallel domain-scoped research agents before writing the spec —
Sonnet per domain, Haiku for a lookup with a yes/no or one-value answer.
Synthesize selectively. Skip for well-scoped rounds.

## Stage 0 — Spec with verified anchors (orchestrator, before any dispatch)

1. Read the code yourself and pin down the exact functions, settings/config
   keys, defaults, enums, line anchors, and the **existing mechanism to
   mirror** — usually the most recent feature of the same class (`PROJECT.md`
   lists known templates). Verify every fact against source before it enters
   a prompt; an agent will trust it. A read-only Explore or Haiku agent may
   locate things for you; it never decides anything.
2. **Enumerate the integration surface explicitly.** For every value the
   change reads or writes (a config key, a setting, a schema field, an API
   parameter), grep for EVERY reader and writer across the layers named in
   `PROJECT.md`'s integration checklist. For a change to a computed value,
   list every consumer of the helper that owns it. List every output (a
   command line, a file, a response, a rendered result) that must stay
   byte-identical when the new behavior is inactive.
3. **New settings.** A new persisted setting needs every layer the project
   requires (default, validation — including re-validation wherever stored
   data is loaded without validation — every entry point/UI that sets it, and
   docs), or a documented exception. A per-run option never persists. Say
   which in the spec.
4. **Architecture conventions** the change must obey — copy them from
   `PROJECT.md` into the spec (e.g. which layers may do I/O, exit or print;
   the error types; which entry points must stay in parity).
5. **State the invariants by name** (from `PROJECT.md`): unchanged inactive
   paths, protected files/folders, data/schema versioning discipline, and
   anything the repo's regression checks pin.
6. **Cross-feature interaction check**: when the round changes more than one
   feature sharing a code path (e.g. two agents editing one file), state which
   regions each owns and which existing behaviors' inputs cross into the
   other's domain.
7. License judgment calls: tell the implementer to deviate where the spec
   conflicts with an invariant, and to document every deviation with
   reasoning.

## Stage 1 — Implementation (Opus agent, synchronous)

One `general-purpose` agent on **Opus** (the implementer row of `MODELS.md`)
implements the change. Prompt contents: the full spec with anchors, the
integration-surface list, the invariants, the deviation license, the scope
fence ("modify ONLY these files"), and "do not run the slow regression checks
or write tests" (later stages own those). The fast syntax/lint checks from
`PROJECT.md` are welcome. Add the **scope-extension rule**: a closely related
change that fits the same surface is flagged to the orchestrator, not
implemented unbidden. Require a report with file:line anchors and a
deviations section. Keep the agent's ID — fixes go back to it.

## Stage 2 — Tests (Sonnet agent, synchronous, after Stage 1)

A separate agent on **Sonnet** (the test-writer row of `MODELS.md`) writes
the tests — independence from the implementer is deliberate, and so is the
different model. Two shapes, by what changed:

- **Logic changes** → tests in the repo's own framework and location
  (`PROJECT.md`), run with its test command. The agent must not install new
  dependencies. Tests never touch the protected paths in `PROJECT.md`; they
  use temp directories. Pure helpers (computed values, validators, command
  builders) are the primary targets; slow external tools are not run in unit
  tests unless the repo already does so.
- **UI-only changes** with no test harness → the test stage is runtime
  verification by the method in `PROJECT.md` (e.g. driving the real page in a
  browser): the agent exercises each behavior and reports it verified /
  unverified with evidence, backing up and restoring any state it mutates.

Prompt: the change's semantics with anchors, the exact test list (per
behavior, including the negative/guard cases), and the scope fence. The list
is a **floor, not a ceiling** — the agent reports perceived gaps before
closing. Warn it about the recurring traps:

- **Byte-identity tests must compare against a captured constant**, not
  against the new helper's own output for the inactive case. Capture the
  historical output as a literal in the test.
- **Validators must be exercised on the load path**: when stored data is
  loaded without validation, a hand-edited bad value must fail with the
  project's error type, naming the key, at the re-validation site — not only
  in the setter.
- **Vacuous probes**: when a change moves which code path OWNS a case, an
  existing test of that case may pass for the wrong reason. Assert the
  mechanism fired.

## Stage 3 — Two-lens first-pass review (parallel background agents)

Dispatch two reviewers in parallel against the uncommitted `git diff`,
read-only:

- **Opus reviewer, data-integrity / invariants / parity lens**: every path
  or value derived from user/stored input passes the project's guards;
  inactive paths are byte-identical; the single-source-of-truth helper has no
  second implementation and every consumer is switched; a new setting is
  complete across every layer and the entry points cannot drift; layering
  rules hold (who may do I/O, exit, print, save); atomic writes where the
  project requires them; platform path/encoding handling; the interaction
  with every OTHER reader of the touched values. This lens needs the whole
  repo in view, which is why it runs on the stronger model. Require a list
  of hazards checked and found CLEAN, not just findings.
- **Sonnet reviewer, correctness / test-fidelity lens**: boundaries and
  off-by-ones (rounding, clamping, empty and single-element inputs),
  copy-paste divergence from the mirrored mechanism, stale comments and
  docstrings, error messages that name the wrong control or setting, and
  per-test vacuity ("would this test pass if the feature were broken?") plus
  an enumeration of untested behaviors. Line-level reading; the different
  model is deliberate.

While the reviewers run, the orchestrator runs the repo's slow regression
checks and the full test suite (`PROJECT.md`) for an empirical baseline — do
not sit idle.

## Stage 4 — Adjudicate and route fixes back

Adjudicate every finding yourself — explicit ACCEPT / REJECT / PARTIAL with
reasoning; verify claims against the code before accepting a HIGH. This is
the orchestrator's job and is never delegated. Route code fixes to the
implementer and test fixes to the test-writer by finding ID (SendMessage to
the original agent, which keeps its context and its model; or, when that
agent is gone, a fresh Agent call on the same model with the findings
embedded). The orchestrator may apply small fixes directly but must say so in
the report.

- **The deviation license applies to reviewer fix text too** — a finding can
  be right while its suggested fix is wrong.
- The test-fix prompt covers fixture repairs, de-vacuating flagged tests, and
  new coverage for every review-round code change. The test agent iterates to
  0 failures but STOPS and reports if a failure looks like a code defect — it
  never edits product code.

## Stage 5 — Orchestrator final review

Not optional, not a rubber stamp of the reports, and not delegated:

1. Read the critical new sections yourself (the helper that owns the
   decision, the validators, the branches that must stay unchanged) against
   the spec and the accepted findings.
2. Trace at least one subtle interaction end-to-end that no reviewer claimed.
3. Rerun the fast checks, the full test suite and the slow regression checks
   yourself; report counts from the run output, verbatim. A check that could
   not run is reported as SKIPPED with the reason — a skipped check is not a
   pass. For UI changes, exercise the change once by the runtime method.
4. Run the repo's documentation pass (`PROJECT.md`): docs describing the
   changed behavior, settings inventories, changelog, and any memory or
   planning file the project keeps.
5. Report to the user: what was built, every agent dispatched (role, model,
   outcome), every accepted finding and its fix, the judgment calls, final
   check results, and what remains (uncommitted tree, owner-side checks that
   need hardware, data or credentials the session lacks).

## Known failure modes this pipeline exists to catch

Generic classes; `PROJECT.md` keeps the repo's own instances. When a round
catches (or misses) a new class, add a row there.

| Failure mode | Caught by |
|---|---|
| Input-derived path or value that bypasses a guard | Stage 3 integrity lens |
| Second implementation of a single-source-of-truth value | Stage 0 item 2 / integrity lens |
| Inactive path silently changes | Stage 2 byte-identity test / regression checks |
| Unvalidated stored value reaching the core | Stage 2 load-path trap |
| Entry-point drift (one interface gains a behavior the other lacks) | Stage 0 item 3 / integrity lens |
| Layering violation (core module doing a driver's job) | Stage 3 integrity lens |
| Error message naming the wrong control | Stage 3 correctness lens |
| Test that passes with the feature broken | Stage 3 correctness lens |
| Stale docs | Stage 5 documentation pass |
| Implementer and checker sharing one reading of the spec | Different agent and model for Stage 2 and the Stage 3 correctness lens (`MODELS.md` rule 2) |
