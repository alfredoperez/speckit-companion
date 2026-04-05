# Research: Fix Plan Sub-files Indentation

## Root Cause Analysis

**Decision**: The bug is an early-return logic error in `getStepSubFiles()` at `src/features/specs/specExplorerProvider.ts:376-411`.

**Rationale**: When a workflow step has BOTH `subFiles` AND `subDir` properties (like the Plan step), the method returns early after processing `subFiles` (line 377-385) and never reaches the `subDir` block (line 387-408). The Specification step works correctly because it only uses `subDir: 'checklists'` — no early return.

**Alternatives considered**:
- The tree rendering logic (`getChildren`, `getRelatedDocItems`) is correct — children display properly when provided
- The `getSpecDocuments` assembly logic (line 494) is correct — it combines `subFiles` + `relatedForStep`
- The issue is solely in `getStepSubFiles()` not combining both sources

## Code Flow

1. `getSpecDocuments()` (line 416) iterates workflow steps
2. For Plan step, calls `getStepSubFiles(specFullPath, planStep)` (line 480)
3. `getStepSubFiles()` finds `subFiles: ['research.md', 'data-model.md', 'quickstart.md']` → returns early
4. `contracts/` directory contents never scanned
5. `childDocs` at line 494 is incomplete → tree shows incomplete children

## Fix Approach

**Decision**: Modify `getStepSubFiles()` to collect results from BOTH `subFiles` and `subDir`, then return the combined array.

**Rationale**: Minimal change, addresses the exact bug, preserves all existing behavior for steps that use only one source.

**Alternatives considered**:
- Restructuring the workflow config to put everything in `subFiles` — rejected because `subDir` provides dynamic scanning of directory contents
- Adding a separate method for `subDir` — rejected as unnecessary complexity; combining in one method is cleaner
