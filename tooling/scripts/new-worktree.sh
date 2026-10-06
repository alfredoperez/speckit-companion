#!/usr/bin/env bash
# Makes a worktree for one branch, cut from the current origin/main, with node_modules linked from the main checkout.
# usage: tooling/scripts/new-worktree.sh <name> <branch>
# The worktree lands at ../<repo>.worktrees/<name>. Remove the node_modules link before committing if `git status` shows it.
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
[ -d "$main/node_modules" ] && [ ! -e "$target/node_modules" ] && ln -s "$main/node_modules" "$target/node_modules"
echo "$target"
