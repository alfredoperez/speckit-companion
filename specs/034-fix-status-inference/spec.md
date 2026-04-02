# Spec: Fix Status Inference Ignoring Explicit Status

**Slug**: 034-fix-status-inference | **Mode**: Minimal | **Date**: 2026-04-02

## Change

`inferContextFromState` in `specContextManager.ts` computes spec status from heuristics (step/substep analysis) but ignores an explicit `status` field in the `.spec-context.json`. When the SDD pipeline writes `"status": "completed"` with a non-matching substep like `"commit-review"`, the spec incorrectly appears as Active.

## Requirements

- **R001** (MUST): When `.spec-context.json` contains an explicit `status` field, use it directly instead of inferring from step/substep heuristics
- **R002** (MUST): Existing specs without an explicit `status` field must continue to work via heuristic inference (no regression)

## File

| File | Change |
|------|--------|
| `src/features/specs/specContextManager.ts` | Check for explicit `status` field at the top of `inferContextFromState` before running heuristic inference |
