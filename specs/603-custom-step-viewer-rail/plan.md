# Implementation Plan: A step you add appears in the spec viewer

**Branch**: `603-custom-step-viewer-rail` | **Date**: 2026-09-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification at `specs/603-custom-step-viewer-rail/spec.md`

## Summary

A project can already add a step of its own by writing `.specify/companion/nodes/<step>/`, and the spec-kit half already treats that directory as the declaration — it builds the command, and `known_steps()` accepts a run of it into the recorded history. The VS Code half never looks: `COMPANION_WORKFLOW` in `src/features/workflows/workflowManager.ts` is a literal five-entry array, so the rail, the sidebar, the footer and the timing denominator all draw a pipeline that is missing the step.

The approach is to read the project's step directories in TypeScript and splice the placed ones into the Companion pipeline at one place, then have every surface resolve its pipeline through that one place. A new `src/features/workflows/projectSteps.ts` scans `.specify/companion/nodes/*/`, reads a step's placement from its `_order.yml` `after:` key, its label from `_frame.md`, and its produced document from a node's `writes:` key, and returns ordinary `WorkflowStepConfig` entries. The two copies of `resolveWorkflowSteps` that exist today — one in `specViewerProvider.ts`, one in `specExplorerProvider.ts` — collapse into a single exported resolver that applies the splice. Because the added steps arrive as normal `WorkflowStepConfig`, the timing denominator, the footer label, and the forward walk pick them up with no change of their own.

Three guards that already exist for other reasons would misfire once the Companion pipeline stops being a fixed literal, and they are part of this change: the built-in-workflow detector in `customWorkflowProgress.ts` would classify a spliced pipeline as user-defined and switch it to file-presence progression (which FR-009 forbids), and the two hardcoded lifecycle-step sets in `messageHandlers.ts` and `specCommands.ts` would refuse to record a start for the added step.

No new dependency, no new language, no new storage. Reading is plain `fs` against three small text files; the existing `**/.specify/**/*` watcher already drives the refresh.

## Project Structure

```
src/features/workflows/
├── projectSteps.ts            # NEW — read .specify/companion/nodes/*/, produce WorkflowStepConfig[]
├── pipelineResolution.ts      # NEW — the one shared resolveWorkflowSteps both surfaces call
├── workflowManager.ts         # COMPANION_WORKFLOW stays the shipped base; splice happens above it
└── types.ts                   # WorkflowStepConfig — unchanged

src/features/spec-viewer/
├── specViewerProvider.ts      # delete the local resolveWorkflowSteps, call the shared one
└── messageHandlers.ts         # lifecycle-step predicate reads the resolved pipeline

src/features/specs/
├── specExplorerProvider.ts    # delete the local resolveWorkflowSteps, call the shared one
├── specCommands.ts            # same lifecycle-step predicate
└── customWorkflowProgress.ts  # a spliced Companion pipeline stays built-in

tests/                         # or src/features/**/__tests__ — follow the neighbouring file
```

**Structure Decision**: The reading and the splicing live under `src/features/workflows/`, which is where the pipeline is already defined and validated, rather than in either consuming surface. That is what makes FR-006 structural instead of a convention: neither provider can derive its own list because neither one holds the code any more.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS — the step directory the project already writes becomes the configuration surface, and nothing is added to VS Code settings. FR-002 and SC-005 are exactly this principle. |
| II. Spec-Driven Workflow | PASS — the recorded history stays the only evidence a step ran; the change adds no file-presence inference and explicitly guards the one place that would have introduced it. |
| III. Visual and Interactive | PASS — the whole point is that the rail draws what the run does, with the added step clickable and its document openable. |
| IV. Modular Architecture for Complex Features | PASS — one new focused module for reading, one for resolution; two duplicated resolvers are deleted rather than a third added. |
| AI Provider Integration | PASS — an added step dispatches `speckit.companion.<name>` through the same command path as the shipped four, so provider formatting is untouched. |
| User Interface | PASS — no new panel, no new setting, no new label field. |

No violations, so there is no Complexity Tracking table.

## Phase 0 — Research

See [research.md](./research.md). Five decisions: read the step directory in TypeScript rather than shelling out to `pipeline-graph.py`; splice above `COMPANION_WORKFLOW` rather than editing it; no cache; detect a built-in pipeline by its command family; and derive the lifecycle-step predicate from the resolved pipeline rather than from a hardcoded set.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md) — the project step as it is read off disk, and how it becomes a `WorkflowStepConfig`.
- [contracts/project-steps.ts](./contracts/project-steps.ts) — the module surface both providers code against, with every identifier the spec pinned.

Constitution re-checked against the final design: still all PASS, same reasoning.
