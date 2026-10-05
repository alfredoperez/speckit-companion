#!/usr/bin/env bash
# Stage the desktop half of /release-qa so Claude Desktop only clicks. Prints READY and the handoff path, or NOT READY and the first gate that failed.
# Usage: qa-stage.sh <run-name>      e.g. qa-stage.sh 2026-10-01
# Claude Code runs this on the Mac. It never touches your VS Code settings or profiles.
# The two sandboxes come from the speckit-sandboxes recipes (vscode-qa, vscode-qa-stock); everything after the build happens here.
set -euo pipefail

NAME="${1:?usage: qa-stage.sh <run-name>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
. "$REPO/.claude/sandboxes-env.sh"
SB="$SANDBOXES_DIR/qa-$NAME"
STOCK="$SANDBOXES_DIR/qa-$NAME-stock"
RESULTS="$EVIDENCE_DIR/$(date +%Y-%m-%d)-qa-$NAME"
FEATURE="Show a count of starred todos in the list footer."
fail() { echo "[stage] NOT READY: $*"; exit 1; }
say() { echo "[stage] $*"; }

[ -z "$(git -C "$REPO" status --porcelain)" ] || fail "the repo has uncommitted changes, so the build under test would not match HEAD"
[ -e "$SB" ] && fail "$SB exists, pick a new run name"
[ -e "$STOCK" ] && fail "$STOCK exists, pick a new run name"
mkdir -p "$RESULTS" "$HERE/.bin"
swiftc -O -o "$HERE/.bin/windows" "$HERE/windows.swift" 2>/dev/null || fail "could not compile windows.swift (needs the Xcode command line tools)"

say "sandbox (the vscode-qa recipe: app, Companion dev build, demo specs and fixtures)"
COMPANION_DIR="$REPO" "$SANDBOXES_REPO/new-sandbox.sh" vscode-qa "qa-$NAME" -- --dev > "$RESULTS/setup.log" 2>&1 || fail "the vscode-qa recipe failed, see $RESULTS/setup.log"
[ -d "$SB/specs/_07_links-demo" ] || fail "the vscode-qa recipe did not build $SB, see $RESULTS/setup.log"
"$HERE/verify-companion-skills.sh" "$SB" >> "$RESULTS/setup.log" 2>&1 || fail "Companion install is broken, see $RESULTS/setup.log"

say "Claude Code trust"
r=$(python3 "$HERE/trust-claude-folder.py" "$SB") || fail "Claude Code trust for the sandbox: $r"
say "  sandbox: $r"

say "timed-run spec (headless specify, so no typing is needed)"
( cd "$SB" && claude -p "/speckit.companion.specify $FEATURE" --permission-mode bypassPermissions > "$RESULTS/specify.log" 2>&1 ) || fail "headless specify failed, see $RESULTS/specify.log"
TIMED=$(cd "$SB/specs" && ls -t | grep -v -E '^_0[0-7]_' | head -1)
[ -n "$TIMED" ] && [ -f "$SB/specs/$TIMED/.spec-context.json" ] || fail "specify wrote no spec folder"
( cd "$SB" && git add -A && git -c user.email=qa@example.com -c user.name=qa commit -qm "qa fixtures" )

say "stock workspace"
"$SANDBOXES_REPO/new-sandbox.sh" vscode-qa-stock "qa-$NAME-stock" > "$RESULTS/stock-init.log" 2>&1 || fail "the vscode-qa-stock recipe failed, see $RESULTS/stock-init.log"
[ -d "$STOCK/.specify" ] || fail "the vscode-qa-stock recipe did not build $STOCK, see $RESULTS/stock-init.log"
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
code --profile Default --new-window "$SB"; sleep 5
code --profile Default --new-window "$STOCK"; sleep 5
code --profile Default --new-window "$RESULTS/two-roots.code-workspace"; sleep 8
TITLES=$("$HERE/.bin/windows" | awk -F'\t' '$2=="Code"{print $3}')
for want in "qa-$NAME" "qa-$NAME-stock" "two-roots"; do
  printf '%s\n' "$TITLES" | grep -q -- "$want" || fail "no VS Code window titled with $want"
done
PROFILES=$(python3 -c "import json,os;print('\\n'.join(p['name'] for p in json.load(open(os.path.expanduser('~/Library/Application Support/Code/User/globalStorage/storage.json'))).get('userDataProfiles',[])))" 2>/dev/null || true)
while IFS= read -r prof; do
  [ -z "$prof" ] && continue
  printf '%s\n' "$TITLES" | grep -- "qa-$NAME\|two-roots" | grep -q -- "— $prof\$" && fail "a QA window opened in the '$prof' profile, which does not have the build; close it and rerun"
done <<< "$PROFILES"

say "recorder"
nohup "$HERE/record-windows.sh" "$RESULTS/shots" "qa-$NAME|two-roots" > "$RESULTS/recorder.log" 2>&1 &
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
