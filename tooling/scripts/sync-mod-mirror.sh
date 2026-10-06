#!/usr/bin/env bash
# Copies the released Claude Code mod into its small mirror repo, which is what Anthropic's directory reads: this repo is over the directory's 50 MiB limit.
# usage: tooling/scripts/sync-mod-mirror.sh [--push]
# The mirror checkout is $MOD_MIRROR_DIR, else ../speckit-companion-claude-mod beside the main checkout; it is cloned when missing.
set -euo pipefail

MIRROR_REPO=alfredoperez/speckit-companion-claude-mod
common="$(git rev-parse --path-format=absolute --git-common-dir)"
main="${common%/.git}"
mirror="${MOD_MIRROR_DIR:-$(dirname "$main")/speckit-companion-claude-mod}"

[ -d "$mirror/.git" ] || gh repo clone "$MIRROR_REPO" "$mirror"
git -C "$mirror" pull -q --ff-only

find "$mirror" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
git -C "$main" archive HEAD:apps/claude-mod .claude-plugin hooks README.md CHANGELOG.md | tar -x -C "$mirror"
cp "$main/LICENSE" "$mirror/LICENSE"
printf '\n---\n\nThis repository is a release mirror. The mod is developed in [alfredoperez/speckit-companion](https://github.com/alfredoperez/speckit-companion/tree/main/apps/claude-mod); issues and pull requests go there.\n' >> "$mirror/README.md"

claude plugin validate --strict "$mirror"
version="$(node -p "require('$mirror/.claude-plugin/plugin.json').version")"
git -C "$mirror" add -A
if git -C "$mirror" diff --cached --quiet; then
  echo "Mirror already matches v$version."
  exit 0
fi
git -C "$mirror" commit -q -m "SpecKit Companion for Claude Code v$version"
if [ "${1:-}" = "--push" ]; then
  git -C "$mirror" push -q
  echo "Mirror pushed at v$version. The directory picks it up within six hours."
else
  echo "Mirror committed at v$version, not pushed. Re-run with --push to send it."
fi
