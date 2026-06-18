# Implementation Plan: Command-family-aware capture preamble

## Summary

The VS Code extension prepends a capture/timing preamble to every dispatched command. For `/speckit.companion.*` commands the command body already carries the full capture protocol, so the preamble duplicates it. For stock `/speckit.*` commands the preamble is the only capture source but leaves the status flip to improvisation. This change makes the preamble renderers in `src/ai-providers/promptPreamble.ts` emit a **slim** preamble (dispatch timestamp + feature dir + seed-start + next-step guard only) when wrapping a companion command, and a **full** preamble that references the modern `write-context.py --step <step> --advance --by ai` verb when wrapping a stock command. The signal is the existing `companionRecordsSteps(command)` boolean already threaded from `promptBuilder.ts`; the create-spec flow keeps its install-state signal and gets the same split. No vscode dependency is added (the renderers stay pure).

## Project Structure

```
src/ai-providers/
  promptPreamble.ts     # renderers — all edits here (slim/full split, --advance)
  promptBuilder.ts      # threads companionRecordsSteps(command) — no signal change
tests/unit/ai-providers/
  promptPreamble.spec.ts  # NEW — per-family rendering test
docs/
  capture-and-timing.md   # extend the mode-aware self-close section
CHANGELOG.md              # user-facing entry
```

**Structure Decision**: The change is confined to the two pure renderer functions and one new test file, plus docs. The `promptPreamble.ts` module is deliberately vscode-free so the bench imports the compiled JS; the edits preserve that.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS — no new config; reuses existing `aiContextInstructions` gate and `companionRecordsSteps` signal. |
| II. Spec-Driven Workflow | PASS — improves capture fidelity (slim avoids double-log; stock uses the canonical `--advance` verb). |
| III. Visual and Interactive | PASS — no UI surface; dispatch-text only. |
| IV. Modular Architecture | PASS — edits stay inside the existing pure renderer module; no new module, no vscode import. |

No violations — Complexity Tracking omitted.

## Phase 1 — Design

### Slim companion preamble shape (`renderPreamble`, companion path)

Emit, between `MARKER_OPEN`/`MARKER_CLOSE`:
1. The seed-start instruction (currentStep + in-progress status + `{ kind:"start", by:"extension", at: dispatchUtc }`) — depends on the dispatch timestamp.
2. The next-step-start guard ("Leave currentStep on `<step>` … phantom Generating <next>").
3. A one-line pointer that the command body carries the full schema/timing protocol (so a reader knows the omission is intentional, not a bug).

Drop: schema block, status lifecycle, shared rules, substep/per-task boilerplate, closing instruction prose.

### Full stock preamble (`renderPreamble` / `renderLifecycleBody`, stock path)

Unchanged structure, except `renderClosingInstruction` (stock, self-close path) references `--advance` for advancing steps and `--finish` for clarify/analyze.

### `renderClosingInstruction` `--advance` wiring

`aiSelfClosesStep(step, companionInstalled)` is true on the stock path for specify/clarify/plan/tasks/analyze. The self-close block currently tells the AI to hand-flip status + append a complete. Change it to instruct running the script: `--advance` for steps in `STEP_COMPLETED_STATUS` (specify/plan/tasks), `--finish` for clarify/analyze. This mirrors `docs/capture-and-timing.md`'s `--advance` description.

### Create-spec flow

`renderSpecifyCreationLifecyclePreamble` calls `renderLifecycleBody(...)`, which already varies by `companionInstalled`. Apply the slim/full split inside `renderLifecycleBody` so the create flow inherits it via its install-state boolean.
