# Contract: Per-family preamble shape

The renderers in `src/ai-providers/promptPreamble.ts` produce these observable shapes. The test in `tests/unit/ai-providers/promptPreamble.spec.ts` asserts them.

## Companion command dispatch (slim)

`renderPreamble(step, specDir, dispatchUtc, /*companionInstalled*/ true)` MUST:
- contain the dispatch timestamp (`dispatchUtc`).
- contain the feature dir / target (`<specDir>/.spec-context.json`).
- contain the next-step-start guard (the "Leave currentStep on" / phantom-generating language).
- NOT contain the full shared protocol prose — specifically NOT the JSON Schema block (`"required": ["workflow"`), NOT the status lifecycle table (`Canonical statuses: draft →`), NOT the shared-rules `AUTHORSHIP:` / `TASK SUMMARIES` prose.

## Stock command dispatch (full)

`renderPreamble(step, specDir, dispatchUtc, /*companionInstalled*/ false)` for `plan` MUST:
- contain the full protocol (schema block, status lifecycle, shared rules).
- reference `--advance` (e.g. `--step plan --advance --by ai`) in the closing instruction.

For `clarify` (finish-only) it MUST reference `--finish` and MUST NOT reference `--advance`.

## Create-spec flow

`renderSpecifyCreationLifecyclePreamble(workflow, specDir, dispatchUtc, companionInstalled)`:
- `companionInstalled = true` → slim lifecycle body (no duplicated protocol prose).
- `companionInstalled = false` → full lifecycle body.
