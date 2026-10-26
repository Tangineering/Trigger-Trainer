---
name: work-queue-run
description: Orchestration-session protocol for WORK_QUEUE.md — analyze the queue, select a work round, hand each item to an execution agent with a self-contained brief, verify the result, then rotate finished items into WORK_COMPLETED.md and keep the queue holding only outstanding work. Use at the start of every orchestration round and again when a round's agents report back.
---

# Running the work queue

The orchestration session owns the lifecycle of `WORK_QUEUE.md` items from
`queued` to an entry in `WORK_COMPLETED.md`. It never edits code itself for
queue items; it plans rounds, briefs execution agents, judges their results,
and keeps the two documents truthful. Adding new items uses the
`work-queue-add` skill (this session may raise items too, for example from
a failed round). Mechanical queue edits — claiming, un-claiming, archiving,
the invariant check — go through `scripts/wq.py` (stdlib Python 3;
`python3` where `python` is absent), never through ad-hoc
regex edits (an unanchored `| WQ-005 |` once matched inside another row's
"Depends on" cell and spliced two index rows together).

## 0. Find the queue and probe the environment

1. The queue's canonical home is the repository's default branch. If
   `WORK_QUEUE.md` is absent from your branch, look for it on the newest
   branch that carries it (`git log --all --oneline -- WORK_QUEUE.md`) and
   fast-forward or merge that branch in before anything else; say so in
   the round report. A queue that lives only on a side branch is itself a
   queue item: merge it to the default branch.
2. Probe what this session can actually run and write it down for the
   briefs (the `Env` field of items is matched against it): interpreter
   and installed deps, external binaries the repo needs, a browser or GUI,
   the target platform, and any gitignored data folders that exist only on
   the owner's machine. Items whose `Env` this session cannot satisfy are
   not in the ready set; their agent-verifiable half may still be (see §4).

## 1. Analyze

1. `git pull` the working branch, then read `WORK_QUEUE.md` in full and the
   most recent five entries of `WORK_COMPLETED.md` (the "Deviations" and
   "Follow-ups" fields are where the last round's lessons live).
2. Sanity-check the queue before scheduling — run `python scripts/wq.py
   check` first, then by eye:
   - Every item's `Depends on` targets exist and are either in the queue or
     in the archive. A dependency that is archived is satisfied.
   - `blocked:user` items: has the owner answered (in this session's prompt,
     in a commit, in the item's `Updated` line)? If yes, rewrite the item's
     status to `queued`, fold the decision into its Scope, and remove the
     "Owner decision needed" block. If no, list the open questions at the
     end of the round report — each one in a single line the owner can
     answer with a single line.
   - `blocked:owner-machine` items stay where they are unless this session
     *is* on the owner's machine; the round report repeats what to run.
   - Items whose anchors have rotted (a cited file or function no longer
     exists) get an `Updated` line and corrected anchors before they are
     scheduled, or are sent back to the parking lot.
3. Build the ready set: `queued` items whose dependencies are all archived
   (or in this same round and can be ordered ahead — see below) and whose
   `Env` this session satisfies.

## 2. Select a round

- A round is the set of items one batch of execution agents works in
  parallel plus the sequential tail forced by intra-round dependencies.
  Keep it small enough to review honestly: three to five items, at most one
  size-L.
- Pick by priority first, then by unblocking value (an item that many
  others depend on beats an equal-priority leaf), then by track (items in
  one track tend to touch the same files — schedule them sequentially, not
  in parallel, to avoid merge conflicts).
- **Hub files.** Name the files nearly every item touches — typically
  `.gitignore`, `CHANGELOG.md`, the repo's `CLAUDE.md`, `README.md`. The
  rule for parallel items: hub-file edits are **append-only, in a block
  headed by the item id**, and the orchestrator resolves hub-file conflicts
  by keeping both sides. An item whose Scope says it *rewrites* a hub
  section runs alone in its round, or last in the sequential tail.
  Outside the hub files, two items that edit the same file never run in
  parallel; when unsure, read each item's Scope anchors and compare.
- Claim: `python scripts/wq.py claim round-<YYYYMMDD>-<n> WQ-… WQ-…`,
  then `python scripts/wq.py check --allow-claimed` (plain `check` fails
  on purpose while claimed rows exist), commit `WORK_QUEUE.md`
  (`queue: claim round …`), and push. Another
  session reading the queue must see the claim. Adding an item to a
  running round is fine — claim it the same way in its own commit.

## 3. Hand off

For each item:

1. Create the agent's worktree yourself, from the orchestration branch's
   HEAD: `git worktree add .claude/worktrees/wq-NNN -b wq-NNN HEAD`. Do
   **not** rely on an agent tool's own worktree isolation — it branches
   from the repository's default branch, not from your HEAD, so the agent
   never sees the rounds already merged and re-creates their work. Add
   `.claude/worktrees/` to `$(git rev-parse --git-common-dir)/info/exclude`
   (not `.gitignore`; the common dir, because `.git` is a file when this
   session itself runs in a worktree) so the untracked directory does not
   trip a stop hook. A new worktree has none of the repo's gitignored
   dependencies (`node_modules`, a venv): install them there, or state in
   the brief's Environment paragraph exactly how the agent must.
2. Spawn an execution agent — model per `MODELS.md` (beside this skill:
   Opus for anything that edits product code, Sonnet only for a mechanical
   docs/tooling S item, never Haiku for an edit) — whose brief is, in this
   order:
   - The item's full text, verbatim, from `### WQ-NNN` to the next `---`.
   - `BRIEF_RULES.md` (beside this skill) with its `<…>` placeholders
     filled in: the worktree path and branch, the file ownership from §2
     (which files this item owns, which the parallel items own by id, the
     hub-file append-only rule), and the environment from §0. It already
     carries the worktree rules and the report contract — do not restate
     them, or the two copies drift.
   - The agent's closing report block (defined in `BRIEF_RULES.md`) maps
     onto the entry's Outcome, Commits, What was done, Deviations,
     Verification and Follow-ups fields; the orchestrator adds Closed,
     Executed by (role and model), Round, and Why (from the item's
     Context). The entry's extra outcomes `closed-wontdo` /
     `superseded-by` are the orchestrator's, never an agent's.
3. Size L: in the product code, run the `orchestrated-feature` skill (or
   the procedure the item's Size line names, if different) with the item
   text as the spec; it runs in this session, since agents cannot spawn
   agents, and its stages carry their models (Opus implementer, independent
   Sonnet test writer, parallel Opus invariants-lens + Sonnet
   correctness-lens reviewers, fixes routed back to the original agents,
   then your own final review — the `MODELS.md` rows). In packaging, docs
   or tooling, run **one implementer plus a separate reviewer agent** (both
   Opus) whose brief is the item's Acceptance list and "find what would
   fail on the target platform"; the reviewer never edits. An empirical
   build or run on whatever platform this session has beats a second
   reviewer.

Do not paraphrase the item into the brief. Paraphrase loses the anchors
and the out-of-scope line, which are the two things that keep agents from
wandering. Agents cannot spawn agents and cannot ask questions: the brief
must carry every environment fact they need.

## 4. Judge the result

When an agent reports:

- Merge its branch into the orchestration branch (`git merge wq-NNN`),
  resolve hub-file conflicts by keeping both sides, then `git worktree
  remove` + `git branch -D`. Read the merged diff (`git diff
  <base>..<head> --stat`, then the files that matter). Check the
  acceptance criteria one by one against evidence in the report or the
  diff, not against the agent's summary sentence.
- Re-run the verification commands yourself when they are cheap (unit tests
  always; slower regression checks when the report claims them). A claim of
  "tests pass" without a count is not verification. A check that reports
  SKIPPED is not a pass — say so in the entry.
- Outcomes:
  - **done / done-with-deviations** → archive (section 5). Deviations that
    dropped scope become new queue items via `work-queue-add` if still
    wanted; say so in the entry's Follow-ups.
  - **done for the agent-verifiable half, owner-verifiable half remaining**
    (an `Env: owner-machine` acceptance line) → keep the item's ID: `python
    scripts/wq.py unclaim WQ-NNN --status blocked:owner-machine`, add an
    `Updated` line saying exactly what landed (commits) and exactly what
    the owner still has to run. Do not split it into a new item unless the
    remaining half is genuinely different work.
  - **blocked** → `unclaim` to `queued` or `blocked:<reason>`, append an
    `Updated` line with what was learned, and add the blocker as its own
    item if it is work.
  - **failed** → same as blocked, plus record the failure in the item's
    Notes (what was tried, what broke) so the next agent does not repeat it.
    Never leave an item `claimed` after a round ends.
- A one-line follow-through the agent could not do (a line in a file
  another item owned, a missing ignore pattern) is the orchestrator's to
  apply and commit under the item's id — it is not a new item.

## 5. Archive

For each finished item:

1. Write the `WORK_COMPLETED.md` entry in a scratch file using that file's
   template, filled from the agent's report and your own verification.
   Preserve the item's ID and title; the "Deviations" field is mandatory
   and "None" must be earned.
2. `python scripts/wq.py archive WQ-NNN --entry <scratch file>` — it cuts
   the item's section, drops its index row, prepends the entry (newest
   first) and bumps `updated:`.
3. Walk every remaining item whose `Depends on` named the archived ID and
   remove it from `Depends on`/`Blocks` lines — the dependency is now
   satisfied, and the index row's "Depends on" cell must agree.
4. `python scripts/wq.py check`, then commit both files together:
   `queue: archive WQ-NNN, WQ-MMM (round …)`. Push.
5. In each completion entry, say whether the item is on `release` yet (`git branch -r --contains <commit>`), i.e. whether
   it has reached the phones; the public page follows `release`, not `main` (D-131).

## 6. Round report

End the round with a short report to the owner: items archived (ID +
outcome, and which model ran each agent — see `MODELS.md` rule 5), items
returned to the queue and why, new items raised, open
`blocked:user` questions (one line each), what `blocked:owner-machine`
items need run, and the ready set for the next round. If a round untracked
files (`git rm --cached`), warn that a `git pull` on another clone deletes
the working copies and say how to keep them. Keep it under a screen; the
documents hold the detail.

## Invariants (check before ending any round)

`python scripts/wq.py check` enforces these; run it before every `queue:`
commit — with `--allow-claimed` while a round is open, plain before the
round ends (so a surviving `claimed:` row fails):

- `WORK_QUEUE.md` contains only outstanding work: no `claimed:` status
  survives the round, no item has an archived twin.
- Every ID appears in exactly one of the two files.
- `next_id` is greater than every ID in either file, on every local and
  remote branch (`check` fetches and scans them; `--no-branches` only where
  git is unavailable). `python scripts/wq.py next` prints the free numbers.
- Each `WORK_COMPLETED.md` entry has all eight fields (Closed, Executed
  by, Commits / PR, What was done, Why, Deviations, Verification,
  Follow-ups).
- The index table matches the item sections (same IDs, same statuses).
- Every `Depends on` target exists in one of the two files.

## Tools this session may lean on

- `orchestrated-feature` for size-L code items (its `PROJECT.md` holds
  this repo's checks and invariants), and the repo's own skills for
  implementation, verification and closure — list them in the brief when
  an item names one.
- `MODELS.md` (installed beside this skill) for which model each dispatched
  role runs on, in this skill and in `orchestrated-feature` alike; a repo's
  overrides live in `orchestrated-feature/PROJECT.md`.
- Parallel `Agent` calls for independent items in one round; sequential
  handoff for items sharing files.
- A scheduled wake-up (the harness's scheduling tool, if it has one) to start the next round
  when agents run long, rather than polling. When the harness notifies on
  agent completion, no wake-up is needed.
