# Data Model: Scripted desktop QA

Four entities carry this feature: the Check in the surface map, the Step the script records, the Results file one theme produces, and the Handoff part Claude Desktop reads. The grader joins the first three; the handoff stands alone.

## Check (`.claude/skills/release-qa/surface-map.yml`)

One row of the release QA checklist, keyed by its id under `checks:`. Surfaces list check ids; the diff picks surfaces; the release runs each check id once.

| Field | Type | Kinds | Rule |
|---|---|---|---|
| `kind` | `auto`, `auto-after`, `run`, `desktop`, `scripted` | all | Required. `scripted` is new: Bash drives a real window, no eyes needed. |
| `run` | shell command | `auto`, `auto-after`, `scripted` | Required. For `scripted` it is the npm command that runs the real-window check; the grader does not run it, the release flow does. |
| `steps` | list of step names | `scripted` | Required, at least one. Each name must match a `name` the script records. The check passes only when every name passes. |
| `themes` | `both` | `scripted` | Optional. When set, every step must pass in `results.light.json` and `results.dark.json`; otherwise light alone decides. |
| `what` | sentence | `run`, `desktop`, `scripted` | Required. The checklist row text. |
| `recipe` | SKILL.md section | `run`, `desktop` | Required for those kinds. A `scripted` check has none; its step ids replace it. |
| `after` | check id | `auto-after` | Unchanged. |
| `pass`, `note` | text | any | Unchanged. |

Scripted checks (FR-011, SC-001): `themes`, `nav-matrix`, `narrow-panel`, `popups`, `provider-dispatch`, `builder` and `process-panes`. Desktop checks: `first-open`, `vscode-run`, `stock-workspace`, `multi-root`, `canvas-open`, `mod-terminal`, `canvas-new-spec` and `site-pages`. A `scripted` check without `steps` grades BLOCKED, and so does one naming a step the script never records. Neither can read PASS. The grader reads a scripted check from one line of the map, so each stays a one-line entry.

## Step (`tooling/scripts/desktop-check.mjs`)

One unit of the scripted check. `step(name, what, run, options)` records at most one entry per name per run. `--only <names>` limits the run to those names, in the same one window.

| Field | Type | Rule |
|---|---|---|
| `name` | string | Unique within a run; the id the surface map's `steps` names. |
| `what` | sentence | What the step asserts, from the spec or the recipe row. |
| `ok` | boolean | `true` when `run()` returned without throwing. A skipped step also writes `ok: true`, which is why the grader reads `skipped` first. |
| `skipped` | boolean, absent when false | `true` only under `--sandbox` for a step with `needs: 'fixtures'`. |
| `note` | string | The value `run()` returned (a count, a width, the command that reached the terminal) or the first line of the error that failed it. |
| `shot` | path, may be absent | `<name>.<theme>.png` under `.desktop-check/`; absent when the capture itself failed. |

Step options that shape the record: `needs: 'fixtures'` (skipped under `--sandbox`), `check: true` (a release QA step, left out of a `--shots` or `--record` run), `shots: true` (runs under `--shots` only, never a graded step), `record: true` (runs under `--record` only, never a graded step). Every new step carries `needs: 'fixtures'` and `check: true`. A graded step must use neither `shots` nor `record`, or its name is absent from the results and the check reads BLOCKED.

Step transitions within one run: not started, then running, then exactly one of passed (`ok: true`), failed (`ok: false`, `note` holds the reason), or skipped (`ok: true, skipped: true`). Every reached step appends to `results`, including a failed one; the run goes on to the next step.

## Results file (`.desktop-check/results.<theme>.json`)

One file per theme, a JSON array of Step records in run order. `<theme>` is `light` or `dark`; one invocation writes one file. The start-up wipe removes only `*.<theme>.png` and `results.<theme>.json` for the theme being run, so a dark run after a light run leaves both files side by side (FR-009).

| Rule | Consequence |
|---|---|
| The file is missing or unreadable for a required theme | every check needing it reads BLOCKED, note `results.<theme>.json not found in <dir>` |
| A `--only` run wrote the file | it holds only the selected names; a check naming others in that theme reads BLOCKED with `<step> (<theme>) did not run` |
| The dark run | it is `--only` the five steps the `themes` check names, and no other check reads dark, so it blocks nothing |
| Two runs of the same theme | the second replaces the first; nothing merges |

## Handoff part (`.claude/skills/release-qa/desktop-handoff.md`)

The handoff is four parts, each a lettered section of numbered steps that Claude Desktop answers one line each (`A1 PASS: ...`). In VS Code every step is a click or a look; no step asks it to type into VS Code or run a command (SC-004).

| Part | Checks it decides | Window |
|---|---|---|
| A. First open | `first-open` | the sandbox window |
| B. Stock and two roots | `stock-workspace`, `multi-root` | the stock window, then the two-roots window |
| C. One spec through VS Code's buttons, timed | `vscode-run` | the sandbox window |
| D. GitHub Copilot app | `canvas-open`, `canvas-new-spec` | the Copilot app on the sandbox project |

| Rule | Consequence |
|---|---|
| A terminal stops on a question in part C | the reply carries `C<n> QUESTION:` with the step and the exact question, the pass goes on to part D, and Claude Code answers the question from the Mac. It is never a FAIL on its own. |
| The Copilot app is out of date or signed out | part D is answered BLOCKED with the reason. |
| The grant lapses mid-pass | Claude Desktop requests access again; the handoff says so. |

The staging script opens the three VS Code windows and prints READY before the handoff is pasted. It is unchanged.

## Grading rule (`grade-scripted.py`)

The grader reads `surface-map.yml` and every `results.<theme>.json` a check needs and prints one line per `scripted` check, `<id> PASS|FAIL|BLOCKED: <note>`. The first rule that matches wins, read top to bottom.

| Condition | Verdict | Note |
|---|---|---|
| The check names no steps | BLOCKED | `the check names no steps` |
| A required `results.<theme>.json` is missing or unreadable | BLOCKED | `results.<theme>.json not found in <dir>` |
| A named step has no record in a required theme | BLOCKED | `<step> (<theme>) did not run` |
| A named step records `skipped: true` in a required theme | BLOCKED | `<step> (<theme>) was skipped` |
| A named step is not `ok: true` in a required theme | FAIL | `<step> (<theme>): <first line of the step's note>` |
| Every named step records `ok: true` without `skipped` in every required theme | PASS | `N steps ok (light)` or `N steps ok (light, dark)` |

Required themes are `light`, or `light` and `dark` when the check carries `themes: both`. Both files must exist before any step is read. Then the steps are walked in the map's order, all of light before dark, and the first one that is not a pass names the verdict. Skipped never counts as PASS: a `--sandbox` run cannot pass a check that needs the fixtures.

The exit code is 0 when every line reads PASS, 1 otherwise, and 2 when the map cannot be read, holds no scripted check, or `--check` names an id that is not a scripted check. A recheck reruns the whole real-window check and regrades, because steps build on one another.

## The throwaway project

`buildProject()` builds the one project the window opens, fresh per run and never reused, so a matrix row that writes to disk (N9 to N13) is undone by the next run. There is one variant for the check; the only other is the project with no provider set that `provider-picker` opens under `--shots`.

| Moment | What the project holds |
|---|---|
| From launch to the last existing step before the new ones | the fixture project as it always was: its specs, bugs, ideas and living specs |
| When the new steps start | `addDemoSpecs()` adds `_00_demo-specified`, `_01_demo-planned`, `_02_demo-tasked`, `_03_demo-living` from the repo and derives `_04_demo-related-docs`, `_05_demo-archived`, `_06_empty-record` and `_07_links-demo`, plus `src/App.tsx` for the Links step |
| Under `--sandbox`, `--shots` or `--record` | nothing is added; the new steps are skipped or left out |

The throwaway profile sets `terminal.integrated.confirmOnKill` and `terminal.integrated.confirmOnExit` to `never`, so a step that closes a terminal or the window never stops on a confirm dialog.
