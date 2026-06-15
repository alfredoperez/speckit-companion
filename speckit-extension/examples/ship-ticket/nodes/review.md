---
id: review
kind: control
---
## Ship · code review

> **Scratch-only.** This whole ship tail must run against a throwaway branch/spec, never a real one.

1. Confirm you're on a feature branch (not `main`) with the work committed: `git branch --show-current`, `git status --porcelain`.
2. Verify it builds before reviewing: `npm run compile && npm test`; if `speckit-extension/**` changed, also `python3 speckit-extension/scripts/check-shape-parity.py`. If anything is red, stop and report — don't ship a broken branch.
3. Run `/code-review` on the branch diff vs `main` at **high** effort and apply findings (`--fix`). Read `.claude/review-checklist.md` first. Commit fixes; re-run `npm test` if code changed.
4. Journal progress (feature dir from `.specify/feature.json`):
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --step implement --status implemented --substep ship-review --kind complete --by ai
   ```
