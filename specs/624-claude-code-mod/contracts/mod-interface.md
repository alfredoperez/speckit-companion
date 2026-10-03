# Contract: SpecKit Companion mod interface

The surfaces a user, a test, or the Copilot board codes against. Everything is read only: the mod never submits a prompt, starts a turn, or writes a spec file or run record (FR-009).

## Plugin manifest

`apps/claude-mod/.claude-plugin/plugin.json`:

| Field | Value |
|---|---|
| `name` | `speckit-companion` |
| `displayName` | `SpecKit Companion` |
| `version` | `0.1.0` |
| `homepage` | `https://speckit-companion.dev` |

`apps/claude-mod/hooks/hooks.json` is `{ "modules": ["./register.js"] }`. Every `$` call lives in `hooks/register.js`; `hooks/board.js` and `hooks/vendor/board-rules.mjs` are pure and imported by relative path.

## Marketplace file

`.claude-plugin/marketplace.json` at the repository root lists one plugin:

| Field | Value |
|---|---|
| `plugins[0].name` | `speckit-companion` |
| `plugins[0].source` | `./apps/claude-mod` |
| `plugins[0].version` | `0.1.0` |
| `plugins[0].homepage` | `https://speckit-companion.dev` |

The file's own `name` is the `<marketplace-name>` in the install line. Install:

```
claude plugin marketplace add alfredoperez/speckit-companion
claude plugin install speckit-companion@<marketplace-name>
```

Both files pass the Claude Code validator in strict mode (FR-010, SC-004).

## The `/spec` command

One command, `/spec`. The argument is trimmed; matching uses `findSpec` (below).

| Form | Effect | Reply where something draws | Reply where nothing draws |
|---|---|---|---|
| `/spec` | none | opens the pane on its spec picker (15 most recent) | the followed spec's name and band line, then the recent specs, one line each with their status label |
| `/spec <number>` e.g. `/spec 042`, `/spec 2` | follows the matching spec, stores it | opens the pane on that spec | `Following <spec name>` and its band line |
| `/spec <folder name>` e.g. `/spec 042-export-csv` | same | same | same |
| `/spec <partial name>` e.g. `/spec export-csv` | same | same | same |
| `/spec auto` | deletes the stored pick, follows the most recently active spec | opens the pane on that spec | `Following the most recent spec: <spec name>` and its band line |
| `/spec <no match>` | none, the followed spec does not change | `No spec matches "<query>"` | `No spec matches "<query>"` |
| `/spec` in a project with no spec folders | none | `No specs found` | `No specs found` |

"Something draws" means `$.session.surfaces()` includes `terminal` or `desktop`.

The hand-picked spec is stored in `$.store` under the key `follow:<project root>` and survives reloads and sessions until `/spec auto` (FR-007). If the stored folder no longer exists, the mod follows the most recent spec. The default pick is the most recently active unfinished spec, else the most recent spec overall.

## The band line

Drawn above the prompt as `<spec name>` followed by the state line. Parts are joined with ` · ` (space, U+00B7, space). Step names are capitalised (`Specify`, `Plan`, `Tasks`, `Implement`).

| Run state | State line |
|---|---|
| A step in flight, task list present | `<last done step> done · Tasks <checked>/<total> · <step in flight> running` |
| A step in flight, no task list | `<last done step> done · <step in flight> running` |
| Nothing in flight, not finished | `<last done step> done · <next step> next` (with `Tasks <checked>/<total>` in the middle when a task list exists) |
| Finished (`completed` or `archived`) | `<status label> · Tasks <checked>/<total> · <total> active`, the last part only when every step was measured |
| Nothing started yet | `<next step> next` |
| No spec folders | nothing is drawn |

When the task count is shown, the tasks step is not also named as done, so the last done step before implement reads `Plan`. Examples: `Plan done · Tasks 7/12 · Implement running`, `Specify done · Plan next`, `Completed · Tasks 12/12 · 41m active`.

## The pane

Pane id `speckit-companion`, title `SpecKit Companion`. It shows the followed spec's title and status label, the four steps (`specify`, `plan`, `tasks`, `implement`) with their badge and measured time, the total active time, and the task list grouped by phase with the task in flight marked. A step with no trusted measured span shows no time. The pane opens at session start when a spec is followed and something draws, and on `/spec`.

Refresh: the followed spec's `.spec-context.json` and `tasks.md` are re-read after each tool call and every 3 seconds, redrawing only when the text changed; every folder is rescanned at session start, on `/spec`, and after each turn while following automatically.

## Shared rules: `apps/copilot-canvas/spec-rules.mjs`

Pure functions, no `node:` imports and no IO. `specs-core.mjs` and `overview.mjs` import them for the board; `apps/claude-mod/build.mjs` bundles them with esbuild into `apps/claude-mod/hooks/vendor/board-rules.mjs` for the mod. CI fails when the bundle or `apps/claude-mod/tests/fixtures/demo-specs.js` is stale (FR-012).

| Export | Signature | Returns |
|---|---|---|
| `PIPELINE_STEPS` | constant | `['specify', 'plan', 'tasks', 'implement']` |
| `DEFAULT_SPEC_DIRS` | constant | `['specs', '.specify/specs']` |
| `specStatusLabel` | `(status) => string` | the canonical label, `No record` when status is empty |
| `parseSpecContext` | `(text) => object \| null` | the parsed run record, `null` when missing, malformed, or not an object |
| `pickFeatureSpecName` | `(folderName, fileNames) => string` | the folder's own `<name>.spec.md`, else the first `*.spec.md`, else `spec.md` |
| `deriveStepBadges` | `(ctx) => { specify, plan, tasks, implement }` | `not-started \| in-progress \| completed` per step, from the run record |
| `deriveBadgesFromFiles` | `(files, tasks) => { specify, plan, tasks, implement }` | the same badges read off which files exist, for a folder with no record |
| `countTaskCheckboxes` | `(text) => { checked, total }` | task counts, ignoring lines inside code fences |
| `listTasks` | `(text) => Array<{ id, checked, phase, text }>` | every task in document order with its phase heading |
| `phaseProgress` | `(tasks) => Array<{ phase, checked, total }>` | per-phase counts |
| `currentTask` | `(ctx) => string \| null` | the task started in the history and not finished since |
| `phaseTimings` | `(ctx) => { phases, totalMs, complete }` | each step's trusted duration in ms (or `null`), the sum of measured active time, and whether every step was measured; derived with `deriveStepHistory` and `deriveTimingSummary` |
| `formatElapsed` | `(ms) => string` | e.g. `4m`, `1h 12m` |
| `buildSpecRow` | `({ id, ctx, specFile, specText, files, tasksText, updatedAt }) => SpecRow` | the board's row for one folder |
| `sortSpecs` | `(rows) => SpecRow[]` | most recently active first: last history `at`, else `updatedAt`, then name |
| `findSpec` | `(rows, query) => SpecRow \| null` | match by id, folder name, number (zero padded), then case-insensitive substring |

`SpecRow` keeps the shape `scanSpec` returns today: `id`, `name`, `number`, `local`, `title`, `workflow`, `branch`, `hasContext`, `status`, `statusLabel`, `currentStep`, `steps`, `tasks`, `files`, `done`, `pendingReviews`, `lastActivity`, `updatedAt`. `specs-core.mjs` keeps exporting `specStatusLabel`, `deriveStepBadges`, `deriveBadgesFromFiles`, `findSpec`, `PIPELINE_STEPS` and `DEFAULT_SPEC_DIRS` by re-export, so existing canvas imports and tests do not change.

## Mod view logic: `apps/claude-mod/hooks/board.js`

Pure, imported by `register.js` and tested in `tests/board.test.ts`.

| Export | Signature | Returns |
|---|---|---|
| `bandLine` | `(row, timings) => string \| null` | the state line above, `null` when there is no row |
| `paneModel` | `(row, ctx, tasksText) => object` | title, status label, steps with badge and time, total, phases with tasks and the in-flight task |
| `listText` | `(followed, rows) => string` | the text reply for bare `/spec` where nothing draws |
| `defaultFollow` | `(rows) => SpecRow \| null` | the most recent unfinished row, else the most recent row |
