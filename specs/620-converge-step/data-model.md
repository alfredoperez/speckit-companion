# Data Model: Record and show Spec Kit's converge step

The feature adds one value to an existing vocabulary and one derived state. It adds no new file, no new field in `.spec-context.json` and no new status.

## Converge step

A step name in the run record, written as `converge` wherever a step name is accepted: the `StepName` type and `STEP_NAMES` list in `specContext.ts`, both step enums in `spec-context.schema.json`, and `CANONICAL_STEPS` and `STEP_ORDER` in `spec_context.py`.

| Property | Value |
|---|---|
| Position | After `implement` in step order |
| Status | None. It owns no status, so `STEP_STATUS` no longer covers every step name |
| Role | Sub-phase of implement, resolved by `lifecycleStepFor("converge")` returning `implement` |
| Required | No. It is not an expected phase |
| Writers | The `before_converge` and `after_converge` hook commands, through the existing recorder with `--by extension` |

### Relationships

- A converge step appears in the record only as history entries and as `currentStep`. It has no entry of its own beside those.
- It belongs to implement: every reader that reasons about implement (repair pass, drift check, footer gates, reactivate, status command, doctor, quality port) reads converge as implement through `lifecycleStepFor`.
- It never owns a status. The status after a converge write is whatever it was before.

## History entries

Existing history entries gain two new shapes and nothing else changes.

| Entry | Written by | Fields that matter |
|---|---|---|
| Converge start | `before_converge` hook | `step: converge`, start marker, `by: extension`, recorder timestamp |
| Converge finish | `after_converge` hook | `step: converge`, finish marker, `by: extension`, recorder timestamp |

### Validation rules

- One start and one finish per step, as for every step. A second start or finish is ignored, so the first converge attempt is the one timed (FR-005, edge case on loops).
- A converge write is refused only when the status is `completed` or `archived`, through the `_is_more_advanced` exemption. At every other status it is accepted (FR-001, US1 scenario 5).
- A converge write never changes `status` (FR-002).
- A start moves `currentStep` to `converge`, as a start does for any step. A finish leaves `currentStep` where it is.
- A finish with no recorded start is journaled once and yields no duration.
- A duration is offered only when both ends were written by trusted writers (FR-007). An untrusted or missing end lists the step with no number.
- Records written before this change contain no converge entries and read exactly as before.

## Converge in flight (derived)

Not stored. The viewer derives it from history through `isConvergeInFlight`: a converge start exists and no converge finish follows it. It holds even when the status is `implemented`, which is why the status-based in-flight check cannot be used.

| Condition | Derived state |
|---|---|
| Converge start, no finish | In flight: the rail entry that hosts implement's progress shows the glyph, a `converge` label and a timer from the start (FR-006) |
| Converge start and finish | Finished: glyph, label and timer disappear |
| No converge entries | Not applicable: rail unchanged |

## Timing summary

`deriveTimingSummary` gains one optional phase.

- Converge is listed after Implement in the run timing, with a duration only when both ends are trusted.
- Converge is outside the expected phases (specify, plan, tasks, implement), so a run without it keeps its coverage (FR-003).
- When the expected phases are all measured, a measured converge span is added to total active time. The gap between implement's finish and converge's start counts toward no phase (FR-005, FR-008).

## State transitions

Converge adds no status transition. It moves only `currentStep` and history.

| From | Event | To |
|---|---|---|
| `implemented`, `currentStep: implement` | before hook | `implemented`, `currentStep: converge`, start entry added |
| `implemented`, `currentStep: converge` | after hook | `implemented`, `currentStep: converge`, finish entry added |
| `implemented`, `currentStep: converge` | a convergence task is closed | status stays `implemented`, `currentStep` returns to `implement`, and status names the next open task |
| `implemented`, `currentStep: converge` | mark-complete | `completed` |
| `implementing` | before or after hook | unchanged status, entry added |
| `completed` or `archived` | any converge hook | no write |

Converge appending unticked tasks does not move the spec backward. The status command alone reports the next unticked task when `currentStep` is `converge` and tasks are open (FR-009).

## Step lookups that change

- `STEP_STATUS` becomes partial over `StepName`, because converge has no entry. Callers use `lifecycleStepFor` before looking up a status.
- `STEP_ORDER` ranks converge directly after implement, so sort and position logic place it there.
- Display labels: "Converge" in the step-complete notification and the last-step label (FR-010).
- Quiet threshold: converge gets one in the quiet-run strip, matching the other read-and-think steps.
