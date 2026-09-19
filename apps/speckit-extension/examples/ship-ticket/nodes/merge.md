---
id: merge
kind: control
---
## Ship · merge

> **Never merge red checks.** If checks fail and can't be auto-addressed, leave the PR open and report. **Scratch-only** — never merge a real PR from this dogfood.

1. Wait for checks: `gh pr checks <PR> --watch || true`.
2. If every check is green, merge and clean up:
   ```bash
   gh pr merge <PR> --squash --delete-branch
   ```
   If any check is red, record "merged: NO — checks failing" and stop.
3. Journal progress:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --step implement --status implemented --substep ship-merge --kind complete --by ai
   ```
