#!/usr/bin/env bash
# Every 15s, captures each QA window (and the Copilot app) by window id, never the screen, and keeps a frame only when that window changed.
# Usage: record-windows.sh <out-dir> <title-regex>   Stop: touch <out-dir>/STOP
set -uo pipefail
OUT="$1"; FILTER="$2"
WINDOWS="$(dirname "$0")/.bin/windows"
SUMS="$OUT/.sums"
mkdir -p "$OUT" "$SUMS"
while [ ! -e "$OUT/STOP" ]; do
  "$WINDOWS" | awk -F'\t' -v f="$FILTER" '($2=="Code" && $3 ~ f) || $2=="GitHub Copilot"' | while IFS=$'\t' read -r id owner title; do
    slug=$(printf '%s' "$title" | tr -c 'A-Za-z0-9._-' '_' | cut -c1-50)
    tmp="$OUT/frame-in-progress-$id.png"
    if screencapture -x -o -l "$id" "$tmp" 2>/dev/null && [ -s "$tmp" ]; then
      sum=$(md5 -q "$tmp")
      if [ "$sum" != "$(cat "$SUMS/$id" 2>/dev/null)" ]; then
        mv "$tmp" "$OUT/$(date +%H%M%S)-$slug.png"
        echo "$sum" > "$SUMS/$id"
      else
        rm -f "$tmp"
      fi
    fi
  done
  sleep 15
done
