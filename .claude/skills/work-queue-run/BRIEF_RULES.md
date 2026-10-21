## Standing rules (apply to every item)

<!-- The orchestrator appends this to every execution-agent brief, after the
     item's verbatim text. Fill in the two <…> paragraphs per session; leave
     the rest as it is. -->

- You are an execution agent for one WORK_QUEUE.md item. The item text above
  is your entire brief; do not widen it. Read the repo's CLAUDE.md first and
  obey its conventions and guards.
- **Where to work.** Work ONLY inside the worktree `<path>` (branch `wq-NNN`,
  a checkout of `<orchestration branch>` at its current HEAD — it already
  contains everything archived in WORK_COMPLETED.md). `cd` there first.
  Commit there with messages prefixed `WQ-NNN:`. Do NOT push. Do NOT edit
  WORK_QUEUE.md or WORK_COMPLETED.md (the orchestrator archives). Do not run
  `git checkout`, `git worktree`, `git rebase` or anything that changes
  which commit the worktree is on.
- **Files you own this round:** `<list>`. Parallel items own: `<WQ-id:
  files>`. Hub files (`.gitignore`, `CHANGELOG.md`, `CLAUDE.md`, `README.md`)
  are append-only for you: add a block headed by your item id; never rewrite
  another block. Anything you need changed in a file you do not own goes in
  your report, not in the file.
- **Environment.** `<what exists here: interpreter + deps, external binaries
  and their paths, browser/GUI or none, target platform, which gitignored
  data folders are absent>`. Do not rely on any of it in unit tests.
- Before reporting, run the repo's fast checks (tests, lint, typecheck —
  whatever a contributor runs locally) and quote the counts verbatim. If a
  slower regression check applies to your change, run what you can and say
  plainly what you could not run and why; a SKIPPED check is not a pass. If
  behavior changed, do the repo's documentation pass (its ship-docs
  procedure, or the CLAUDE.md/CHANGELOG conventions it names).
- Verify every anchor before relying on it (file paths, function names, line
  numbers in the item may have drifted).
- Work autonomously: no questions. Where a decision is only the owner's,
  make the safest choice, state it under Deviations, and propose a follow-up
  item. Where part of the Acceptance can only be met on the owner's machine,
  ship the mechanism, verify what you can here, and say exactly what the
  owner must run.
- End your reply with EXACTLY this block, filled in:

```
Outcome: done | done-with-deviations | blocked | failed
Commits: <hashes + one-line subjects, on branch wq-NNN>
What was done: <2–6 sentences naming files/functions>
Deviations: <what differs from the item and why; "None" only if truly none>
Verification: <commands run and results, verbatim counts; what was NOT run>
Follow-ups: <proposed new queue items, each with a one-line context; or "none">
```
