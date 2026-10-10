---
name: release-qa
description: Release-scoped QA of SpecKit Companion on the real Mac, run once at the end of a batch of fixes. Reads what is being released (the diff since the last v* tag plus the Unreleased changelogs), turns changed paths into a checklist through surface-map.yml, runs every automated gate with Bash first, then spends desktop time only on what needs eyes (VS Code through computer use, the GitHub Copilot app canvas, a terminal run) on top of a fixed baseline, and writes one QA report note into the Obsidian vault with a ship / fix-first verdict. Use when the user says "/release-qa", "release qa", "qa release", "run QA", "QA the release", "run the desktop e2e", or wants VS Code, canvas and terminal timing runs instead of auto mode.
compatibility: Claude Code on the Mac runs this skill (Bash, the `code`, `specify` and `claude` CLIs, Swift command line tools, the `obsidian` skill). Claude Desktop with computer use only clicks, from the handoff qa-stage.sh writes.
metadata:
  author: alfredo
  source: repo
---

# QA release

One run per release, never per ticket, and issue-agnostic: it reads what is being released, not a ticket list. Claude Code runs this skill on the Mac and does every bit of setup, typing, polling and timing. Claude Desktop only clicks and looks, from a handoff Claude Code writes: its Bash is a Linux sandbox with no `code`, `specify` or `gh`, and VS Code is click-only for it. QA never edits this repo; failures become fix candidates in the report. The repo stays untouched; the throwaway `.vsix` goes into the results folder.

`/release-qa` is the entry point, and step 3 of `/release-loop`. This skill holds the flow; `surface-map.yml` holds the checks; the helper scripts in this folder do the mechanical parts.

## What each tool can do here

| App | Tier | You can | You cannot |
|---|---|---|---|
| Visual Studio Code | click | left-click, scroll, screenshot | type, press keys, right-click, drag. So no command palette, no typing in the Create Spec box, no terminal input |
| GitHub Copilot | full | everything | - |
| Browsers | read | look | click. Used only to look at changed site pages |

Consequences, designed in: settings are written to a file by Bash, the AI provider runs with auto-approve so its terminal never waits for a keypress, and the one piece of typing VS Code needs (the Create Spec description) is either handed to the user as a paste or done headless by Bash. Look with the computer-use `screenshot`; save evidence with `shot.sh`, which writes a real PNG to disk.

## Variables

```bash
REPO=/Users/alfredoperez/dev/GitHub/speckit-companion
SKILL=$REPO/.claude/skills/release-qa
VAULT=$HOME/dev/GitHub/obsidian-vault
DATE=$(date +%Y-%m-%d)
RUN=$(date +%Y-%m-%d-%H%M)
. "$REPO/.claude/sandboxes-env.sh"     # SANDBOXES_REPO, SANDBOXES_DIR, EVIDENCE_DIR
SANDBOX=$SANDBOXES_DIR/e2e-$RUN
STOCK=$SANDBOX-stock
RESULTS=$EVIDENCE_DIR/$DATE-release-qa
```

Re-declare them in every Bash call; shell state does not persist. `$RESULTS` is per day: a second run the same day reuses it and its numbered shots. `sandboxes-env.sh` finds the sibling `speckit-sandboxes` checkout, whose recipes build every sandbox this skill uses: sandboxes land under its sandbox root (`$SANDBOXES_DIR`) and results under its `evidence/` folder. `qa-stage.sh` names its own folders from the run name: `$SANDBOXES_DIR/qa-<name>`, `qa-<name>-stock` and `$EVIDENCE_DIR/<date>-qa-<name>/`.

## Step 0. Scope the run from the release

Stop on a dirty tree, then read the release:

```bash
TAG=$(git -C $REPO describe --tags --abbrev=0 --match 'v[0-9]*')
git -C $REPO diff $TAG..HEAD --stat
git -C $REPO diff $TAG..HEAD --name-only
awk '/^## \[Unreleased\]/{f=1;next} /^## \[/{f=0} f' $REPO/CHANGELOG.md
awk '/^## \[Unreleased\]/{f=1;next} /^## \[/{f=0} f' $REPO/apps/speckit-extension/CHANGELOG.md
```

Then build the checklist:

1. Match every changed path against `surface-map.yml`. Union the checks of every surface it matches, add `baseline`, and dedupe by check id: a check runs once however many surfaces ask for it.
2. A path that matches no surface and no `ignore` glob is listed in the report as `no QA mapping`. Do not guess a check for it.
3. Each Unreleased bullet is a claim the release makes. Name the check that would show it; a bullet no check reaches gets one extra desktop check of its own. An empty Unreleased section goes in the report as such.
4. Write the checklist to `$RESULTS/checks.md` (`| check | kind | why | status | note |`). Every later step updates the status as it goes, and the report table is built from this file.

`/release-qa recheck` is the re-run after fixes: it repeats the automated gates and only the checks that ended FAIL or BLOCKED, and carries a PASS over only when nothing changed since then matches its surface. A scripted check reruns the whole real-window check and regrades, since its steps build on one another.

## Step 1. Automated gates, Bash only

Run every `kind: auto` check first, independent ones in parallel, each logging to `$RESULTS/auto/<id>.log`. Record PASS or FAIL per check. A red gate does not stop the run, so one pass gathers every finding; only a failed build or package marks the desktop checks BLOCKED.

`check-capture` and `terminal-run` are not `auto` checks: they need a run first, so they belong to Step 2. The `scripted` checks open a real window, so they wait for Step 2 as well.

## Step 2. Desktop time, only for what needs eyes

Claude Code, on the Mac:

1. **`terminal-run`** first, in its own copy of a sandbox (the Terminal run recipe), so its timing never competes with the desktop run.
2. **Every `kind: scripted` check**, before anything is staged. One run decides them all: the real-window check drives VS Code on a throwaway project with a stand-in assistant, so it types, drags, reads the terminal and needs nobody. It opens one window for about four minutes and takes the keyboard focus while it runs, so say so before starting it.
   ```bash
   rm -f "$REPO"/.desktop-check/results.*.json
   cd "$REPO" && npm run check:desktop > "$RESULTS/auto/check-desktop.log" 2>&1
   node tooling/scripts/desktop-check.mjs --theme dark --only sidebar-panes,narrow-panel-spec,narrow-panel-tasks,nav-n7 >> "$RESULTS/auto/check-desktop.log" 2>&1
   python3 "$SKILL/grade-scripted.py" --map "$SKILL/surface-map.yml" --results "$REPO/.desktop-check" | tee "$RESULTS/scripted.txt"
   ```
   The first line removes the last run's results, so a run that dies before it starts grades BLOCKED and never PASS on old files. The dark run names the steps the `themes` check lists; keep the two in step. Those steps prove the layout holds in dark, not that it reads well: open the four `.dark.png` pictures and look at colour and contrast yourself, and record what you saw in the `themes` note. The grader prints `<id> PASS|FAIL|BLOCKED: <note>` per check: copy each status and note into `checks.md`. A step that failed is a FAIL with its own note and its screenshot under `.desktop-check/<step>.<theme>.png`; a results file that is missing, or a step that did not run or was skipped, is BLOCKED and never a PASS. Copy `.desktop-check/` into `$RESULTS/desktop-check/` before the next run replaces it. A scripted check is never handed to Claude Desktop.
3. **Canvas checks headlessly** through the Copilot SDK harness on a copy of the sandbox (three bare opens, New spec per workflow, per-spec commands). The harness has one model, not the Copilot app's own, so the real-app check stays a separate row.
   Run `canvas-harness/canvas-checks.sh <copy> <results>` on a fresh copy of the sandbox (the agent writes specs there; it refuses a non-git or dirty folder). It installs its own deps on first run, gives each session about five minutes (a stall is BLOCKED, never retried), and prints one PASS/FAIL line per check.
   The checks come in two kinds, so a stale harness and a product finding never share a row. `new-spec-speckit` and `new-spec-companion` assert what the board sent: the command as the sandbox spells it, one run-instructions sentence, no inline lifecycle text. `canvas-new-spec-record-advances` and `canvas-new-spec-stays-in-specify` report what the agent then did: whether the record got the specify complete (with whether it opened the run instructions and how often it called the recorder), and whether anything changed outside `specs/`. Report the second pair as findings about the product and the model the harness ran, named in `model`.
   It writes `<results>/canvas-checks.json` (`checks[]` with `id`, `result`, `evidence`, plus `model`) and every sent message, reply and tool call (with the file or command it named) under `<results>/canvas-transcripts/`.
4. **`qa-stage.sh <run-name>`**. It builds the sandbox and fixtures from the `vscode-qa` recipe and the stock workspace from `vscode-qa-stock`, answers Claude Code's folder-trust prompt once for the sandbox and the stock workspace, creates the timed-run spec headlessly (so nothing needs typing), installs this build into the user's normal VS Code, opens the three QA windows in the Default profile, starts `record-windows.sh`, and writes `desktop-handoff.md` from the template. It prints `READY` only when every gate passed, or `NOT READY` and the gate that failed. Never hand anything to Claude Desktop before `READY`.

Then the user pastes the handoff path into Claude Desktop, which clicks through the four parts that still need eyes (first open, the stock workspace and two roots, the timed run, the GitHub Copilot app) and replies with one line per step. The handoff is short on purpose: a computer-use grant lapses after thirty idle minutes, so nothing a script can decide is on it. When its reply reports a terminal question, answer it from Bash (the headless fallback) and tell the user to have Desktop carry on. Claude Code turns the reply into the report, runs `timing.py report` and `check_capture.py` on the timed spec (`TIMED` in `stage.env`), stops the recorder (`touch shots/STOP`), and picks screenshots from `shots/`.

What staging has to get right, each learned the hard way:

- Any folder with its own `.claude/` shows Claude Code's trust prompt, even with `bypassPermissions`. `trust-claude-folder.py` answers it once; Claude Code records the answer itself.
- `speckit.permissionMode` is machine-scoped, so a workspace `settings.json` cannot set it. The user's Claude Code already runs in auto mode, which is what the timed run relies on.
- A fresh `--user-data-dir` asks the user to log in again, and a long one breaks VS Code's socket path. Use the user's own VS Code.
- `code --new-window` reuses the last-used profile; `--profile Default` avoids that, and the stage fails if a QA window lands in another profile.
- `screencapture -R` grabs whatever floats on top. `record-windows.sh` captures every QA window by id instead (guessing the front one missed most of a run), and `screencapture` refuses dot-file names.
- Close QA windows with their own close button (`AXCloseButton`), never with a keystroke: a keystroke goes to whichever app is in front.

A stuck prompt the clicks cannot answer is a finding for that check, recorded with what it asked; unblock it through the headless fallback and continue.

## Step 3. The report, one vault note

Load the `obsidian` skill (report profile) and `writing`, then write one note:

`$VAULT/Projects/speckit companion/QA Report $DATE.md` (a second run the same day adds ` 2`). No `reports/` folder exists; the note sits flat in the project folder.

Frontmatter is the report profile's, plus what the release gate reads:

```yaml
kind: "QA report"
lifespan: ephemeral
head: <short sha under test>
tag: <last v* tag>
verdict: ship | fix-first
fails: <n>
blocked: <n>
```

Directly under the title, one line: `branch@sha`, the extension version, the tag it is measured from. `sub:` carries the 60 to 120 word finding, since it outlives the body.

Sections, in this order:

1. **Verdict** as the opening titled `[!note]`: `ship` or `fix first`, then one line naming every FAIL and BLOCKED check. `ship` means no FAIL; a BLOCKED check is named in the line even when the verdict is ship.
2. **What the release changed**: the surfaces that matched, the Unreleased claims, and the `no QA mapping` paths.
3. **Checks**: one row per check, `check | PASS/FAIL/BLOCKED | one-line note`, automated and desktop together, in the order they ran.
4. **Timing**: one row per step, one column per surface (VS Code, canvas, terminal), the recorded span with the wall clock in brackets. Build it from `timing.md`. A gap over about 10s or a missing span is a finding. A surface that did not run shows `-`.
5. **Findings**, most severe first, one block each, every FAIL a fix candidate:

```markdown
### F<n> — <one-line symptom>
- Check: <check id>
- Severity: blocker | major | minor | cosmetic
- Repro: 1. <exact click> 2. <exact click> 3. …
- Expected: <quote the site reference or README line when there is one>
- Actual: …
- Fix candidate: <one line, the suspected area>
- Evidence: ![[QA Report <DATE> - <slug>.png]]
```

6. **Screenshots worth keeping**: each docs candidate as `file`, what it shows, and which existing asset it could replace. Never copy into `docs/screenshots/`: the five README shots have their own recipe in `docs/visual-assets.md` and their filenames are load-bearing; generated images come from Storybook.
7. **Evidence**: the `$RESULTS` path.

Copy each embedded shot (every finding's evidence and every docs candidate) next to the note as `QA Report <DATE> - <slug>.png`, embed it with `![[…]]`, and give it a one-line italic caption. Raw evidence, the other shots, logs and capture output stay in `$RESULTS`. Run the `obsidian` skill's hard-wrap check on the note, then open it in Obsidian.

End the chat with the verdict, the top findings, VS Code against canvas against terminal timing per step, and the note's path.

## Recipe: Preflight

Run each and stop with a one-line reason on the first failure. The two Copilot items apply only when a canvas check is scoped.

- [ ] `specify extension --help` works (source build of spec-kit, see `apps/speckit-extension/docs/install.md`)
- [ ] `claude --version` works and `claude -p "say ok"` answers (the VS Code provider shells out to it)
- [ ] `code --version` works
- [ ] `test -f ~/.copilot/extensions/speckit-companion/extension.mjs` (canvas loader, it imports `$REPO/apps/copilot-canvas/extension.mjs`)
- [ ] `gh api /copilot_internal/user --jq '[.copilot_plan, .chat_enabled, .copilot_app_enabled]'` shows chat enabled; a lapsed plan answers every canvas run with a 403, so stop here and say so
- [ ] `ls "$SANDBOXES_REPO/seeds/todo/src"` (the app fixture) and `"$SANDBOXES_REPO/new-sandbox.sh" --list` names `vscode-qa` and `vscode-qa-stock`
- [ ] `request_access` for **Visual Studio Code** and **GitHub Copilot**; confirm the returned tiers match the table above
- [ ] `$SKILL/shot.sh /tmp/e2e-probe x probe` writes a non-empty PNG (needs Screen Recording for Claude; Accessibility makes it crop to the front window)
- [ ] `git -C $REPO status --porcelain` is empty, so the sha under test means something
- [ ] Record what is under test: `git -C $REPO branch --show-current`, `git -C $REPO rev-parse --short HEAD`, `node -p "require('$REPO/package.json').version"`, `specify version | head -3`. These go in the report header.

## Recipe: Sandbox and results folder

```bash
mkdir -p "$RESULTS"
"$SKILL/setup-sandbox.sh" "$SANDBOX"
cp -R "$SANDBOX" "$SANDBOX-terminal"
```

The copy is the terminal run's own sandbox, taken before any run touches `specs/`.

`setup-sandbox.sh` is a thin wrapper over the `vscode-qa` recipe in speckit-sandboxes (`recipes/vscode-qa/setup.sh`), run against this checkout. The recipe copies the `todo` seed app, runs `specify init` with the Claude integration plus Copilot, installs this checkout's spec-kit extension (`specify extension add $REPO/apps/speckit-extension --dev`) once per agent, Claude first and Copilot last (Copilot stays the default), seeds navigation fixtures (`specs/_00…_03` copied from the repo, plus `_04_demo-related-docs` with research, data model and a checklist, `_05_demo-archived`, `_06_empty-record` and `_07_links-demo`), runs `npm install`, and **commits everything on `main`**. The commit matters: the Copilot app runs each session in a worktree cut from the default branch, so anything uncommitted is invisible to the canvas.

A `--dev` install writes each agent's Companion skills as symlinks into `.specify/extensions/companion/.specify-dev/`, and installing for the other agent repoints or wipes them. A symlink that dangles in the Copilot worktree means the agent never gets `/speckit.companion.*`: it falls back to reading `.claude/skills/...`, writes no `.spec-context.json`, and may implement the feature during specify. So the recipe turns each agent's skills into real files before installing for the next agent, then `verify-companion-skills.sh` fails the setup (exit 1, path printed) unless every `.github/skills/speckit-companion-*/SKILL.md` and `.claude/skills/speckit-companion-*/SKILL.md` resolves with `test -e`. Run it by hand on any sandbox to check it.

Opening the sandbox in VS Code installs no preset and leaves the committed `.claude/skills/speckit-*` files as `specify init` wrote them. A tree that is dirty after the window opens is a finding, and it must be clean before the canvas pass.

Any `[setup] Missing …` line is a finding before you start; fix or record it.

## Recipe: VS Code pass

### Launch

```bash
"$SKILL/launch-vscode.sh" "$SANDBOX" "$RESULTS"          # packages this checkout into $RESULTS and installs it
"$SKILL/launch-vscode.sh" "$SANDBOX" "$RESULTS" dev      # or: Extension Development Host, what docs screenshots use
```

It runs an isolated instance (`--user-data-dir`/`--extensions-dir` under `$SANDBOXES_DIR/.e2e-vscode`), so the user's own VS Code settings and extensions are never touched. Settings it writes: `speckit.aiProvider: claude`, `speckit.permissionMode: auto-approve`, `speckit.defaultWorkflow: companion`, telemetry off, workspace trust off, zoom 1, minimap and breadcrumbs off, Dark Modern.

Then: `open_application` Visual Studio Code, click the SpecKit activity-bar icon, screenshot, `shot.sh "$RESULTS" vscode sidebar-initial dark`.

### Navigation matrix

Scripted: the `nav-matrix` check. The real-window check walks rows N1 to N15 as steps `nav-n1` to `nav-n15` on demo specs it derives itself (`_00` to `_07`, the same set the `vscode-qa` recipe builds), plus `nav-links` (the Links section) and `nav-empty-record` (the tab title of a spec with no recorded activity). Each step's name says the row's expected state; expected behaviour comes from the site's spec viewer anatomy (`apps/website/src/content/docs/docs/navigate/inside-the-viewer.mdx`), so quote it in a FAIL.

### Full run, timed

Feature: `Let a reader mark any todo as starred, and add a Starred filter to the list view.`

1. `python3 "$SKILL/timing.py" mark "$RESULTS" vscode specify start` immediately before the submit.
2. Specify (the one typing step, pick one and note which in the results):
   - **Assisted (default):** `printf '%s' "<feature>" | pbcopy`, click **New Spec** (the + in the Specs view title), then ask the user: "Click the description box, press Cmd+V, and click Create." Mark start when they confirm.
   - **Headless fallback:** `cd "$SANDBOX" && claude -p "/speckit.companion.specify <feature>" --permission-mode bypassPermissions` via Bash. The run still lands in the sidebar, but record that specify did not go through the VS Code dispatch.
3. `python3 "$SKILL/timing.py" wait "$SANDBOX/specs" specify 9` (repeat the call until it returns; keep each Bash call under ten minutes), then `mark … specify end`. Find the new spec dir with `ls -t "$SANDBOX/specs" | grep -v '^_' | head -1` and set `SPEC=$SANDBOX/specs/<dir>`.
4. For `plan`, `tasks`, `implement` in order:
   - [ ] Click the spec in the sidebar, screenshot, confirm the footer's forward button names this step and the header shows the right spec
   - [ ] `mark … <step> start`, click the forward button
   - [ ] Watch the terminal the extension opens: screenshot once while running (rail spinner, timer, "Step running" footer), `shot.sh` it as `run-<step>-running`
   - [ ] `timing.py wait "$SPEC" <step> 9` until it returns, then `mark … <step> end`
   - [ ] Screenshot the settled viewer: rail check mark on the step, new document auto-opened (plan.md, tasks.md), task progress % during implement; `shot.sh` as `run-<step>-done`
   - [ ] Any stuck terminal prompt (it cannot be answered by clicks) is a FAIL finding; answer it via the headless fallback and continue
5. After implement: confirm mark-complete ran (status Completed, spec under Completed group). Open the Overview and `shot.sh` it as `run-overview` (phase timeline is the extension's own timing view).
6. Timing and capture:

```bash
python3 "$SKILL/timing.py" report "$RESULTS" vscode "$SPEC"
python3 "$REPO/apps/speckit-extension/scripts/check_capture.py" "$SPEC" > "$RESULTS/vscode-capture.txt"
```

Compare three numbers per step: wall clock (your marks), recorded span (the table), and what the viewer's Overview shows. A disagreement over ~10s or a missing span is a finding.

### Theme pass

Scripted: the `themes` check. The steps it names run in Quiet Light in the full run and again under `--theme dark`.

### Narrow panel

Scripted: the `narrow-panel` check, steps `narrow-panel-spec` and `narrow-panel-tasks`. The viewer is narrowed to about 440px; the header, the rail and the footer must stay inside the column. The rail scrolling sideways by design is reported in the note, not failed.

### Popups

Scripted for the messages the walked flows raise: the `popups` check. Then grep the files the diff changed for `showInformationMessage|showWarningMessage|showErrorMessage`. A message no scripted step raises gets one desktop check: cause it (the code says when) and assert it appears once, reads plainly, and its buttons do what they say.

### Provider dispatch

Scripted: the `provider-dispatch` check. Three buttons each reach the stand-in terminal with their command. The first-start provider picker is captured by `npm run shots`; look at `.shots/provider-picker.png` when the diff touches the providers.

### Workflow Builder

Scripted: the `builder` check, steps `builder-phase-menu`, `builder-add-step`, `builder-narrow` and `builder-move-to-phase`. The move writes to the throwaway project only; nothing is built.

### Bugs and Ideas panes

Scripted: the `process-panes` check. The install row of a workspace with neither Spec Kit extension is seen on the handoff's stock workspace part.

## Recipe: Clean profile and workspace variants

### First open

The packaged `.vsix` in a fresh profile with workspace trust on:

```bash
E2E_VSCODE_STATE=$SANDBOXES_DIR/.e2e-vscode-fresh E2E_TRUST=1 "$SKILL/launch-vscode.sh" "$SANDBOX" "$RESULTS"
```

Delete that state folder first so the profile is really clean. Assert Restricted Mode opens with no error popup and no empty view, and that the extension says what is limited, if anything is. Click **Trust**, then assert the sidebar fills and a spec opens. `shot.sh` both states. Quit the window afterwards: later checks use the default profile.

### Stock workspace

A workspace with spec-kit and no Companion:

```bash
"$SANDBOXES_REPO/new-sandbox.sh" vscode-qa-stock "e2e-$RUN-stock"     # lands at $STOCK
"$SKILL/launch-vscode.sh" "$STOCK" "$RESULTS"
```

Read every popup that appears, in full, and use its main button once. Assert each popup reads plainly and the button does what it says (for example, an install nudge installs and a dismissed one stays dismissed). `shot.sh` each popup.

### Multi-root

```bash
E2E_EXTRA_FOLDER="$STOCK" "$SKILL/launch-vscode.sh" "$SANDBOX" "$RESULTS"
```

Assert the sidebar lists specs per root without mixing them, a spec opens the right folder's document, and **New Spec** asks or targets the right root. `shot.sh` the sidebar.

## Recipe: Terminal run

In `$SANDBOX-terminal`, one small spec end to end through the CLI, timed as surface `terminal`:

```bash
cd "$SANDBOX-terminal"
python3 "$SKILL/timing.py" mark "$RESULTS" terminal specify start
claude -p "/speckit.companion.auto Let a reader mark any todo as starred, and add a Starred filter to the list view." --permission-mode bypassPermissions
python3 "$SKILL/timing.py" mark "$RESULTS" terminal mark-complete end
SPEC=$SANDBOX-terminal/specs/$(ls -t specs | grep -v '^_' | head -1)
python3 "$SKILL/timing.py" report "$RESULTS" terminal "$SPEC"
python3 "$REPO/apps/speckit-extension/scripts/check_capture.py" "$SPEC" > "$RESULTS/terminal-capture.txt"
```

Run it with `run_in_background` and wait for the exit, since the call can pass ten minutes. The wall marks cover the whole run, so the per-step figures come from the Recorded column. Assert the spec ends `completed` and `check_capture.py` passes.

## Recipe: Copilot canvas pass

1. Note the sandbox is committed: `git -C "$SANDBOX" status --short` is empty (otherwise commit; the worktree won't see it).
2. `open_application` GitHub Copilot. Add/open `$SANDBOX` as the project.

### Bare open

Open the canvas three times without editing anything: start a new session each time and type `Open the SpecKit Companion canvas`. Before and after each open `git -C "$SANDBOX" status --short` must read the same, and the board must render.

On the first open, screenshot (`shot.sh "$RESULTS" canvas board-initial dark`) and assert the board (log in `$RESULTS/canvas-checks.md`):

- [ ] Header reads SpecKit Companion and there is **no** "Stock Spec Kit commands: SpecKit Companion is not installed" hint (Companion commands detected)
- [ ] All eight fixtures (`_00` to `_07`) listed with the right status; Active/Done/All filters and search by number (`04`) work
- [ ] Click `_04`: rail, next-step button, document tabs (spec, plan, tasks with per-phase progress, research, data model, checklists) and the Activity tab render
- [ ] Click `_00` then `_02` quickly: detail shows `_02`, no content from `_00`

### Full run

Find the session's worktree: `git -C "$SANDBOX" worktree list`, and set `WT=<that path>`. Every spec the canvas run creates lives there, not in `$SANDBOX`. `SPEC` is the newest non-fixture dir under `$WT/specs` (fixtures are `_0N_…`; a new spec is numbered normally, such as `001-todo-footer-count`), the same rule `timing.py` uses.

Timed with `surface=canvas`, Companion workflow. Feature: `Show how many todos are left in the list footer.`

- [ ] `mark … canvas specify start`, click **New spec**, type the feature, submit. The chat must receive the Companion specify command in the spelling the project registers, never the stock one: `/speckit-companion-specify …` where a skill folder registers it (`.github/skills`, `.agents/skills` or `.claude/skills`, which is every sandbox built here), `/speckit.companion.specify …` where only a prompt or agent file does. The message ends with one sentence naming a run-instructions file under `.speckit-companion/prompts/`, and carries no lifecycle text itself
- [ ] `timing.py wait "$WT/specs" specify 9`, `mark … specify end`, `SPEC=$WT/specs/<newest non-fixture dir>`. The board shows the new spec without a refresh
- [ ] For plan, tasks, implement: `mark start`, click the run button, confirm the chat line is `/speckit-companion-<step> specs/<dir>` (dotted, `/speckit.companion.<step>`, without skill folders) followed by the one run-instructions sentence, `wait`, `mark end`. While it runs, screenshot the live update (rail step flips, tasks tick). `shot.sh` each as `run-<step>-running` / `-done`
- [ ] Approve any Copilot tool-permission prompts by clicking (full tier); count them in the notes, each is friction worth recording
- [ ] `timing.py report "$RESULTS" canvas "$SPEC"` and `check_capture.py "$SPEC" > "$RESULTS/canvas-capture.txt"`

Then once more with the stock workflow, however the canvas exposes the choice: New spec, and the chat must receive `/speckit-specify …` (`/speckit.specify …` without skill folders): with the same one sentence when Companion's recorder is installed, the command alone on a stock project. Only specify has to land; no timing.

Agent actions: in chat ask "what specs are still open?" and "show me the related docs spec". The board should follow (`list_specs`, `focus_spec`). Screenshot. Light shot if the app has a theme toggle; otherwise skip and say so.

## Recipe: Website pages

```bash
cd "$REPO/apps/website" && npm run preview
```

Open each changed page in a browser (the `apps/website/src/content/docs/**` paths map to `/docs/...` routes) and look: images load, no layout break, links resolve. A page the diff changed only in text still gets one look. `shot.sh` a page when it fails or is docs-worthy.

## Cleanup

- [ ] Quit the isolated VS Code instance (click its window, then the user quits it, or `pkill -f "e2e-vscode"`)
- [ ] Close the Copilot session; `git -C "$SANDBOX" worktree prune` after the app removes its worktree
- [ ] Stop the website preview if it is running
- [ ] Keep `$SANDBOX` until the report's findings are triaged, then `rm -rf "$SANDBOX" "$SANDBOX-terminal" "$STOCK"`
- [ ] `git -C $REPO status --short` shows nothing from this run (the `.vsix` went to `$RESULTS`)
