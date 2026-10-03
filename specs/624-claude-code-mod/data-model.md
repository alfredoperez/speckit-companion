# Data Model: SpecKit Companion mod for Claude Code

The mod introduces no stored spec data of its own. It reads the run record and the spec folder's files, runs them through the board's shared rules, and builds view models for the band, the pane and the text reply. The only thing it persists is the hand-picked spec, in its own `$.store`. Every entity below is either read-only input, a pure derivation from the shared rules (`apps/copilot-canvas/spec-rules.mjs`, bundled as `hooks/vendor/board-rules.mjs`), or a view model built in `board.js`.

## Overview

| Entity | Kind | Owner | Persisted |
|---|---|---|---|
| Run record | Input, read only | spec-kit writers | Yes, by others (`.spec-context.json`) |
| Spec folder files | Input, read only | spec-kit | Yes, by others |
| Spec directories setting | Input, read only | workspace | Yes, by others (`.vscode/settings.json`) |
| Step state | Derived | shared rules | No |
| Step timing and timing summary | Derived | shared rules (VS Code derivation) | No |
| Task, phase progress, task count | Derived | shared rules | No |
| Spec row | Derived | shared rules | No |
| Follow preference | Mod state | `register.js` | Yes, `$.store` |
| Followed spec | Derived | `register.js` + `board.js` | No |
| Band line | View model | `board.js` | No |
| Pane model | View model | `board.js` | No |
| `/spec` request and reply | Command | `register.js` + `board.js` | No |
| Shared rules bundle | Generated artifact | `build.mjs` | Yes, committed, staleness-checked |
| Demo fixture map | Generated test artifact | `build.mjs` | Yes, committed, staleness-checked |
| Plugin manifest and marketplace entry | Distribution metadata | repo | Yes, committed |

Relationships at a glance: the spec directories setting decides which folders are scanned; each folder plus its optional run record yields one spec row; the follow preference and the list of spec rows resolve to one followed spec; the followed spec's row, timing and tasks feed the band line, the pane model and the text reply.

## Run record (read only)

A spec's `.spec-context.json`. The mod reads it through `$.fs.read` and never writes it (FR-009).

| Field | Type | Used for |
|---|---|---|
| `status` | string, lifecycle status | status label, step reach, done/unfinished |
| `currentStep` | string, one of the pipeline steps | step state, timing derivation |
| `history[]` | array of entries | step state, step timing, task in flight, last activity |
| `history[].step` | string | which step an entry belongs to |
| `history[].kind` | `start` or `complete` (other kinds ignored) | step and task open/close |
| `history[].at` | ISO timestamp string | timing, last activity |
| `history[].substep` | string or absent | entries with a substep are not step level |
| `history[].task` | string task id or absent | task in flight; entries with a task are not step level |
| `specName` | string | spec title, ahead of the spec file's first heading |
| `workflow`, `branch` | string | carried on the spec row, not shown in v1 |

Validation rules:

- The file must parse as a JSON object (not an array, not a primitive). Anything else, including a half-written file, reads as no record, and the next refresh reads it again (Edge Cases).
- Fields of the wrong type are treated as absent: a non-string `status` means no status, a non-array `history` means an empty history.
- History entries without a string `step` and a string `at` are dropped before the timing derivation.

## Spec folder files (read only)

What the mod reads from a spec folder besides the record, all through `$.fs.list` and `$.fs.read`.

| Item | Source | Notes |
|---|---|---|
| Spec file | `<name>.spec.md` if the folder has one (the folder's own name preferred), else `spec.md` | first `#` heading gives a fallback title |
| `plan.md` | existence | file-only step state |
| `tasks.md` | text | tasks, phases, task count |
| File times | `$.fs.list` entries | `updatedAt`, the sort key when there is no record |

A folder counts as a spec folder when it is a non-hidden directory under a spec directory and holds at least one `.md` file or a `.spec-context.json`.

## Spec directories setting (read only)

`speckit.specDirectories` from the project's `.vscode/settings.json`, read as text and parsed by the shared rules (comments and trailing commas tolerated). Valid when it is a non-empty array; string entries containing glob characters are dropped. When absent or invalid, the defaults `specs` and `.specify/specs` apply (Edge Cases).

## Step state

One of `not-started`, `in-progress`, `completed` for each of the four pipeline steps `specify`, `plan`, `tasks`, `implement`. Computed by the shared rules, never by the mod (FR-004).

From a run record (`deriveStepBadges`):

- A step is `completed` if its history has a step-level `complete` entry, or the status puts it behind the reach point, or it sits before `currentStep`.
- Otherwise it is `in-progress` if the status names it as the step in flight, or it is `currentStep` with at least one history entry and the status is not terminal.
- Otherwise it is `not-started`.

Status reach (steps finished, step in flight):

| Status | Finished | In flight |
|---|---|---|
| `draft` | 0 | none |
| `specifying` | 0 | specify |
| `specified` | 1 | none |
| `planning` | 1 | plan |
| `planned` | 2 | none |
| `tasking` | 2 | tasks |
| `ready-to-implement` | 3 | none |
| `implementing` | 3 | implement |
| `implemented`, `completed`, `archived` | 4 | none |

Without a run record (`deriveBadgesFromFiles`): specify, plan and tasks are `completed` when their file exists; implement is `completed` when every task is checked, `in-progress` when some are, else `not-started`.

## Step timing and timing summary

Derived by the timing derivation the VS Code viewer uses, bundled into the shared rules (FR-003).

Step timing, per step present in the history:

| Field | Type | Meaning |
|---|---|---|
| `startedAt` | ISO string | the step's start |
| `completedAt` | ISO string or absent | the step's own finish; absent while in flight |
| `durationTrusted` | boolean | the span was closed by the step's own finish |
| `folded` | boolean | the step was folded into another, so it carries no time of its own |

Measured duration of a step is `completedAt - startedAt` only when `durationTrusted` is true, `completedAt` is set and `folded` is false; otherwise the step has no time (User Story 2, scenario 2). Waits between steps belong to no step.

Timing summary (`deriveTimingSummary` over the four pipeline steps):

| Field | Type | Meaning |
|---|---|---|
| `complete` | boolean | every expected step was measured |
| `elapsedMs` | number or absent | sum of measured active time |
| `measuredPhases`, `expectedPhases` | number | coverage counts |

The total active time is shown only when `complete` is true and `elapsedMs` is set; it is formatted with the shared `formatElapsed` (for example `4m`).

## Task, phase progress, task count

Parsed from `tasks.md` by the shared task rules, the same grammar as the VS Code extension.

- **Task**: `id` (`T<digits>`), `checked` (boolean), `text`, `phase` (the nearest `##` or `###` heading above it, or none).
- **Phase progress**: `name` (heading text, `Tasks` when there is none), `checked`, `total`, in the order phases first appear.
- **Task count**: `checked`, `total` across the file; `null` when there is no `tasks.md`.
- **Task in flight**: the last task id with a `start` entry in the history and no `complete` after it; `null` without a record.

Validation rules: task lines inside fenced code blocks are not counted (Edge Cases); inline code is blanked before matching; a line counts only when it is a list item with a `[ ]`, `[x]` or `[X]` box followed by a task id.

## Spec row

One spec's summary, built by the shared rules from the inputs above. It is the board's row shape, with the mod supplying text and file times instead of paths.

| Field | Type | Rule |
|---|---|---|
| `id` | string | root-relative POSIX path, such as `specs/042-export-csv` |
| `name` | string | folder name |
| `number` | string or null | leading digits of the folder name |
| `local` | boolean | folder name starts with `_` |
| `title` | string | `specName`, else the spec file's first heading without a `Feature Specification:` prefix, else `name` |
| `hasContext` | boolean | a valid run record was read |
| `status` | string or null | from the record |
| `statusLabel` | string | canonical label (`Ready to Implement`, `Completed`, ...); `No record` when there is no status |
| `currentStep` | string or null | from the record |
| `steps` | map of step to step state | record rules, or file rules without a record |
| `tasks` | task count or null | from `tasks.md` |
| `files` | spec, plan, tasks file names or null | existence |
| `done` | boolean | status is `completed` or `archived`; without a status, implement is `completed` |
| `pendingReviews` | number | review comments not yet applied |
| `lastActivity` | ISO string or null | latest `history[].at` |
| `updatedAt` | ISO string or null | newest file time `$.fs.list` reports |

Ordering: most recent first by `lastActivity`, falling back to `updatedAt` when there is no record, ties broken by folder name descending (Assumptions).

## Follow preference

The mod's only persisted state (FR-007).

| Field | Type | Rule |
|---|---|---|
| key | string | `follow:<project root>` in `$.store` |
| value | string | the followed spec's `id` |

Validation rules: written only by `/spec <query>` when the query matches a spec; deleted only by `/spec auto`; one key per project, so sessions in different projects never overwrite each other. A missing key means automatic follow.

State transitions:

```text
            /spec <query> (match)                 /spec <query> (match, other spec)
  [auto] ───────────────────────────▶ [pinned] ◀──────────────────────────────┐
     ▲                                   │  └───────────────────────────────────┘
     │            /spec auto             │
     └───────────────────────────────────┘

  /spec <query> with no match: no transition in either state.
  Another spec becoming more recent: no transition from pinned (US3, scenario 3).
  Reload or new session: state is restored from $.store.
```

## Followed spec

The spec the band and pane show, resolved from the follow preference and the current spec rows.

| Field | Type | Meaning |
|---|---|---|
| `mode` | `auto` or `pinned` | whether a follow preference is stored |
| `row` | spec row or null | the resolved spec |

Resolution rules:

1. Pinned and the stored id is among the spec rows: follow that spec.
2. Pinned but the folder is gone: fall back to the automatic pick for display; the stored key stays until `/spec auto` or another pick (Edge Cases).
3. Automatic: the most recent spec row that is not `done`, else the most recent row overall (Assumptions).
4. No spec rows at all: `row` is null and nothing is drawn (US1, scenario 4).

Refresh rules (FR-005, SC-002): the followed spec's record and `tasks.md` are re-read after each tool call and every 3 seconds, and the band and pane redraw only when their text changed. All folders are rescanned at session start, on `/spec`, and after each turn while in automatic mode.

## Band line

The single line above the prompt (FR-001). Absent when there is no followed spec.

Shape: `<spec name> · <run state>`.

Run state for an unfinished spec, parts joined with ` · `:

1. **Done part**: `<Step> done` for the last `completed` step in pipeline order. When the task count is shown and that step is `tasks`, the step before it is named instead, because the count stands in for the finished tasks step. Omitted when no step is done.
2. **Count part**: `Tasks <checked>/<total>`, shown when the task count exists and `total > 0`.
3. **Next part**: `<Step> running` for the first `in-progress` step; otherwise `<Step> next` for the first `not-started` step.

Run state for a `done` spec: `<status label>`, then `Tasks <checked>/<total>` when there are tasks, then `<total> active` when the timing summary is complete.

Examples drawn from the acceptance scenarios:

| Inputs | Run state |
|---|---|
| plan, tasks done; implement in progress; 7 of 12 checked | `Plan done · Tasks 7/12 · Implement running` |
| specify done; plan not started; no `tasks.md` | `Specify done · Plan next` |
| status `completed`; 12 of 12; every step measured, 41m total | `Completed · Tasks 12/12 · 41m active` |

## Pane model

What the pane draws for the followed spec (FR-002).

| Field | Type | Source |
|---|---|---|
| `title` | string | spec row `title` |
| `statusLabel` | string | spec row `statusLabel` |
| `steps[]` | four items in pipeline order | `name`, `state` (step state), `duration` (formatted measured time or none) |
| `total` | string or none | `<elapsed> active` when the timing summary is complete |
| `phases[]` | phase progress in order | `name`, `checked`, `total`, `tasks[]` |
| `phases[].tasks[]` | tasks in document order | `id`, `text`, `checked`, `inFlight` (equals the task in flight) |
| `picker[]` | at most 15 spec rows, most recent first | `name`, `statusLabel`, whether it is the followed spec (Assumptions) |
| `mode` | `auto` or `pinned` | followed spec mode |

Validation rule: for every demo fixture, `steps[].state`, task counts and `steps[].duration` equal what the Copilot board computes for the same folder (SC-001).

## `/spec` request and reply

The command the mod registers (FR-006, FR-008).

Request:

| Argument | Meaning |
|---|---|
| none | show the spec list |
| `auto` | delete the follow preference and follow the most recent spec |
| anything else | a query, matched by the shared `findSpec` in order: exact `id`, exact folder name, number (zero-padded, so `2` matches `002`), then case-insensitive substring of the folder name |

Outcome depends on the surface: when `$.session.surfaces()` includes `terminal` or `desktop` the pane opens (and the band updates); otherwise the reply is text.

| Request | Drawn surface | Text surface |
|---|---|---|
| bare | open the pane with the picker | followed spec name and band line, then the recent specs with their status labels |
| query, match | store the preference, redraw band and pane | `Now following <name>` with its band line |
| query, no match | short notice, nothing changes | short reply that nothing matched; followed spec unchanged |
| `auto` | delete the preference, redraw | confirm automatic follow with the resolved spec's band line |
| any, no specs in project | nothing drawn | short reply that no specs were found |

Validation rule: the command never submits a prompt or starts a turn (FR-009).

## Shared rules bundle (generated)

`apps/claude-mod/hooks/vendor/board-rules.mjs`, produced by `apps/claude-mod/build.mjs` with esbuild from `apps/copilot-canvas/spec-rules.mjs` (FR-012).

- Contents: pipeline steps, status labels and reach, `specStatusLabel`, the spec file name choice, spec directories parsing, `deriveStepBadges`, `deriveBadgesFromFiles`, task parsing (`countTaskCheckboxes`, `listTasks`, `phaseProgress`), the task in flight, `findSpec`, the spec row builder and sort key, and the timing derivation with `formatElapsed`.
- Constraints: pure functions over plain values (text, name lists, file times); no `node:` imports, no `$` calls, no imports outside the bundle.
- Relationship: `apps/copilot-canvas/specs-core.mjs` keeps the IO and re-exports these rules, and `overview.mjs` reads timing from them, so the board and the mod call the same code.
- Validation: CI rebuilds it and fails when the committed copy differs.

## Demo fixture map (generated)

`apps/claude-mod/tests/fixtures/demo-specs.js`, also written by `build.mjs`: every file under `specs/_0N_demo-*` as a map of root-relative path to text. Tests stub `$.fs.list` and `$.fs.read` from it to read a real run record (FR-011). Covered by the same CI staleness check. The demo fixtures themselves stay pinned and are never modified by the build.

## Plugin manifest and marketplace entry

| Item | Path | Fixed values |
|---|---|---|
| Plugin manifest | `apps/claude-mod/.claude-plugin/plugin.json` | name `speckit-companion`, display name `SpecKit Companion`, version `0.1.0`, homepage `https://speckit-companion.dev` |
| Hooks entry | `apps/claude-mod/hooks/hooks.json` | `{ "modules": ["./register.js"] }` |
| Marketplace | `.claude-plugin/marketplace.json` at the repo root | one plugin, source `./apps/claude-mod` |

Validation rule: the Claude Code validator passes on the plugin in strict mode and lists its hooks and calls (FR-010, SC-004).
