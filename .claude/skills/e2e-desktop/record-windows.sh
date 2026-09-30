#!/usr/bin/env bash
# Every 15s, captures the frontmost QA window only (never the screen, never another app), skipping unchanged frames.
# Usage: record-windows.sh <out-dir> <title-filter>   Stop: touch <out-dir>/STOP
set -uo pipefail
OUT="$1"; FILTER="$2"
WINDOWS="$(dirname "$0")/.bin/windows"
mkdir -p "$OUT"
last=""
while [ ! -e "$OUT/STOP" ]; do
  line=$("$WINDOWS" | awk -F'\t' -v f="$FILTER" '($2=="Code" && index($3,f)) || $2=="GitHub Copilot" {print; exit}')
  if [ -n "$line" ]; then
    id=$(printf '%s' "$line" | cut -f1)
    slug=$(printf '%s' "$line" | cut -f3 | tr -c 'A-Za-z0-9._-' '_' | cut -c1-50)
    tmp="$OUT/.frame.png"
    if screencapture -x -o -l "$id" "$tmp" 2>/dev/null && [ -s "$tmp" ]; then
      sum=$(md5 -q "$tmp")
      if [ "$sum" != "$last" ]; then mv "$tmp" "$OUT/$(date +%H%M%S)-$slug.png"; last="$sum"; else rm -f "$tmp"; fi
    fi
  fi
  sleep 15
done
