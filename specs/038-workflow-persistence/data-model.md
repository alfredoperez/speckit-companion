# Data Model: Workflow Persistence

## Entities

### FeatureWorkflowContext (existing — no schema changes)

Stored in `.spec-context.json` per spec directory.

| Field | Type | Description |
|-------|------|-------------|
| workflow | string | Name of the selected workflow (e.g., "default", "quick") |
| selectedAt | string (ISO 8601) | Timestamp when workflow was selected |
| currentStep | string? | Current step name (e.g., "specify", "plan") |
| status | SpecStatus? | Spec lifecycle status ("active", "completed", "archived") |
| stepHistory | Record<string, { startedAt, completedAt }>? | Per-step timing data |

**No schema changes needed.** The `workflow` field already exists in the type definition (`types.ts:114-135`) and is already written by `saveFeatureWorkflow()`. The issue is purely that `handleSubmit()` in the spec editor never calls `saveFeatureWorkflow()`.

### WorkflowConfig (existing — no changes)

In-memory representation loaded from VS Code settings + built-in default.

| Field | Type | Description |
|-------|------|-------------|
| name | string | Workflow identifier |
| steps | WorkflowStepConfig[] | Ordered step definitions |

### State Transitions

```
Spec Editor Submit
  → [AI CLI creates spec directory]
  → File watcher detects new spec.md
  → saveFeatureWorkflow(specDir, workflowName)
  → .spec-context.json created with workflow field

Spec Viewer Open / Step Execution
  → getFeatureWorkflow(specDir) reads .spec-context.json
  → workflow field present → use it
  → workflow field absent → fallback to defaultWorkflow setting → persist
```

## Validation Rules

- `workflow` must be a non-empty string
- `workflow` name must resolve to a known workflow via `getWorkflow()` — if not, fall back to default
- `selectedAt` must be a valid ISO 8601 timestamp
