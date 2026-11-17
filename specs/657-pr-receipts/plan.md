# Implementation Plan: The pull request carries the receipts

**Spec**: [spec.md](./spec.md) · **Source**: #963 (r1)

## Summary

A new read-only `receipts.py` reads the run record with `read_ctx` (no lock) and prints a `## Receipts` Markdown section: a Check | Command | Result table for every `verified[]` entry (exit code and seconds for run checks, "claimed by the agent, not run" for reported ones, "out of date" with the commit when files changed since the check's snapshot), then the review depth with any raise, then each assumed requirement. Staleness is computed the way the viewer does it: snapshot now with `capture._code_at` and `git diff-tree` against each check's tree, outside `specs/` and `.specify/`. Implement's record node tells the agent to paste the output into the PR body unedited; this repository's PR hook says the same. The Overview docs page explains the request quote, decision authors, Assumed, Weak, stale checks, review depth and the receipts.

## Project Structure

```
apps/speckit-extension/scripts/receipts.py            new, read-only
apps/speckit-extension/scripts/package-manifest.py    RUNTIME_SCRIPTS, VSIX_ROOTS
.vscodeignore                                         ! rule for receipts.py
apps/speckit-extension/nodes/implement/record-verified.md   paste the receipts into the PR
apps/speckit-extension/commands/speckit.companion.implement.md   rebuilt
apps/speckit-extension/tests/test_receipts.py         new
.specify/companion.yml                                PR hook includes the receipts
apps/website/src/content/docs/docs/results/the-overview.mdx   every #963 addition and the receipts
```

**Structure Decision**: the receipts are derived text, never typed: the script owns the wording, the agent only pastes it.

## Constitution Check

| Principle | Assessment |
|---|---|
| A new capture script goes on two packing lists | PASS. RUNTIME_SCRIPTS and a `!` rule, plus VSIX_ROOTS since a node names it. |
| Repository text reaches readers as text | PASS. Cells escape `|`, backticks and line breaks. |
| One fact, one owner | PASS. The Overview page explains the regions; the changelog keeps one line per deliverable. |

## Key Decisions

- **A separate read-only script**, not a write-context flag: the writer takes the lock; receipts only read.
- **Stale computed at print time**, so the PR reflects the code being merged.
