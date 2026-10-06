#!/usr/bin/env bash
# canvas-checks.sh <workspace-dir> <results-dir>
# Runs the headless canvas checks against the real Copilot runtime. The agent writes specs into the workspace, so pass a COPY of a sandbox.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../../.." && pwd)"
APP="${COPILOT_APP:-/Applications/GitHub Copilot.app}"

die() { echo "canvas-checks: $*" >&2; exit 2; }

[ $# -eq 2 ] || die "usage: canvas-checks.sh <workspace-dir> <results-dir>"
[ -d "$1" ] || die "workspace not found: $1"
WS="$(cd "$1" && pwd)"
[ "$(git -C "$WS" rev-parse --show-toplevel 2>/dev/null)" = "$WS" ] || die "$WS is not the root of a git repo; refusing to run"
[ "$WS" != "$REPO" ] || die "refusing to run against the speckit-companion checkout; pass a copy of a sandbox"
[ -z "$(git -C "$WS" status --porcelain)" ] || die "$WS has uncommitted changes; the bare-open check needs a clean tree (use a fresh copy)"
[ -d "$WS/specs" ] || die "$WS has no specs/ folder"
[ -d "$APP/Contents/Resources/copilot-sdk" ] || die "GitHub Copilot app not found at $APP (set COPILOT_APP)"
[ -f "$HOME/.copilot/extensions/speckit-companion/extension.mjs" ] || [ -f "$WS/.github/extensions/speckit-companion/extension.mjs" ] \
    || die "the SpecKit Companion canvas is not installed for Copilot (neither ~/.copilot/extensions/speckit-companion nor the workspace's .github/extensions)"

mkdir -p "$2"
OUT="$(cd "$2" && pwd)"

if [ ! -d "$HERE/node_modules/@github/copilot-sdk" ]; then
    (cd "$HERE" && npm install --no-audit --no-fund >/dev/null) || die "npm install failed in $HERE"
fi

echo "canvas-checks: workspace $WS"
echo "canvas-checks: results   $OUT"
node "$HERE/checks.mjs" "$WS" "$OUT"
