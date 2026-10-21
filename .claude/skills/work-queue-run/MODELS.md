## Model use for orchestrated work

<!-- Installed beside work-queue-run as .claude/skills/work-queue-run/MODELS.md
     and read by both work-queue-run and orchestrated-feature. The orchestration
     session reads this when it dispatches agents; execution agents never pick
     models (they cannot spawn agents). Model names are the
     Agent tool's `model` tiers (`opus`, `sonnet`, `haiku`), not product
     versions: when the tiers are renamed, map by capability, strongest first. -->

### Roles and their models

| Role | Model | Why |
|---|---|---|
| Orchestration session (plans rounds, writes briefs, adjudicates findings, final review, archives) | The strongest model the owner runs sessions on — never below Opus tier | It is the only reader of every agent's report and the only judge of acceptance; a weaker adjudicator makes every other choice moot. Adjudication, the final review and the archive entry are never delegated. |
| Execution agent for any size S or M item not covered by the next row (product code, and every M item) | `opus` | It works unsupervised in its own worktree and cannot ask questions; the brief carries every fact, and the agent must make the safest call when the item is silent. |
| Execution agent for a size S item that edits only docs, ignore patterns, CI config or other tooling, with `Env: any` and a mechanical Acceptance list | `sonnet` is acceptable; `opus` when in doubt | The acceptance check is textual and the orchestrator re-reads the diff. |
| Size L, product code — implementer (`orchestrated-feature` Stage 1) | `opus` | Owns the whole change under a scope fence; keeps its agent ID so review fixes go back to it. |
| Size L, product code — independent test writer (`orchestrated-feature` Stage 2) | `sonnet` | Deliberately a different agent **and** a different model from the implementer: the tests must not inherit the implementer's reading of the spec. It never edits product code; a failing test that looks like a code defect is reported, not patched around. |
| Size L, product code — first-pass reviewer, invariants / guards / integration lens ("who else reads this key, which inactive path must stay byte-identical, which single-source-of-truth helper grew a twin"; `orchestrated-feature` Stage 3) | `opus` | This lens needs the whole repo in view and finds what the implementer's "is my function correct" lens misses. Read-only. |
| Size L, product code — first-pass reviewer, correctness / test-fidelity lens (off-by-one, copy-paste divergence from the mirrored mechanism, stale comments, wrong control named in an error, vacuous tests; `orchestrated-feature` Stage 3) | `sonnet` | Local, line-level reading; runs in parallel with the other reviewer. Read-only. |
| Size L, packaging / docs / tooling — implementer | `opus` | Same reasoning as the code implementer. |
| Size L, packaging / docs / tooling — reviewer ("find what would fail on the target platform", briefed with the Acceptance list) | `opus` | Platform-failure hunting is inference over the whole build, not a textual check. Never edits. An empirical build or run on a platform this session has beats a second reviewer. |
| Fix routing after review (code fixes, test fixes; `orchestrated-feature` Stage 4) | The **same agent** that produced the artifact, so the same model | It has the context; a fresh agent re-derives it and re-makes the original mistakes. A fresh Agent call with the findings embedded is the fallback when the original is gone, at the same model tier. |
| Research fan-out before a spec (facts not yet in hand: library semantics, browser behavior, measured properties; `orchestrated-feature` Stage 0.5) | `sonnet` per domain; `haiku` for pure lookups with a yes/no or one-value answer | Breadth is the point; the orchestrator synthesizes selectively. |
| Read-only exploration of the repo (where is X, which files read key Y) | `haiku` or the harness's read-only Explore agent | Location, not judgment. Never used to review or audit. |

### Rules that follow from the table

1. **Nothing that edits files runs below Sonnet tier**, and nothing that judges
   acceptance runs below Opus tier. Haiku locates and looks up; it never edits,
   reviews or decides.
2. **Different model for the independent check.** When a stage exists to catch
   what another stage missed (test writer vs implementer, the two review
   lenses), give it a different agent and, where the table says so, a
   different model. Two Opus agents reading the same spec share blind spots.
3. **The orchestrator never economizes on itself.** Cheaper models go to the
   leaves (lookups, parallel reviews, mechanical docs items), never to the
   root that reads all the reports.
4. **Forked agents ignore the model field** (a fork always runs on the
   session's model). Use a fork only when the agent needs the conversation
   itself; a briefed fresh agent is the normal case for queue items, since the
   item text plus `BRIEF_RULES.md` is the whole brief by design.
5. **Name the model in the round report** for every agent dispatched (role,
   model, outcome). A round whose report does not say which model did what
   cannot be compared with the next one.
6. **When a tier is unavailable, step up, never down**: no Opus → the
   session's own model; no Sonnet → Opus. Record the substitution in the
   round report.

### Who reads this file, and where a repo overrides it

`work-queue-run` reads it when it dispatches S/M execution agents and the
packaging/docs implementer-plus-reviewer pair; `orchestrated-feature` reads
it for its stages (the table names each). This file is refreshed by the kit
installer and carries no project state, so a repo never edits it: a
departure for one role goes in `.claude/skills/orchestrated-feature/
PROJECT.md` under "Model overrides", one line per role with the reason, and
rules 1–3 above still bind — that file is the home for overrides of the
`work-queue-run` roles too, even in a repo that never runs a size-L item,
so there is one place to look. A repo that runs size-L items through a
procedure of its own (named on the item's `Size:` line) fixes models per
stage in that procedure; this file covers every role it does not name.
