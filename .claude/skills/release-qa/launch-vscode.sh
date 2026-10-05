#!/usr/bin/env bash
# Open the sandbox in an isolated VS Code instance (own user-data and extensions dirs) with SpecKit Companion from this checkout.
# Usage: launch-vscode.sh <sandbox-dir> <results-dir> [vsix|dev]
#   vsix (default) packages the checkout into <results-dir> and installs it; dev runs it as an Extension Development Host.
# Env: E2E_VSCODE_STATE=<dir> uses a fresh profile (default: .e2e-vscode under the sandbox root); E2E_TRUST=1 leaves workspace trust on (Restricted Mode first-open); E2E_EXTRA_FOLDER=<dir> opens it beside the sandbox as a multi-root window.
# Theme switch while running: launch-vscode.sh theme light|dark
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
STATE="${E2E_VSCODE_STATE:-}"
if [ -z "$STATE" ]; then
  . "$REPO/.claude/sandboxes-env.sh"
  STATE="$SANDBOXES_DIR/.e2e-vscode"
fi
SETTINGS="$STATE/data/User/settings.json"

if [ "${1:-}" = "theme" ]; then
  case "${2:-}" in light) THEME="Default Light Modern";; dark) THEME="Default Dark Modern";; *) echo "[vscode] theme must be light or dark"; exit 1;; esac
  python3 - "$SETTINGS" "$THEME" <<'PY'
import json, sys
path, theme = sys.argv[1], sys.argv[2]
data = json.load(open(path))
data["workbench.colorTheme"] = theme
json.dump(data, open(path, "w"), indent=2)
PY
  echo "[vscode] theme -> $THEME"
  exit 0
fi

SANDBOX="${1:?usage: launch-vscode.sh <sandbox-dir> <results-dir> [vsix|dev]}"
RESULTS="${2:?usage: launch-vscode.sh <sandbox-dir> <results-dir> [vsix|dev]}"
MODE="${3:-vsix}"

mkdir -p "$STATE/data/User" "$STATE/ext" "$RESULTS"
cat > "$SETTINGS" <<'JSON'
{
  "speckit.aiProvider": "claude",
  "speckit.permissionMode": "auto-approve",
  "speckit.defaultWorkflow": "companion",
  "speckit.telemetry": false,
  "telemetry.telemetryLevel": "off",
  "security.workspace.trust.enabled": false,
  "workbench.startupEditor": "none",
  "workbench.tips.enabled": false,
  "window.restoreWindows": "none",
  "window.zoomLevel": 1,
  "editor.minimap.enabled": false,
  "breadcrumbs.enabled": false,
  "update.mode": "none",
  "extensions.autoUpdate": false,
  "workbench.colorTheme": "Default Dark Modern"
}
JSON

[ "${E2E_TRUST:-}" = "1" ] && sed -i '' 's/"security.workspace.trust.enabled": false/"security.workspace.trust.enabled": true/' "$SETTINGS"
FOLDERS=("$SANDBOX")
[ -n "${E2E_EXTRA_FOLDER:-}" ] && FOLDERS+=("$E2E_EXTRA_FOLDER")

CODE=(code --user-data-dir "$STATE/data" --extensions-dir "$STATE/ext")

if [ "$MODE" = "dev" ]; then
  (cd "$REPO" && npm run vscode:prepublish >/dev/null) || { echo "[vscode] build failed -> cannot launch the Extension Development Host"; exit 1; }
  "${CODE[@]}" --new-window --extensionDevelopmentPath="$REPO" "${FOLDERS[@]}"
else
  VERSION="$(node -p "require('$REPO/package.json').version")"
  VSIX="$RESULTS/speckit-companion-$VERSION-e2e.vsix"
  [ -f "$VSIX" ] || (cd "$REPO" && npm run package -- -o "$VSIX" >/dev/null) || { echo "[vscode] vsce package failed -> no vsix to install"; exit 1; }
  "${CODE[@]}" --install-extension "$VSIX" --force >/dev/null
  "${CODE[@]}" --new-window "${FOLDERS[@]}"
fi
echo "[vscode] opened $SANDBOX ($MODE, $(git -C "$REPO" branch --show-current)@$(git -C "$REPO" rev-parse --short HEAD))"
