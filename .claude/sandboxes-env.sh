#!/usr/bin/env bash
# Where the sibling speckit-sandboxes checkout is. Source it, never run it:   . .claude/sandboxes-env.sh
#   SANDBOXES_REPO  the checkout: the environment wins, else ../speckit-sandboxes beside this repo, else ../speckit-bench (its old name)
#   SANDBOXES_DIR   the sandbox root every built sandbox lives under (new-sandbox.sh --where)
#   EVIDENCE_DIR    where run results worth keeping go, one YYYY-MM-DD-<what> folder per run
# Works sourced from bash 3.2 and from zsh, with or without `set -eu`.

_sbx_root="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
if [ -z "${SANDBOXES_REPO:-}" ]; then
  # In a git worktree the sibling sits beside the main checkout, not beside the worktree.
  _sbx_main="$(git -C "$_sbx_root" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
  _sbx_main="${_sbx_main%/.git}"
  for _sbx_try in "$_sbx_root/../speckit-sandboxes" "$_sbx_root/../speckit-bench" "${_sbx_main:-$_sbx_root}/../speckit-sandboxes" "${_sbx_main:-$_sbx_root}/../speckit-bench"; do
    if [ -x "$_sbx_try/new-sandbox.sh" ]; then SANDBOXES_REPO="$_sbx_try"; break; fi
  done
fi
if [ -z "${SANDBOXES_REPO:-}" ] || [ ! -x "$SANDBOXES_REPO/new-sandbox.sh" ]; then
  echo "[sandboxes] no speckit-sandboxes checkout beside $_sbx_root (clone it there, or set SANDBOXES_REPO)" >&2
  unset _sbx_root _sbx_main _sbx_try
  return 1 2>/dev/null || exit 1
fi
SANDBOXES_REPO="$(cd "$SANDBOXES_REPO" && pwd)"
SANDBOXES_DIR="$("$SANDBOXES_REPO/new-sandbox.sh" --where)"
EVIDENCE_DIR="$SANDBOXES_REPO/evidence"
export SANDBOXES_REPO SANDBOXES_DIR EVIDENCE_DIR
unset _sbx_root _sbx_main _sbx_try
