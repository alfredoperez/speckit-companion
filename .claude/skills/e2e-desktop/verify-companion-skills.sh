#!/usr/bin/env bash
# Fail loudly unless every Companion skill in <dir> resolves to a real file for both agents.
# `test -e` follows symlinks, so a dangling link from a --dev install fails here instead of at the Copilot app.
# Usage: verify-companion-skills.sh <project-dir>
set -uo pipefail

DIR="${1:?usage: verify-companion-skills.sh <project-dir>}"
bad=0

for area in .github/skills .claude/skills; do
  found=0
  for skill in "$DIR/$area"/speckit-companion-*/SKILL.md; do
    [ -e "$skill" ] || [ -L "$skill" ] || continue
    found=$((found + 1))
    if [ ! -e "$skill" ]; then
      echo "[verify] BROKEN $skill (dangling symlink -> $(readlink "$skill"))"
      bad=$((bad + 1))
    fi
  done
  if [ "$found" -eq 0 ]; then
    echo "[verify] NONE $area/speckit-companion-*/SKILL.md (Companion was not emitted for this agent)"
    bad=$((bad + 1))
  fi
done

[ -e "$DIR/.specify/extensions/companion/extension.yml" ] || { echo "[verify] MISSING .specify/extensions/companion/extension.yml"; bad=$((bad + 1)); }

if [ "$bad" -gt 0 ]; then
  echo "[verify] $bad problem(s): the Copilot app would fall back to stock /speckit.* commands"
  exit 1
fi
echo "[verify] Companion skills resolve for Copilot and Claude"
