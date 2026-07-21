# Feature Specification: Fast Path Fixture

**Feature Branch**: `514-fast-path-fixture`
**Status**: Completed
**Size**: simple (fast path)

This is a committed viewer/eval fixture. It is a small change that took the Companion **fast path**: plan and tasks were folded into the specify run instead of dispatched separately. It exists so the spec viewer can be opened against a completed fast-path run and show trusted per-phase timing, and so CI's quality/capture evals have a folded-history fixture.

## User Scenarios

### A small change shows real timing (Priority: P1)

A developer makes a small change. It classifies `simple`, the fast path folds plan and tasks into specify, and the developer implements the tasks. When they open the finished spec, the timing panel counts specify, plan, tasks, and implement as measured phases with real durations and shows the elapsed time — exactly like a full run.

## Approach

Fold plan and tasks into the specify run with **extension-stamped step-level boundaries** (not AI-tagged substeps), run in order after specify's own completion, so the viewer's timing derivation trusts all three near-zero spans. Load living specs on the fast path when the touched files are known. Implement runs the tasks and records per-task progress.

## Requirements

- **FR-001**: The fold records plan and tasks as ordered, extension-stamped, step-level start+complete pairs.
- **FR-002**: A folded run derives trusted spans for specify, plan, and tasks, and reaches full timing coverage once implement completes.
- **FR-003**: The fast path loads and records living specs for the touched area.
