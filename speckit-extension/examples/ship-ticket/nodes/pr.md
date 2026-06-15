---
id: pr
kind: control
---
## Ship · open the PR

1. Resolve the issue number from the branch's `NNN-slug` (or ask). `gh issue view <N>` for the title/body and to confirm it's still open.
2. Build the PR with `/create-pr` conventions (reads `.claude/pr-profile.md`): a conventional-commit title `type(scope): summary`, a body with `Closes #N`, a summary, technical notes, and a how-to-verify list.
3. Push and open:
   ```bash
   git push -u origin "$(git branch --show-current)"
   gh pr create --title "<title>" --body "<body>" --base main
   ```
   Capture the PR number/URL.
4. Journal progress:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_dir> --step implement --status implemented --substep ship-pr --kind complete --by ai
   ```
