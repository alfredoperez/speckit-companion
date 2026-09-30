#!/usr/bin/env bash
# Stage the desktop half of /qa-release so Claude Desktop only clicks. Prints READY and the handoff path, or NOT READY and the first gate that failed.
# Usage: qa-stage.sh <run-name>      e.g. qa-stage.sh 2026-10-01
# Claude Code runs this on the Mac. It never touches your VS Code settings or profiles.
set -euo pipefail

NAME="${1:?usage: qa-stage.sh <run-name>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
BASE="$HOME/dev/projects/companion-sandboxes"
SB="$BASE/qa-$NAME"
STOCK="$BASE/qa-$NAME-stock"
RESULTS="$BASE/e2e-results/qa-$NAME"
FEATURE="Show a count of starred todos in the list footer."
fail() { echo "[stage] NOT READY: $*"; exit 1; }
say() { echo "[stage] $*"; }

[ -z "$(git -C "$REPO" status --porcelain)" ] || fail "the repo has uncommitted changes, so the build under test would not match HEAD"
[ -e "$SB" ] && fail "$SB exists, pick a new run name"
mkdir -p "$RESULTS" "$HERE/.bin"
swiftc -O -o "$HERE/.bin/windows" "$HERE/windows.swift" 2>/dev/null || fail "could not compile windows.swift (needs the Xcode command line tools)"

say "sandbox"
"$HERE/setup-sandbox.sh" "$SB" > "$RESULTS/setup.log" 2>&1 || fail "setup-sandbox.sh failed, see $RESULTS/setup.log"

say "fixtures"
( cd "$SB/specs"
  cp -R _01_demo-planned _06_empty-record
  cp -R _02_demo-tasked _07_links-demo
  python3 - <<'PY'
import json, re
for folder, title, empty in [("_06_empty-record", "Demo — Empty record", True), ("_07_links-demo", "Demo — Links", False)]:
    ctx = f"{folder}/.spec-context.json"
    d = json.load(open(ctx))
    d["specName"] = title
    if empty:
        d["history"] = []
        d.pop("stepHistory", None)
    json.dump(d, open(ctx, "w"), indent=2)
    spec = f"{folder}/spec.md"
    text = open(spec).read()
    open(spec, "w").write(re.sub(r"^# .*$", f"# {title}", text, count=1, flags=re.M))
PY
  python3 - <<'PY'
spec = "_07_links-demo/spec.md"
lines = open(spec).read().split("\n")
links = ["", "## Links", "", "- [Approach](plan.md#approach)", "- [Tasks](tasks.md)", "- [Far heading](#far-heading)",
         "- [Other spec](../_01_demo-planned/spec.md)", "- [Source file](../../src/App.tsx)", "- [Web link](https://speckit-companion.dev)", ""]
filler = ["", "## Notes", ""] + [f"Note line {i}: padding so the next heading starts off screen." for i in range(1, 61)] + ["", "## Far heading", "", "The Far heading link lands here."]
open(spec, "w").write("\n".join(lines[:1] + links + lines[1:] + filler) + "\n")
PY
  grep -q '^## Approach' _07_links-demo/plan.md || printf '\n## Approach\n\nKeep it small.\n' >> _07_links-demo/plan.md )

say "Claude Code trust"
r=$(python3 "$HERE/trust-claude-folder.py" "$SB") || fail "Claude Code trust for the sandbox: $r"
say "  sandbox: $r"

say "timed-run spec (headless specify, so no typing is needed)"
( cd "$SB" && claude -p "/speckit.companion.specify $FEATURE" --permission-mode bypassPermissions > "$RESULTS/specify.log" 2>&1 ) || fail "headless specify failed, see $RESULTS/specify.log"
TIMED=$(cd "$SB/specs" && ls -t | grep -v -E '^_0[0-7]_' | head -1)
[ -n "$TIMED" ] && [ -f "$SB/specs/$TIMED/.spec-context.json" ] || fail "specify wrote no spec folder"
( cd "$SB" && git add -A && git -c user.email=qa@example.com -c user.name=qa commit -qm "qa fixtures" )

say "stock workspace"
mkdir -p "$STOCK"
( cd "$STOCK" && git init -q && specify init --here --force --integration claude > "$RESULTS/stock-init.log" 2>&1 && git add -A && git -c user.email=qa@example.com -c user.name=qa commit -qm init ) || fail "specify init for the stock workspace failed, see $RESULTS/stock-init.log"
[ ! -d "$STOCK/.specify/extensions/companion" ] || fail "the stock workspace has Companion installed"
r=$(python3 "$HERE/trust-claude-folder.py" "$STOCK") || fail "Claude Code trust for the stock workspace: $r"
say "  stock: $r"
printf '{"folders":[{"name":"sandbox","path":"%s"},{"name":"stock","path":"%s"}]}\n' "$SB" "$STOCK" > "$RESULTS/two-roots.code-workspace"

say "build and install into your VS Code"
INSTALLED=$(ls -d "$HOME"/.vscode/extensions/alfredoperez.speckit-companion-* 2>/dev/null | sed -E 's/.*-([0-9]+\.[0-9]+\.[0-9]+)$/\1/' | sort -V | tail -1)
CURRENT=$(node -p "require('$REPO/package.json').version")
TOP=$(printf '%s\n%s\n' "$INSTALLED" "$CURRENT" | sort -V | tail -1)
NEXT=$(node -e "const [a,b,c]=process.argv[1].split('.').map(Number);console.log([a,b,c+1].join('.'))" "$TOP")
if ! ( cd "$REPO" && npm version "$NEXT" --no-git-tag-version >/dev/null && npm run package -- -o "$RESULTS/speckit-companion-$NEXT.vsix" > "$RESULTS/package.log" 2>&1 ); then
  git -C "$REPO" restore package.json package-lock.json; fail "packaging failed, see $RESULTS/package.log"
fi
git -C "$REPO" restore package.json package-lock.json
code --install-extension "$RESULTS/speckit-companion-$NEXT.vsix" --force > "$RESULTS/install.log" 2>&1 || fail "install failed, see $RESULTS/install.log"
[ -d "$HOME/.vscode/extensions/alfredoperez.speckit-companion-$NEXT" ] || fail "VS Code did not unpack $NEXT"

say "windows"
code --new-window "$SB"; sleep 5
code --new-window "$STOCK"; sleep 5
code --new-window "$RESULTS/two-roots.code-workspace"; sleep 8
TITLES=$("$HERE/.bin/windows" | awk -F'\t' '$2=="Code"{print $3}')
for want in "qa-$NAME" "qa-$NAME-stock" "two-roots"; do
  printf '%s\n' "$TITLES" | grep -q -- "$want" || fail "no VS Code window titled with $want"
done

say "recorder"
nohup "$HERE/record-windows.sh" "$RESULTS/shots" "qa-$NAME" > "$RESULTS/recorder.log" 2>&1 &
sleep 20
ls "$RESULTS/shots"/*.png >/dev/null 2>&1 || fail "the recorder captured nothing (Screen Recording permission for the terminal?)"

sed -e "s|{{SANDBOX}}|qa-$NAME|g" -e "s|{{STOCK}}|qa-$NAME-stock|g" -e "s|{{TIMED}}|$TIMED|g" -e "s|{{VERSION}}|$NEXT|g" -e "s|{{SANDBOX_PATH}}|$SB|g" \
  "$HERE/desktop-handoff.md" > "$RESULTS/desktop-handoff.md"

cat > "$RESULTS/stage.env" <<ENV
SB=$SB
STOCK=$STOCK
RESULTS=$RESULTS
TIMED=$SB/specs/$TIMED
VERSION=$NEXT
HEAD=$(git -C "$REPO" rev-parse --short HEAD)
ENV
echo "[stage] READY: build $NEXT from $(git -C "$REPO" rev-parse --short HEAD), windows open, folders trusted, recorder running"
echo "[stage] Hand Claude Desktop: $RESULTS/desktop-handoff.md"
