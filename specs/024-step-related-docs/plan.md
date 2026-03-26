# Plan: Step-Scoped Related Documents

**Spec**: [spec.md](./spec.md) | **Date**: 2026-03-26

## Approach

The type system already has `includeRelatedDocs` on `WorkflowStepConfig` and `subFiles` for explicit file lists — but the document scanner ignores both when assigning `parentStep` to recursively discovered docs. The fix wires these existing properties into the scanner so orphan related docs get assigned to the correct step, then tightens the navigation filter to stop showing unassigned docs under every step. No new type properties needed.

## Files

### Modify

| File | Change |
|------|--------|
| `src/features/spec-viewer/documentScanner.ts` | After recursive scan (line ~221-256), assign `parentStep` to orphan related docs: first match against each step's `subFiles` list, then assign remaining orphans to the step with `includeRelatedDocs: true`, finally fall back to last non-actionOnly step |
| `src/features/spec-viewer/html/navigation.ts` | Remove `!d.parentStep` passthrough on line 73-74 so only docs with an assigned `parentStep` appear as tabs for a step |
| `src/features/workflows/workflowManager.ts` | Add `includeRelatedDocs: true` to the `plan` step in `DEFAULT_WORKFLOW` so research.md (and other orphans) appear under Plan by default |
| `package.json` | Add `includeRelatedDocs` boolean property to the workflow step schema under `speckit.customWorkflows` so custom workflows can use it |

## Risks

- **Existing custom workflows without `includeRelatedDocs`**: Orphan docs would disappear if no step claims them. Mitigated by the last-step fallback in the scanner — if no step has the flag, orphans go to the last non-actionOnly step (preserving current behavior).
