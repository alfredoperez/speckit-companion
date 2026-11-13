#!/usr/bin/env bash
# Makes a worktree for one branch, cut from the current origin/main, with its own node_modules and Companion installed.
# usage: tooling/scripts/new-worktree.sh <name> <branch>
# The worktree lands at ../<repo>.worktrees/<name>. A linked node_modules would resolve the viewer workspace into the main checkout and break the webview build, so it runs npm ci.
set -euo pipefail

if [ "$#" -ne 2 ] || [[ "$1" == *[[:space:]/]* ]] || [[ "$2" == *[[:space:]]* ]]; then
  echo "usage: tooling/scripts/new-worktree.sh <name> <branch>   (one word each)" >&2
  exit 2
fi
name="$1"
branch="$2"

common="$(git rev-parse --path-format=absolute --git-common-dir)"
main="${common%/.git}"
target="$(dirname "$main")/$(basename "$main").worktrees/$name"

git -C "$main" fetch -q origin main
git -C "$main" worktree add -q "$target" -b "$branch" refs/remotes/origin/main
(cd "$target" && npm ci --no-audit --no-fund >&2)
if command -v specify >/dev/null 2>&1; then
  # The dev install rewrites two tracked registry files; put them back so they never reach a commit.
  (cd "$target" && specify extension add --dev apps/speckit-extension --force >&2 \
    && git checkout -- .specify/extensions.yml .specify/extensions/.registry)
else
  echo "specify is not installed: run 'specify extension add --dev apps/speckit-extension --force' in the worktree before a speckit-companion command." >&2
fi
echo "$target"
