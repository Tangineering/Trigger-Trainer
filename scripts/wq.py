#!/usr/bin/env python3
"""wq.py - mechanical edits and invariant checks for WORK_QUEUE.md / WORK_COMPLETED.md.

Stdlib only. Run from anywhere; --root points at the folder holding the two
documents (default: the current directory, then its parents).

    python scripts/wq.py check                     # the invariants; exit 1 on any failure
    python scripts/wq.py claim round-20260921-1 WQ-001 WQ-004
    python scripts/wq.py unclaim WQ-004 [--status queued|blocked:<what>]
    python scripts/wq.py archive WQ-001 --entry entry.md   # cut the item, drop its
                                                            # index row, prepend the entry
    python scripts/wq.py archive WQ-001 --print            # just print the item's section
    python scripts/wq.py next                              # next free WQ / D / Q / I numbers across
                                                            # every branch (fetches first)

Why this exists: hand-edited regexes against the index table are how an
orchestration session spliced two rows together (an unanchored `| WQ-005 |`
matched inside another row's "Depends on" cell). Every edit here is
anchored to a line start, and `check` is what `work-queue-run` tells the
orchestrator to run before every `queue:` commit.

Numbers are assigned across branches, not per branch: exploratory side
sessions add items and decisions on their own branches before anything is
merged, and two of them picking "next_id" from their own copy of the file
collided more than once (WQ-030 and D-111/D-112 were each taken twice on
2026-10-25). `next` scans every local and remote ref for the four numbered
files, and `check` fails when `next_id` is not above every WQ id found on any
branch (`--no-branches` skips the scan, e.g. without git).

The script edits ONLY the mechanical parts (status cells, index rows,
section cut/paste, `updated:`). Writing an item or a completion entry is
still a human/model job - it never invents text.
"""
import argparse
import datetime as _dt
import os
import re
import sys

QUEUE = "WORK_QUEUE.md"
DONE = "WORK_COMPLETED.md"
ENTRY_FIELDS = ("**Closed:**", "**Executed by:**", "**Commits / PR:**",
                "**What was done.**", "**Why.**", "**Deviations.**",
                "**Verification.**", "**Follow-ups.**")


def _find_root(start):
    d = os.path.abspath(start)
    while True:
        if os.path.isfile(os.path.join(d, QUEUE)):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            sys.exit(f"no {QUEUE} found from {start} upward")
        d = parent


def _read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def _write(p, s):
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(s)


def _ids_index(q):
    return re.findall(r"^\| (WQ-\d+) \|", q, re.M)


def _ids_sections(text):
    return re.findall(r"^### (WQ-\d+) ", text, re.M)


def _section(q, wq):
    m = re.search(rf"^### {wq} .*?\n---\n\n", q, re.S | re.M)
    return m


def _index_row(q, wq):
    return re.search(rf"^\| {wq} \|[^\n]*\n", q, re.M)


def _set_status(q, wq, status):
    row = _index_row(q, wq)
    sec = _section(q, wq)
    if not row or not sec:
        sys.exit(f"{wq}: index row or section missing")
    cells = row.group(0).split(" | ")
    # cells: ['| WQ-NNN', title, pri, size, status, depends, 'track |\n']
    if len(cells) != 7:
        sys.exit(f"{wq}: index row does not have 7 cells: {row.group(0)!r}")
    cells[4] = status
    new_row = " | ".join(cells)
    q = q[:row.start()] + new_row + q[row.end():]
    sec = _section(q, wq)
    body = re.sub(r"(- \*\*Status:\*\* )[^·\n]*", rf"\g<1>{status} ", sec.group(0), count=1)
    return q[:sec.start()] + body + q[sec.end():]


def _bump_updated(q):
    today = _dt.date.today().isoformat()
    return re.sub(r"^updated: .*$", f"updated: {today}", q, count=1, flags=re.M)


# Numbered records: file -> (label, regex for a record's number at a line start)
NUMBERED = {
    QUEUE: ("WQ", r"^### WQ-(\d+) "),
    DONE: ("WQ", r"^### WQ-(\d+) "),
    "docs/DECISIONS.md": ("D", r"^\| D-(\d+) \|"),
    "OPEN_QUESTIONS.md": ("Q", r"^\| Q-?(\d+) \|"),
    "docs/IDEAS.md": ("I", r"^\| I-(\d+) \|"),
}


def _git(root, *a):
    import subprocess
    r = subprocess.run(["git", "-C", root, *a], capture_output=True, text=True)
    return r.returncode, r.stdout


def _scan_branches(root, fetch=True):
    """{label: (max_number, ref)} over every local and remote ref plus the working tree.
    Returns None when git is unavailable (not a repo, no git binary)."""
    try:
        if fetch:
            _git(root, "fetch", "--quiet", "--all")
        rc, out = _git(root, "for-each-ref", "--format=%(refname:short)", "refs/heads", "refs/remotes")
    except OSError:
        return None
    if rc:
        return None
    refs = [r for r in out.split() if not r.endswith("/HEAD")]
    top = {}
    def note(label, n, ref):
        if n > top.get(label, (0, ""))[0]:
            top[label] = (n, ref)
    for ref in refs:
        for rel, (label, rx) in NUMBERED.items():
            rc, text = _git(root, "show", f"{ref}:{rel}")
            if rc:
                continue
            for m in re.finditer(rx, text, re.M):
                note(label, int(m.group(1)), ref)
    for rel, (label, rx) in NUMBERED.items():
        p = os.path.join(root, rel)
        if os.path.isfile(p):
            for m in re.finditer(rx, _read(p), re.M):
                note(label, int(m.group(1)), "working tree")
    return top


def cmd_next(root, args):
    top = _scan_branches(root, fetch=not args.no_fetch)
    if top is None:
        print("FAIL: git unavailable; cannot scan branches")
        return 1
    for label in ("WQ", "D", "Q", "I"):
        n, ref = top.get(label, (0, "nowhere"))
        sep = "" if label == "Q" else "-"
        width = 3 if label == "WQ" else 2
        print(f"next {label}{sep}{n + 1:0{width}d}   (highest {label}{sep}{n:0{width}d} on {ref})")
    return 0


def cmd_check(root, args):
    q = _read(os.path.join(root, QUEUE))
    c = _read(os.path.join(root, DONE)) if os.path.isfile(os.path.join(root, DONE)) else ""
    errors = []
    qi = _ids_index(q)
    qs = _ids_sections(q)
    cs = _ids_sections(c)
    if len(qi) != len(set(qi)):
        errors.append("duplicate index rows: " + ", ".join(sorted({x for x in qi if qi.count(x) > 1})))
    if set(qi) != set(qs):
        errors.append(f"index/section mismatch: index-only {sorted(set(qi) - set(qs))}, section-only {sorted(set(qs) - set(qi))}")
    both = set(qi) & set(cs)
    if both:
        errors.append(f"in both files: {sorted(both)}")
    m = re.search(r"^next_id: WQ-(\d+)", q, re.M)
    if not m:
        errors.append("no next_id in the YAML block")
    else:
        nxt = int(m.group(1))
        top = max([int(x[3:]) for x in set(qi) | set(qs) | set(cs)] or [0])
        if nxt <= top:
            errors.append(f"next_id WQ-{nxt:03d} is not greater than the highest id WQ-{top:03d}")
        if not args.no_branches:
            top_b = _scan_branches(root, fetch=not args.no_fetch)
            if top_b is None:
                print("WARN: git unavailable; branch scan skipped")
            elif "WQ" in top_b and nxt <= top_b["WQ"][0]:
                n, ref = top_b["WQ"]
                errors.append(f"next_id WQ-{nxt:03d} is not greater than WQ-{n:03d} found on {ref} "
                              "(numbers are assigned across all branches)")
    claimed = re.findall(r"^\| (WQ-\d+) \|[^\n]*\| claimed:", q, re.M)
    if claimed and not args.allow_claimed:
        errors.append(f"claimed items present (a round is open): {claimed}")
    # index status == section status
    for wq in set(qi) & set(qs):
        row = _index_row(q, wq).group(0).split(" | ")[4]
        sec = _section(q, wq)
        st = re.search(r"- \*\*Status:\*\* ([^·\n]*)", sec.group(0)) if sec else None
        if not sec:
            errors.append(f"{wq}: section has no trailing '---' line")
        elif len(re.findall(r"^### WQ-\d+ ", sec.group(0), re.M)) > 1:
            errors.append(f"{wq}: section swallows the next item - a '---' line is missing before it")
        elif st and st.group(1).strip() != row.strip():
            errors.append(f"{wq}: index status {row.strip()!r} != section status {st.group(1).strip()!r}")
    # Depends on targets exist
    known = set(qi) | set(cs)
    for wq in qs:
        sec = _section(q, wq)
        if not sec:
            continue
        dep = re.search(r"- \*\*Depends on:\*\* ([^\n]*?) · \*\*Blocks:", sec.group(0))
        if dep:
            for t in re.findall(r"WQ-\d+", dep.group(1)):
                if t not in known:
                    errors.append(f"{wq}: depends on unknown {t}")
    # completed entries carry every field
    for wq in cs:
        m2 = re.search(rf"^### {wq} .*?(?=^### |\Z)", c, re.S | re.M)
        body = m2.group(0) if m2 else ""
        missing = [f for f in ENTRY_FIELDS if f not in body]
        if missing:
            errors.append(f"{wq} (completed): missing {missing}")
    if errors:
        for e in errors:
            print("FAIL:", e)
        return 1
    print(f"OK: {len(qi)} queued item(s), {len(cs)} archived, next_id WQ-{nxt:03d}")
    return 0


def cmd_claim(root, args):
    p = os.path.join(root, QUEUE)
    q = _read(p)
    for wq in args.ids:
        q = _set_status(q, wq, f"claimed:{args.round}")
    _write(p, _bump_updated(q))
    print("claimed", ", ".join(args.ids), "for", args.round)
    return 0


def cmd_unclaim(root, args):
    p = os.path.join(root, QUEUE)
    q = _set_status(_read(p), args.id, args.status)
    _write(p, _bump_updated(q))
    print(args.id, "->", args.status)
    return 0


def cmd_archive(root, args):
    p = os.path.join(root, QUEUE)
    q = _read(p)
    sec = _section(q, args.id)
    row = _index_row(q, args.id)
    if not sec or not row:
        sys.exit(f"{args.id}: section or index row missing")
    if args.print:
        sys.stdout.write(sec.group(0))
        return 0
    if not args.entry:
        sys.exit("archive needs --entry <file with the WORK_COMPLETED entry> or --print")
    entry = _read(args.entry).rstrip("\n") + "\n\n---\n\n"
    missing = [f for f in ENTRY_FIELDS if f not in entry]
    if missing:
        sys.exit(f"entry is missing fields: {missing}")
    if not entry.startswith(f"### {args.id} "):
        sys.exit(f"entry must start with '### {args.id} '")
    q = q[:sec.start()] + q[sec.end():]
    row = _index_row(q, args.id)
    q = q[:row.start()] + q[row.end():]
    _write(p, _bump_updated(q))
    dp = os.path.join(root, DONE)
    c = _read(dp)
    marker = "## Entries\n\n"
    if marker not in c:
        sys.exit(f"{DONE} has no '## Entries' heading")
    c = c.replace("_(none yet)_\n", "", 1)
    c = c.replace(marker, marker + entry, 1)
    _write(dp, c)
    print("archived", args.id, "- remember: remove it from other items' Depends on / Blocks lines, then run check")
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--root", default=None, help="folder holding WORK_QUEUE.md (default: search upward)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("check"); s.add_argument("--allow-claimed", action="store_true",
                                                 help="do not fail on claimed: rows (mid-round)")
    s.add_argument("--no-branches", action="store_true", help="skip the cross-branch next_id check")
    s.add_argument("--no-fetch", action="store_true", help="scan branches without fetching first")
    s = sub.add_parser("next"); s.add_argument("--no-fetch", action="store_true",
                                               help="scan branches without fetching first")
    s = sub.add_parser("claim"); s.add_argument("round"); s.add_argument("ids", nargs="+")
    s = sub.add_parser("unclaim"); s.add_argument("id"); s.add_argument("--status", default="queued")
    s = sub.add_parser("archive"); s.add_argument("id"); s.add_argument("--entry"); s.add_argument("--print", action="store_true")
    args = ap.parse_args(argv)
    root = _find_root(args.root or os.getcwd())
    return {"check": cmd_check, "claim": cmd_claim, "unclaim": cmd_unclaim, "archive": cmd_archive, "next": cmd_next}[args.cmd](root, args)


if __name__ == "__main__":
    sys.exit(main())
