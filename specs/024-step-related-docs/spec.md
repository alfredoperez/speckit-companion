# Spec: Step-Scoped Related Documents

**Slug**: 024-step-related-docs | **Date**: 2026-03-26

## Summary

Currently, related documents (e.g., `research.md`) discovered via recursive directory scanning have no `parentStep` and appear as tabs under every workflow step. Since the Specify step only produces `spec.md`, showing Research there is misleading. Related documents should be assignable to specific steps so each step only shows its relevant tabs.

## Requirements

- **R001** (MUST): Related documents discovered without a `parentStep` must be assigned to a step rather than shown under all steps. The assignment mechanism should be configurable per workflow step.
- **R002** (MUST): The `WorkflowStepConfig` must support a `relatedFiles` property — an array of glob patterns or filenames that declares which related docs belong to that step.
- **R003** (MUST): In the default workflow, `research.md` must be assigned to the `plan` step, not `specify`.
- **R004** (SHOULD): Orphan related docs (not matched by any step's `relatedFiles`) should fall back to the last non-actionOnly step, keeping current behavior for unconfigured workflows.
- **R005** (SHOULD): The `subFiles` property already exists in the schema — unify or clearly differentiate it from `relatedFiles` to avoid confusion.

## Scenarios

### Step shows only its related docs

**When** user views the Specify step
**Then** only related docs assigned to `specify` appear as tabs (Overview only if no related files configured)

### Plan step shows research

**When** user views the Plan step and `research.md` exists
**Then** Overview and Research tabs are shown

### Custom workflow with relatedFiles

**When** a custom workflow step declares `relatedFiles: ["research.md", "notes.md"]`
**Then** those files appear as tabs only under that step

### Orphan docs fallback

**When** a related doc exists but no step claims it via `relatedFiles`
**Then** it appears under the last non-actionOnly step (backward compatible)

## Out of Scope

- Drag-and-drop reordering of tabs
- Creating related files from the UI
- Per-file visibility toggles
