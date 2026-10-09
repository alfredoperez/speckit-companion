# Contract: the `scripted` check kind, the scripted checks and the grader

**Feature**: 630 Scripted desktop QA | **Files**: `.claude/skills/release-qa/surface-map.yml`, `.claude/skills/release-qa/grade-scripted.py`, `.claude/skills/release-qa/SKILL.md` Step 2

## The `scripted` kind

A check of kind `scripted` is decided by the scripted real-window check (`tooling/scripts/desktop-check.mjs`), never by eyes. It carries the command that produces its evidence, the step ids that decide it, and whether it needs both themes.

```yaml
<id>: { kind: scripted, run: "npm run check:desktop", steps: [<step id>, <step id>], themes: both, what: "<one line, what the check shows>" }
```

| Key | Rule |
|---|---|
| `run` | The same command for every scripted check. The flow runs it once, not once per check. |
| `steps` | Every id must be present and ok in `results.<theme>.json`. |
| `themes` | Absent (light only) or `both`. There is no dark only. |
| `what` | The checklist row text. |

There is no `recipe` key: the step ids are how the check is reproduced. `steps` is the whole contract between the surface map and the script. A step id named here that the script does not emit grades BLOCKED, so renaming a step in the script means editing this file in the same change. The grader reads each scripted check from one line, so the entry stays in the one-line flow form above.

## The `checks:` entries

The ids keep their names, so `baseline` (`[vscode-run, terminal-run, first-open, stock-workspace, multi-root, themes]`) and every `surfaces[].checks` list stay valid.

```yaml
  # scripted: `tooling/scripts/desktop-check.mjs` drives a real VS Code window with a stand-in assistant; no eyes needed. `steps` are the step names that decide the check; `grade-scripted.py` reads them from `.desktop-check/results.<theme>.json`. `themes: both` also needs each step in the dark run.
  themes: { kind: scripted, run: "npm run check:desktop", steps: [sidebar-panes, narrow-panel-spec, narrow-panel-tasks, nav-n7], themes: both, what: "the sidebar, the viewer on Spec and Tasks at a narrow width, and the rail, in Quiet Light and in Dark Modern" }
  nav-matrix: { kind: scripted, run: "npm run check:desktop", steps: [nav-n1, nav-n2, nav-n3, nav-n4, nav-n5, nav-n6, nav-n7, nav-n8, nav-n9, nav-n10, nav-n11, nav-n12, nav-n13, nav-n14, nav-n15, nav-links, nav-empty-record], what: "sidebar and viewer navigation, rows N1 to N15, the Links section and the empty-record tab title" }
  narrow-panel: { kind: scripted, run: "npm run check:desktop", steps: [narrow-panel-spec, narrow-panel-tasks], what: "the viewer in a narrow column: header, rail and footer buttons neither clip nor overflow on Spec and on Tasks" }
  popups: { kind: scripted, run: "npm run check:desktop", steps: [create-issues-confirm, create-issues-cancel, popup-provider-changed], what: "the messages the scripted flows raise appear once and their buttons act; a message the diff touches that no step raises gets one desktop check of its own (grep the changed files for `showInformationMessage|showWarningMessage|showErrorMessage`)" }
  provider-dispatch: { kind: scripted, run: "npm run check:desktop", steps: [provider-dispatch, bug-next-step, converge-sends], what: "a footer button, Fix bug and Converge each reach the terminal with their command; the first-start provider picker is captured by `npm run shots`" }
  builder: { kind: scripted, run: "npm run check:desktop", steps: [builder-phase-menu, builder-add-step, builder-narrow, builder-move-to-phase], what: "a phase menu opens, Add step opens its form, the builder holds one column at a narrow width, Move to phase moves a node" }
  process-panes: { kind: scripted, run: "npm run check:desktop", steps: [sidebar-panes, bug-story, bug-report-tab, idea-decision, idea-assessing, new-bug], what: "the Bugs and Ideas panes list their groups, a bug opens on its Story and its raw report, ideas open decided or assessing, New Bug opens the create screen; the install row in a project without the extensions rides on the stock-workspace check" }
```

`themes` is the only check with `themes: both`; every other scripted check is graded from the light run alone. `process-panes` names only steps the script already had.

The checks that stay `desktop`, each with its `recipe`: `first-open`, `vscode-run`, `stock-workspace`, `multi-root`, `canvas-open`, `mod-terminal`, `canvas-new-spec` and `site-pages`. The handoff covers the first four and the two canvas checks.

## The QA harness surface

The script is a release surface: a change to it re-runs every check it decides.

```yaml
  - name: QA harness
    paths: ["tooling/scripts/desktop-check.mjs", "tooling/scripts/lib/**"]
    checks: [nav-matrix, themes, narrow-panel, popups, provider-dispatch, builder, process-panes]
```

`.claude/**` stays in `ignore`, so the surface map, the grader and the skill never add a check to a release on their own.

## The results the grader reads

The script writes `<out>/results.<theme>.json` (default `<out>` is `.desktop-check/` in the checkout; `--out` moves it), one array of step results in run order. Each entry is `{ name, what, ok, note, shot?, skipped? }`: `name` is the step id, `ok` is true only when the step's assertion held, `note` is the step's return value or the first line of its error, `shot` is the screenshot file, and `skipped: true` marks a step that did not run (`--sandbox` skips `needs: 'fixtures'` steps). The start-up wipe removes only the current theme's files, so a dark run after a light run leaves both files side by side; that is what `themes: both` relies on.

## The grader

```bash
python3 .claude/skills/release-qa/grade-scripted.py --map .claude/skills/release-qa/surface-map.yml --results .desktop-check [--check <id> ...]
```

`--map` is the surface map to read `checks:` from. `--results` is the folder holding `results.light.json` and, for `themes: both`, `results.dark.json`. `--check <id>` grades only that check and may be repeated; without it every scripted check is graded. The grader reads only checks of kind `scripted`, in the order the map lists them, and prints one line per check and nothing else:

```text
<id> PASS|FAIL|BLOCKED: <note>
```

Examples: `builder PASS: 4 steps ok (light)`, `themes PASS: 5 steps ok (light, dark)`, `nav-matrix FAIL: nav-n12 (light): the renamed spec opened as "Demo Tasked"`, `builder BLOCKED: results.light.json not found in .desktop-check`, `narrow-panel BLOCKED: narrow-panel-tasks (light) was skipped`.

| Exit code | When |
|---|---|
| 0 | every printed line reads PASS |
| 1 | any line reads FAIL or BLOCKED |
| 2 | the map cannot be read, it holds no scripted check, or `--check` names an id that is not a scripted check; the reason goes to stderr |

## PASS, FAIL and BLOCKED

- **PASS**: every step id the check names is present in the results file of every required theme (light, plus dark under `themes: both`), with `ok: true` and no `skipped`. The note is `N steps ok (light)` or `N steps ok (light, dark)`.
- **FAIL**: a named step is present and not ok. The note is `<step> (<theme>): <first line of the step's note>`, so the checklist row says what broke without opening the JSON. A step that passes in light and fails in dark fails the check, named with its theme.
- **BLOCKED**: the check could not be decided. The note is one of `the check names no steps`, `results.<theme>.json not found in <dir>`, `<step> (<theme>) did not run`, or `<step> (<theme>) was skipped`. A skip never counts as PASS, and a BLOCKED row never turns into PASS by rerunning the grader alone.
- Precedence: a check with no steps is BLOCKED first. A missing or unreadable results file for any required theme blocks the check before any step is read. Otherwise the grader walks the named steps in the map's order, all of light before dark, and the first step that is not a pass names the result.

## How Step 2 uses it

Before staging the handoff, Claude Code runs the light check, then the dark steps, then the grader:

```bash
cd "$REPO" && npm run check:desktop > "$RESULTS/auto/check-desktop.log" 2>&1
node tooling/scripts/desktop-check.mjs --theme dark --only sidebar-panes,narrow-panel-spec,narrow-panel-tasks,nav-n7 >> "$RESULTS/auto/check-desktop.log" 2>&1
python3 "$SKILL/grade-scripted.py" --map "$SKILL/surface-map.yml" --results "$REPO/.desktop-check" | tee "$RESULTS/scripted.txt"
```

The run opens one window for about four minutes and takes the keyboard focus, so the flow says so before starting it. The dark run names exactly the steps the `themes` check lists; the two are kept in step. Each grader line's status and note is copied into `$RESULTS/checks.md` for the check with that id, and `.desktop-check/` is copied into `$RESULTS/desktop-check/` before the next run replaces it. The script failing to start (no results file) makes every scripted row BLOCKED with the grader's note, never PASS. The handoff is staged only after the grade, and holds no check the grader covered.

`/release-qa recheck` reruns the whole real-window check, light and the dark steps, then regrades. It does not use `--only` with one check's steps, because steps build on one another.
