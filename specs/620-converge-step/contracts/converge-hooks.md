# Contract: converge hooks, run record and viewer identifiers

The feature exposes three interfaces a consumer or test codes against: two spec-kit hook commands, the writer calls they run, and the run-record and viewer shapes that result. It adds no API, no CLI flag and no schema field beyond the new step name.

## Hook commands

Registered in `apps/speckit-extension/extension.yml`, one command file each under `apps/speckit-extension/commands/`.

| Hook | Command | Command file | Records |
|---|---|---|---|
| `before_converge` | `speckit.companion.before-converge` | `speckit.companion.before-converge.md` | converge start |
| `after_converge` | `speckit.companion.after-converge` | `speckit.companion.after-converge.md` | converge finish |

Both follow the shape of `speckit.companion.after-plan.md`: state-writing only, `python3 --version` prerequisite, graceful degradation, never fail the host converge command.

Both commands are also listed in the extension README hook table, in `docs/commands.md`, and in the committed `.specify/extensions/.registry` (the set `check-command-emissions.py` checks).

## Writer calls

Run from the repository root.

Before hook:

```bash
python3 .specify/extensions/companion/scripts/write-context.py --step converge --kind start --by extension
```

After hook:

```bash
python3 .specify/extensions/companion/scripts/write-context.py --step converge --kind complete --by extension
```

Neither call passes `--status`. Converge owns no status. Each accepts `--feature-dir specs/<NNN>-<slug>` as the first argument when the feature directory is known; otherwise the script resolves it in the usual order (`--feature-dir`, `SPECIFY_FEATURE_DIRECTORY`, `SPECIFY_FEATURE`, `.specify/feature.json`, git branch prefix).

Behaviour:

- Idempotent: a re-fired hook never adds a second start or finish. The record keeps one start and one finish per step.
- If `python3` is missing, print `[companion] Warning: python3 not detected; skipped .spec-context.json capture` and skip.
- If no spec resolves, warn on stderr, exit 0, write nothing.
- If the spec is at `completed` or `archived`, write nothing.
- A finish with no recorded start journals one finish and offers no duration.

## Run-record shape

`converge` is a valid step name, placed after `implement` in the step order, in all three places that must agree: `STEP_NAMES` in `apps/vscode/src/core/types/specContext.ts`, both step enums in `apps/vscode/src/core/types/spec-context.schema.json`, and `CANONICAL_STEPS` and `STEP_ORDER` in `apps/speckit-extension/scripts/spec_context.py`.

History entry appended by each call:

```json
{ "step": "converge", "substep": null, "kind": "start", "by": "extension", "at": "<ISO 8601 timestamp>" }
```

```json
{ "step": "converge", "substep": null, "kind": "complete", "by": "extension", "at": "<ISO 8601 timestamp>" }
```

Effects on the record:

| Field | After start | After finish |
|---|---|---|
| `currentStep` | `"converge"` | `"converge"` |
| `status` | unchanged | unchanged |
| `history[]` | +1 entry, `kind: "start"` | +1 entry, `kind: "complete"` |

`lifecycleStepFor("converge")` returns `"implement"`; every reader that reasons about the lifecycle uses it, so a record whose `currentStep` is `converge` keeps implement's footer gates, status-command behaviour and repair behaviour.

Reader behaviour a test can pin:

- Footer on a record at `implemented` ending in a converge start and finish: Mark Completed and Archive offered, no forward button, no Regenerate for converge.
- Reconciler on the same record: returns no repair, logs no current-step mismatch warning.
- `status-context.py` with `currentStep` `converge` and open tasks, even at `implemented`: next action is the next unticked task. With implement as current step at `implemented` it still reports "Pipeline complete".
- Step-complete notification: `Spec NNN · Converge complete`. Last-step label: `Converge`.
- Mark-complete succeeds and moves the spec to `completed`.

## Viewer identifiers

Host entry: the StepTab that already carries implement's progress.

| Identifier | When shown | Content |
|---|---|---|
| `.step-status__sync` | converge started and not finished, status `implemented` or otherwise | in-flight glyph |
| `.step-tab__substep` | same | text `converge` |
| elapsed timer | same | counts from converge's recorded start |

All three disappear once the finish is recorded. In-flight is detected from history (a converge start with no finish after it) by `isConvergeInFlight` in `apps/vscode/webview/src/spec-viewer/stepInFlight.ts`, not from status.

Overview timing:

- Lists `Converge` after `Implement`.
- Shows a duration only when both ends are trusted (written by `--by extension` or another trusted writer); otherwise `Converge` is listed with no number.
- A record with no converge entries renders exactly as before: no `Converge` entry, timing coverage unchanged.
- Converge is not an expected phase, so it does not enter timing coverage. A measured converge span is added to total active time once the expected phases are all measured. Time between implement's finish and converge's start counts toward no phase.

The viewer gains no button or menu entry that starts converge.

## Storybook

`StepTab.stories.tsx` and `ActivityPanel.stories.tsx` each carry a story showing converge in flight on the rail and a Converge phase in the Overview timing.
