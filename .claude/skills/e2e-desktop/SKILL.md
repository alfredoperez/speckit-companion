---
name: e2e-desktop
description: Screenshot-driven end-to-end verification of SpecKit Companion on the real Mac, from Claude Desktop with computer use. Builds a throwaway sandbox, hunts navigation bugs in the VS Code sidebar and spec viewer, runs a full spec (specify → plan → tasks → implement) through VS Code with per-step timing, then drives the same kind of run from the GitHub Copilot app canvas, and writes a dated results folder of numbered screenshots, findings and timing tables. Use when the user says "/e2e-desktop", "run the desktop e2e", "verify the extension and the canvas end to end", or wants VS Code timing runs instead of auto mode.
compatibility: Claude Desktop with computer use (VS Code granted at click tier, GitHub Copilot at full tier), Bash, the `code` and `specify` CLIs, the Claude Code CLI signed in
metadata:
  author: alfredo
  source: repo
---

# E2E desktop run

Two surfaces, one throwaway sandbox, one results folder. Bash does every bit of setup, typing, polling and timing; computer use does the clicking and looking. Nothing here touches this repo's working tree except the throwaway `.vsix` written into the results folder.

## What each tool can do here

| App | Tier | You can | You cannot |
|---|---|---|---|
| Visual Studio Code | click | left-click, scroll, screenshot | type, press keys, right-click, drag. So no command palette, no typing in the Create Spec box, no terminal input |
| GitHub Copilot | full | everything | - |
| Browsers | read | look | click. Not needed here |

Consequences, designed in: settings are written to a file by Bash, the AI provider runs with auto-approve so its terminal never waits for a keypress, and the one piece of typing VS Code needs (the Create Spec description) is either handed to the user as a paste or done headless by Bash. Look with the computer-use `screenshot`; save evidence with `shot.sh`, which writes a real PNG to disk.

## Variables

```bash
REPO=/Users/alfredoperez/dev/GitHub/speckit-companion
SKILL=$REPO/.claude/skills/e2e-desktop
RUN=$(date +%Y-%m-%d-%H%M)
SANDBOX=$HOME/dev/projects/companion-sandboxes/e2e-$RUN
RESULTS=$HOME/dev/projects/companion-sandboxes/e2e-results/$RUN
```

Re-declare them in every Bash call; shell state does not persist.

## 0. Preflight

Run each and stop with a one-line reason on the first failure:

- [ ] `specify extension --help` works (source build of spec-kit, see `apps/speckit-extension/docs/install.md`)
- [ ] `claude --version` works and `claude -p "say ok"` answers (the VS Code provider shells out to it)
- [ ] `code --version` works
- [ ] `test -f ~/.copilot/extensions/speckit-companion/extension.mjs` (canvas loader, it imports `$REPO/apps/copilot-canvas/extension.mjs`)
- [ ] `gh api /copilot_internal/user --jq '[.copilot_plan, .chat_enabled, .copilot_app_enabled]'` shows chat enabled; a lapsed plan answers every canvas run with a 403, so stop here and say so
- [ ] `ls ~/dev/GitHub/speckit-bench/examples/todo-claude/src` (the app fixture)
- [ ] `request_access` for **Visual Studio Code** and **GitHub Copilot**; confirm the returned tiers match the table above
- [ ] `$SKILL/shot.sh /tmp/e2e-probe x probe` writes a non-empty PNG (needs Screen Recording for Claude; Accessibility makes it crop to the front window)
- [ ] Record what is under test: `git -C $REPO branch --show-current`, `git -C $REPO rev-parse --short HEAD`, `node -p "require('$REPO/package.json').version"`, `specify version | head -3`. These go in the results README.

## 1. Sandbox and results folder

```bash
mkdir -p "$RESULTS"
"$SKILL/setup-sandbox.sh" "$SANDBOX"
```

`setup-sandbox.sh` copies the `todo-claude` app from speckit-bench, runs `specify init` with the Claude integration plus Copilot, installs this checkout's spec-kit extension (`specify extension add $REPO/apps/speckit-extension --dev`) for **both** agents (so `.claude/skills/speckit-companion-*` and `.github/skills/speckit-companion-*` both exist), seeds navigation fixtures (`specs/_00…_03` copied from the repo, plus `_04_demo-related-docs` with research, data model and a checklist, and `_05_demo-archived`), runs `npm install`, and **commits everything on `main`**. The commit matters: the Copilot app runs each session in a worktree cut from the default branch, so anything uncommitted is invisible to the canvas.

Any `[setup] Missing …` line is a finding before you start; fix or record it.

## 2. VS Code pass

### 2a. Launch

```bash
"$SKILL/launch-vscode.sh" "$SANDBOX" "$RESULTS"          # packages this checkout into $RESULTS and installs it
"$SKILL/launch-vscode.sh" "$SANDBOX" "$RESULTS" dev      # or: Extension Development Host, what docs screenshots use
```

It runs an isolated instance (`--user-data-dir`/`--extensions-dir` under `~/dev/projects/companion-sandboxes/.e2e-vscode`), so the user's own VS Code settings and extensions are never touched. Settings it writes: `speckit.aiProvider: claude`, `speckit.permissionMode: auto-approve`, `speckit.defaultWorkflow: companion`, telemetry off, workspace trust off, zoom 1, minimap and breadcrumbs off, Dark Modern.

Then: `open_application` Visual Studio Code, click the SpecKit activity-bar icon, screenshot, `shot.sh "$RESULTS" vscode sidebar-initial dark`.

### 2b. Navigation matrix

For every row: do the action with clicks only, take a computer-use screenshot, assert the expected state, save a `shot.sh` only when it fails or is docs-worthy. Log each row as PASS/FAIL in `$RESULTS/nav-matrix.md` (`| # | action | expected | actual | shot |`). Expected behaviour comes from `capabilities/spec-viewer/read-a-spec.spec.md` and `move-a-spec-forward.spec.md`; quote the requirement in a FAIL.

Sidebar entry types (tree: group → spec → document → related doc):

| # | Action | Expected |
|---|---|---|
| N1 | Expand/collapse each group: Active, Completed, Archived | `_05_demo-archived` only under Archived, `_03` under Completed, the rest under Active |
| N2 | Click each spec name (`_00`…`_05`) | Viewer opens **that** spec (header name matches) on the Overview when it has a run record, else its first document |
| N3 | Expand a spec, click Spec, Plan, Tasks in turn | Same single viewer tab switches to that document; no second tab for the same spec |
| N4 | Expand `_04` → Plan → click research, data-model; then the checklist | That doc opens inside `_04`'s tab, rail highlights it under its step |
| N5 | Click spec A's Plan, then spec B's Tasks, then spec A's name | Two tabs, one per spec; the last click lands on A's Overview, not A's Plan |
| N6 | Rapid switch: click `_00`, `_01`, `_02`, `_04` names within ~2s | The focused tab ends on `_04` and shows `_04`'s content (no content from a previous spec under `_04`'s header) |
| N7 | In the viewer, click every rail entry and back to Overview | Only the document changes; status badge and footer step never change |
| N8 | Locked entry: `_00` has no plan.md | Plan entry is disabled or absent with a tooltip, never opens an empty or other spec's plan |
| N9 | File change while open: `printf '\n- extra line\n' >> "$SANDBOX/specs/_01_demo-planned/plan.md"` with `_01` Plan showing | Viewer re-renders in place with the line, same tab, same document |
| N10 | New document appears: `cp "$SANDBOX/specs/_02_demo-tasked/tasks.md" "$SANDBOX/specs/_01_demo-planned/tasks.md"` with `_01` Spec showing | Rail gains Tasks; sidebar shows it without a manual refresh |
| N11 | Doc deleted: `rm "$SANDBOX/specs/_04_demo-related-docs/research.md"` while it is showing | Viewer says the document is gone; no stale content |
| N12 | Rename: `mv "$SANDBOX/specs/_02_demo-tasked" "$SANDBOX/specs/_02_demo-renamed"` with `_02` open | Old tab closes or says the spec moved; clicking the new sidebar entry opens the renamed spec, not a stale panel |
| N13 | Complete: click Mark Completed in `_04`'s footer (or set `"status":"completed"` in its `.spec-context.json` via Bash) | Spec moves to Completed in the sidebar, the open tab's badge updates, clicking it again opens the same spec |
| N14 | Close the viewer tab, click the same sidebar document again | Opens fresh on that document, not on whatever was last shown |
| N15 | Sidebar filter/sort buttons (view title bar), then click a spec | The clicked item opens, regardless of its new position |

After the matrix, reset the sandbox fixtures: `git -C "$SANDBOX" stash -u && git -C "$SANDBOX" stash drop` (sandbox only; never run git in the repo).

### 2c. Full run through VS Code, timed

Feature: `Let a reader mark any todo as starred, and add a Starred filter to the list view.`

1. `python3 "$SKILL/timing.py" mark "$RESULTS" vscode specify start` immediately before the submit.
2. Specify (the one typing step, pick one and note which in the results):
   - **Assisted (default):** `printf '%s' "<feature>" | pbcopy`, click **New Spec** (the + in the Specs view title), then ask the user: "Click the description box, press Cmd+V, and click Create." Mark start when they confirm.
   - **Headless fallback:** `cd "$SANDBOX" && claude -p "/speckit.companion.specify <feature>" --permission-mode bypassPermissions` via Bash. The run still lands in the sidebar, but record that specify did not go through the VS Code dispatch.
3. `python3 "$SKILL/timing.py" wait "$SANDBOX/specs" specify 9` (repeat the call until it returns; keep each Bash call under ten minutes), then `mark … specify end`. Find the new spec dir with `ls -t "$SANDBOX/specs" | head -1` and set `SPEC=$SANDBOX/specs/<dir>`.
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

### 2d. Theme pass

`"$SKILL/launch-vscode.sh" theme light` (the window picks it up live). Re-shoot the docs-worthy shots with `light`: sidebar expanded, viewer on Spec, viewer on Tasks mid-implement or done, Overview. Switch back with `theme dark`.

## 3. Copilot canvas pass

1. Note the sandbox is committed: `git -C "$SANDBOX" status --short` is empty (otherwise commit; the worktree won't see it).
2. `open_application` GitHub Copilot. Add/open `$SANDBOX` as the project, start a new session, type `Open the SpecKit Companion canvas`. Screenshot; `shot.sh "$RESULTS" canvas board-initial dark`.
3. Find the session's worktree: `git -C "$SANDBOX" worktree list`. Set `WT=<that path>`. Every spec the canvas run creates lives there, not in `$SANDBOX`.
4. Board checks (assert each, log in `$RESULTS/canvas-checks.md`):
   - [ ] Header reads SpecKit Companion and there is **no** "Stock Spec Kit commands: SpecKit Companion is not installed" hint (Companion commands detected)
   - [ ] All six fixtures listed with the right status; Active/Done/All filters and search by number (`04`) work
   - [ ] Click `_04`: rail, next-step button, document tabs (spec, plan, tasks with per-phase progress, research, data model, checklists) and the Activity tab render
   - [ ] Click `_00` then `_02` quickly: detail shows `_02`, no content from `_00`
5. Full run, timed with `surface=canvas`. Feature: `Show how many todos are left in the list footer.`
   - [ ] `mark … canvas specify start`, click **New spec**, type the feature, submit. The chat must receive `/speckit.companion.specify …`, never `/speckit.specify`
   - [ ] `timing.py wait "$WT/specs" specify 9`, `mark … specify end`, `SPEC=$WT/specs/<new dir>`. The board shows the new spec without a refresh
   - [ ] For plan, tasks, implement: `mark start`, click the run button, confirm the chat line is `/speckit.companion.<step> specs/<dir>`, `wait`, `mark end`. While it runs, screenshot the live update (rail step flips, tasks tick). `shot.sh` each as `run-<step>-running` / `-done`
   - [ ] Approve any Copilot tool-permission prompts by clicking (full tier); count them in the notes, each is friction worth recording
   - [ ] `timing.py report "$RESULTS" canvas "$SPEC"` and `check_capture.py "$SPEC" > "$RESULTS/canvas-capture.txt"`
6. Agent actions: in chat ask "what specs are still open?" and "show me the related docs spec". The board should follow (`list_specs`, `focus_spec`). Screenshot.
7. Light shot if the app has a theme toggle; otherwise skip and say so.

## 4. Write-up

In `$RESULTS`:

- `README.md` — date, branch@sha, versions, sandbox path, which specify path was used, one-paragraph verdict per surface, then the two timing tables (paste from `timing.md`).
- `findings.md` — one block per finding, most severe first:

```markdown
### F<n> — <one-line symptom>
- Surface: vscode | canvas
- Severity: blocker | major | minor | cosmetic
- Steps: 1. … 2. … 3. …
- Expected: … (quote the living-spec requirement when there is one)
- Actual: …
- Evidence: shots/NN-….png
```

- `nav-matrix.md`, `canvas-checks.md`, `timing.csv`, `timing.md`, `*-capture.txt`, `shots/`.
- `docs-candidates.md` — the shot filenames good enough for docs, and which existing asset each could replace. Never copy into `docs/screenshots/`: the five README shots have their own recipe in `docs/visual-assets.md` (Dark Modern, zoom, crop) and their filenames are load-bearing; generated images come from Storybook, not from this run.

End with a short plain summary to the user: what passed, the top findings, VS Code vs canvas timing per step, and the results path.

## 5. Cleanup

- [ ] Quit the isolated VS Code instance (click its window, then the user quits it, or `pkill -f "e2e-vscode/data"`)
- [ ] Close the Copilot session; `git -C "$SANDBOX" worktree prune` after the app removes its worktree
- [ ] Keep `$SANDBOX` until findings are triaged, then `rm -rf "$SANDBOX"`
- [ ] `git -C $REPO status --short` shows nothing new from this run (the `.vsix` went to `$RESULTS`)
