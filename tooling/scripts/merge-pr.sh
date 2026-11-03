#!/usr/bin/env bash
# Squash-merges a pull request once every check has passed. A pull request that changes what a person sees is refused until the owner has looked.
# usage: tooling/scripts/merge-pr.sh <PR> [--seen]
#   --seen   the owner has looked at this change and said so in the conversation. Never pass it on your own judgement.
# exit: 0 merged, 1 a check did not pass or none appeared within five minutes, 2 bad usage, 3 visual change not yet seen
set -euo pipefail

VISUAL='^(apps/website/src/(pages|components|layouts|styles)/|apps/vscode/webview/src/.*\.tsx$|apps/vscode/webview/.*\.css$|apps/vscode/src/features/.*(Pane|PaneProvider|Explorer|Provider)\.ts$|apps/copilot-canvas/public/|content/media/|docs/screenshots/|assets/)'

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

# Wait here and merge only when every check has passed: auto-merge waits for required checks only, and the test job is not one.
# Just after a push GitHub reports no checks at all, and an empty list must not read as all passed.
for _ in $(seq 1 20); do
  [ -n "$(gh pr checks "$pr" 2>/dev/null)" ] && break
  sleep 15
done
sleep 30
gh pr checks "$pr" --watch --interval 30 >/dev/null 2>&1 || true
checks="$(gh pr checks "$pr" 2>/dev/null || true)"
if [ -z "$checks" ] || echo "$checks" | grep -qv $'\tpass\t'; then
  echo "Not merged: #$pr has no checks yet or a check that did not pass." >&2
  echo "$checks" | grep -v $'\tpass\t' >&2 || true
  exit 1
fi
branch="$(gh pr view "$pr" --json headRefName --jq .headRefName)"
gh pr merge "$pr" --squash
git push -q origin --delete "$branch" 2>/dev/null || true
echo "#$pr merged."
