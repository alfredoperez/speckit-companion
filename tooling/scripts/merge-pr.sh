#!/usr/bin/env bash
# Queues a pull request to squash-merge once its checks pass. A pull request that changes what a person sees is refused until the owner has looked.
# usage: tooling/scripts/merge-pr.sh <PR> [--seen]
#   --seen   the owner has looked at this change and said so in the conversation. Never pass it on your own judgement.
# exit: 0 queued or merged, 1 a check did not pass, 2 bad usage, 3 visual change not yet seen
set -euo pipefail

VISUAL='^(apps/website/src/(pages|components|layouts|styles)/|apps/vscode/webview/.*\.css$|apps/copilot-canvas/public/|content/media/|docs/screenshots/|assets/)'

pr="${1:-}"
seen="${2:-}"
if [ -z "$pr" ] || { [ -n "$seen" ] && [ "$seen" != "--seen" ]; }; then
  echo "usage: tooling/scripts/merge-pr.sh <PR> [--seen]" >&2
  exit 2
fi

visual="$(gh pr diff "$pr" --name-only | grep -E "$VISUAL" || true)"
if [ -n "$visual" ] && [ -z "$seen" ]; then
  echo "Not merged: #$pr changes what a person sees, and nobody has said they looked." >&2
  echo "$visual" | sed 's/^/  /' >&2
  echo "Show the owner the change (a note with screenshots), and re-run with --seen once they approve." >&2
  exit 3
fi

if gh pr merge "$pr" --squash --auto 2>/dev/null; then
  echo "#$pr merges by itself when its checks pass."
  exit 0
fi

# Auto-merge is off for the repository: wait here, and merge only when every check has passed.
gh pr checks "$pr" --watch --interval 30 >/dev/null 2>&1 || true
if gh pr checks "$pr" | grep -qv $'\tpass\t'; then
  echo "Not merged: #$pr has a check that did not pass." >&2
  gh pr checks "$pr" | grep -v $'\tpass\t' >&2
  exit 1
fi
branch="$(gh pr view "$pr" --json headRefName --jq .headRefName)"
gh pr merge "$pr" --squash
git push -q origin --delete "$branch" 2>/dev/null || true
echo "#$pr merged."
