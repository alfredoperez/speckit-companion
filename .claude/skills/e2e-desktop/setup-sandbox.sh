#!/usr/bin/env bash
# Build a throwaway e2e sandbox: the todo app, spec-kit (claude + copilot), the Companion commands, all committed on main.
# Usage: setup-sandbox.sh <sandbox-dir>
set -euo pipefail

SANDBOX="${1:?usage: setup-sandbox.sh <sandbox-dir>}"
REPO="$(cd "$(dirname "$0")/../../.." && pwd)"
APP="${E2E_APP_DIR:-$HOME/dev/GitHub/speckit-bench/examples/todo-claude}"

[ -e "$SANDBOX" ] && { echo "[setup] $SANDBOX already exists, pick a new name or delete it"; exit 1; }
[ -d "$APP/src" ] || { echo "[setup] app fixture not found at $APP (set E2E_APP_DIR)"; exit 1; }
specify extension --help >/dev/null 2>&1 || { echo "[setup] specify lacks the extension subcommand, see apps/speckit-extension/docs/install.md"; exit 1; }

mkdir -p "$SANDBOX"
cd "$APP"
cp -R src index.html package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts vitest.setup.ts README.md CLAUDE.md "$SANDBOX"/
mkdir -p "$SANDBOX/.specify/memory"
cp .specify/memory/constitution.md "$SANDBOX/.specify/memory/constitution.md.keep"

cd "$SANDBOX"
printf 'node_modules/\ndist/\n' > .gitignore
git init -q -b main
specify init --here --force --non-interactive --integration claude >/dev/null
specify integration install copilot --force >/dev/null
mv .specify/memory/constitution.md.keep .specify/memory/constitution.md
# extension add emits only for the default integration and a re-add wipes the other agent's copy: emit copilot, park it, emit claude, restore
STASH="$(mktemp -d)"
specify integration use copilot >/dev/null
specify extension add "$REPO/apps/speckit-extension" --dev --force >/dev/null
cp -R .github/skills/speckit-companion-* "$STASH"/
specify integration use claude >/dev/null
specify extension add "$REPO/apps/speckit-extension" --dev --force >/dev/null
cp -R "$STASH"/speckit-companion-* .github/skills/
rm -rf "$STASH"

for marker in .specify/extensions/companion .claude/skills/speckit-companion-plan .github/skills/speckit-companion-plan; do
  [ -e "$marker" ] || echo "[setup] Missing Companion marker $marker -> canvas may fall back to stock /speckit.*"
done

# navigation fixtures: the repo's pinned demo specs (copied, so the repo's own copies are never mutated) plus one with related docs and one archived
mkdir -p specs
cp -R "$REPO"/specs/_0*_demo-* specs/
cp -R specs/_02_demo-tasked specs/_04_demo-related-docs
mkdir -p specs/_04_demo-related-docs/checklists
printf '# Research\n\nDecision: keep storage in localStorage.\n' > specs/_04_demo-related-docs/research.md
printf '# Data model\n\n- Todo: id, title, done\n' > specs/_04_demo-related-docs/data-model.md
printf '# Requirements checklist\n\n- [x] CHK001 Every story has a test\n' > specs/_04_demo-related-docs/checklists/requirements.md
cp -R specs/_03_demo-living specs/_05_demo-archived
python3 - <<'PY'
import json
for path, name in [("specs/_04_demo-related-docs/.spec-context.json", "Demo related docs"), ("specs/_05_demo-archived/.spec-context.json", "Demo archived")]:
    d = json.load(open(path))
    d["specName"] = name
    if "archived" in path:
        d["status"] = "archived"
    json.dump(d, open(path, "w"), indent=2)
PY

npm install --silent >/dev/null 2>&1 || echo "[setup] npm install failed -> implement cannot run tests"
git add -A
git commit -qm "e2e sandbox baseline"
echo "[setup] sandbox ready at $SANDBOX (main @ $(git rev-parse --short HEAD))"
