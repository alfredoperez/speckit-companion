#!/usr/bin/env bash
# Save a numbered screenshot of the frontmost window (full screen if the window can't be located).
# Usage: shot.sh <results-dir> <surface> <slug> [light|dark]   -> <results-dir>/shots/NN-<surface>-<slug>[-theme].png
set -euo pipefail

RESULTS="${1:?usage: shot.sh <results-dir> <surface> <slug> [theme]}"
SURFACE="${2:?surface}"
SLUG="${3:?slug}"
THEME="${4:-}"
DIR="$RESULTS/shots"
mkdir -p "$DIR"
N=$(printf '%02d' $(( $(ls "$DIR" 2>/dev/null | wc -l) + 1 )))
FILE="$DIR/$N-$SURFACE-$SLUG${THEME:+-$THEME}.png"

BOUNDS=$(osascript -e 'tell application "System Events" to tell (first process whose frontmost is true) to get {position, size} of front window' 2>/dev/null | tr -d ' ' || true)
if [ -n "$BOUNDS" ]; then
  screencapture -x -o -R"$BOUNDS" "$FILE"
else
  echo "[shot] Front window bounds unavailable (no Accessibility grant) -> full-screen capture"
  screencapture -x -m "$FILE"
fi
[ -s "$FILE" ] || { echo "[shot] Capture empty -> grant Screen Recording to Claude in System Settings"; exit 1; }
echo "$FILE"
