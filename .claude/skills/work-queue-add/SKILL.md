---
name: work-queue-add
description: Add, refine, split, or re-prioritize items in docs/WORK_QUEUE.md — the project's central planning document. For exploratory sessions that discover work (a bug, a gap, a release-prep task, a follow-up from a completed item) and for the orchestration session when it raises items itself. Produces a self-contained item an execution agent can act on from the item text alone.
---

# Adding to the work queue

`docs/WORK_QUEUE.md` holds every piece of outstanding work; `docs/WORK_COMPLETED.md`
holds what is finished. An orchestration session reads the queue, picks a
round, and hands each item to an execution agent **as the agent's entire
brief**. So an item is only as good as what a stranger can do with its text:
write it for an agent that has the repo's CLAUDE.md (if any), the repo, and nothing else —
no memory of your session.

## Before adding

1. Read `docs/WORK_QUEUE.md` end to end (index + items + parking lot) and skim the
   titles in `docs/WORK_COMPLETED.md`. Do not add a duplicate; if an existing
   item covers it, **edit that item** (widen scope, add context, adjust
   priority) and note the edit in its `Added/Updated` line.
2. Verify every anchor you intend to cite — file paths, function names,
   line numbers, constant values, test counts. An execution agent will
   trust them. Quote `path:line` only for lines you have just read.
3. Decide whether it is one item or several. One item = one coherent change
   an agent can finish and verify in one round (size S ≈ under an hour of
   agent work, M ≈ a session, L ≈ needs `orchestrated-feature` or another multi-agent procedure). Split
   anything larger; link the parts with `Depends on`.

## Item format

Copy this template exactly. Every heading stays, even when the answer is a
single word.

```markdown
### WQ-NNN — <imperative title, under 80 chars>

- **Status:** queued · **Priority:** P0..P3 · **Size:** S | M | L · **Track:** <track> · **Env:** any | owner-machine | <platform> | browser
- **Added:** YYYY-MM-DD by <session title or role> · (**Updated:** YYYY-MM-DD by …, when edited)
- **Depends on:** WQ-… or — · **Blocks:** WQ-… or —

**Context.** Why this exists: the observed problem or gap, with the evidence
(what was measured, where it was seen, which commit). The agent should not
have to rediscover the motivation.

**Owner decision needed.** (only when Status is `blocked:user`) The exact
question, the candidate answers, and what each implies.

**Scope.** Bullet list of what to do, with verified anchors. If the item
*rewrites* (rather than appends to) a hub file every item touches —
`.gitignore`, `CHANGELOG.md`, `CLAUDE.md`, `README.md` — say so: it decides
whether the item can run in parallel with others. End with an explicit
"Out of scope:" line — what the agent must NOT touch, and which other item
owns it.

**Acceptance.** Observable conditions that make the item done. Tests that
must pass, commands whose output must match, states that must exist. When
some lines need `Env: owner-machine` (a folder, binary or platform only the
owner has), split them: *agent-verifiable* lines first, then an
*Owner-verifiable* sub-list — when the first half lands, the orchestrator
records it in an `Updated` line and returns the item `blocked:owner-machine`
for the second; the item is archived only once both halves hold.

**Verification.** How the executor proves acceptance (commands, skills to
run, if the repo has any), and what to record in the completion
entry.

---
```

Every item ends with a line containing only `---` followed by a blank line.
`scripts/wq.py` finds an item's end by that line: without it, archiving the
item cuts the next one too.

Optional extra headings when useful: **Risk.** (destructive or
hard-to-reverse steps), **Notes.** (links, prior attempts, measured dead
ends — cite the repo's recorded lesson, e.g. a CLAUDE.md entry, rather than
repeating it).

## Field rules

- **ID**: run `python scripts/wq.py next` (it fetches and scans every local
  and remote branch) and take the `next WQ-NNN` it prints; then set `next_id`
  to one above it. Never take `next_id` from your own copy of the file: side
  branches add items before they merge, and `next_id` on any one branch
  lags them. IDs are never reused, even for closed-wontdo items. When the
  repo keeps numbered companion logs (by default `docs/DECISIONS.md` `D-`,
  `docs/OPEN_QUESTIONS.md` `Q`, `docs/IDEAS.md` `I-`; the list is `NUMBERED` in
  `scripts/wq.py`), the same command prints their next free numbers too —
  use those for the rows an item adds there, for the same reason.
- **Priority**: P0 = must ship before the next milestone can even start;
  P1 = required for the milestone; P2 = wanted, not gating; P3 = nice to
  have. Do not inflate — an all-P0 queue schedules nothing.
- **Size**: S / M / L as defined above. L code items run through
  `orchestrated-feature` by default; name a different skill or procedure
  only when one fits better.
- **Track**: one word grouping items that ship together (`hygiene`,
  `packaging`, `docs`, `backend`, `ui`, …). Add a new track name if none
  fits; mention it in the "Tracks:" line under the index.
- **Env**: what the executing session must have. `any` (a clean clone
  suffices), `owner-machine` (gitignored data, credentials or hardware only
  the owner has), a platform name (`windows`, `macos`, …) when the work must
  be run there, `browser` when a GUI must be driven. The orchestrator
  matches it against what its session can actually run; an item that
  silently assumes the owner's machine gets half-done and mislabelled.
- **Status**: `queued` for new items. `blocked:user` when only the owner
  can unblock it — then the item MUST carry an "Owner decision needed"
  block phrased so the owner can answer in one line. `blocked:owner-machine`
  when the remaining work is an action (not a decision) that only the
  owner's machine can perform — then Scope says exactly what to run.
  `blocked:<WQ-id>` is redundant with `Depends on`; use `Depends on`
  instead.
- **Depends on / Blocks**: keep both directions consistent. When you add
  a dependency, edit the other item's `Blocks` line too.

## Then

1. Add the item's row to the **Index** table in priority order, then
   dependency order within a priority.
2. Update `updated:` in the YAML block.
3. If the item came from a completed item's follow-up, cross-reference:
   the completion entry's "Follow-ups" names the new ID, and the new item's
   Context names the completed one.
4. Run `python scripts/wq.py check` (`--allow-claimed` while a round is
   open), then commit `docs/WORK_QUEUE.md` on its own
   (message `queue: add WQ-NNN <title>`), so orchestration rounds can diff
   the queue cleanly. Do not bundle queue edits into feature commits.

## Numbering across branches

The queue is meant to be fed from exploratory side sessions that experiment
on their own branches and only then write the final brief. Every one of
those branches holds its own copy of the numbered files, so a number is
free only if **no branch** uses it. Before assigning any `WQ-` number, or a
number in one of the companion logs `scripts/wq.py` tracks:

1. `python scripts/wq.py next` — fetches, scans every ref, prints the next
   free number of each kind and which branch holds the current highest.
2. Use those numbers, and set `next_id` one above the `WQ` it printed.
3. `python scripts/wq.py check` (part of step 4 above) fails when
   `next_id` is not above every `WQ` id on every branch, so a stale number
   is caught before the `queue:` commit. `--no-branches` is for a clone
   without git access; do not use it to silence the failure.

If a collision has already happened (two branches, one number): the
branch that is not yet merged renumbers — item, index row, decision rows
and every cross-reference — and records the renumbering in the item's
`Updated` line. Numbers skipped by a renumbering stay unused.

## Parking lot

An idea that is not yet actionable (no anchors, no acceptance, or waiting
on evidence) goes under "Parking lot" as one bullet with enough words to
find it again. Promote it to an item only once it can carry the full
template honestly.

## What not to do

- Do not remove or reorder someone else's item without a reason written in
  its `Updated` line.
- Do not mark an item done here — that is `work-queue-run`'s job, and it
  moves the item to `docs/WORK_COMPLETED.md`.
- Do not write scope as "investigate X". If investigation is the work,
  the acceptance is the artifact it produces (a doc, a measured number, a
  set of new queue items) — say which.
- Do not paste large code or long transcripts into an item; cite the
  path and describe the change.
