#!/usr/bin/env bash
# Thin wrapper kept for callers: the build moved to the vscode-qa recipe in speckit-sandboxes (recipes/vscode-qa/setup.sh), run here against this checkout.
# Usage: setup-sandbox.sh <sandbox-dir>      (the folder must be new or empty)
set -euo pipefail

SANDBOX="${1:?usage: setup-sandbox.sh <sandbox-dir>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
. "$REPO/.claude/sandboxes-env.sh"

COMPANION_DIR="$REPO" "$SANDBOXES_REPO/recipes/vscode-qa/setup.sh" "$SANDBOX" --dev
"$HERE/verify-companion-skills.sh" "$SANDBOX" || { echo "[setup] Companion install is broken"; exit 1; }
echo "[setup] sandbox ready at $SANDBOX (main @ $(git -C "$SANDBOX" rev-parse --short HEAD))"
