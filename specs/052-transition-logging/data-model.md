# Data Model: Transition Logging

## Entities

### TransitionEntry

Represents a single workflow step change recorded in `.spec-context.json`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `step` | `string` | yes | Target step name (e.g., "plan", "tasks") |
| `substep` | `string \| null` | yes | Target substep or null |
| `from` | `TransitionFrom \| null` | yes | Previous state, or null for initial creation |
| `by` | `"extension" \| "sdd" \| string` | yes | Source actor that triggered the transition |
| `at` | `string` (ISO 8601) | yes | Timestamp of the transition |

### TransitionFrom

Previous step/substep state before a transition.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `step` | `string \| null` | yes | Previous step name, or null if no previous step |
| `substep` | `string \| null` | yes | Previous substep, or null |

### TransitionCache (in-memory only)

Map keyed by spec directory path for detecting external changes.

| Field | Type | Description |
|-------|------|-------------|
| key | `string` | Absolute path to spec directory |
| value | `{ step: string \| undefined, substep: string \| null \| undefined }` | Last-known state |

## Schema Changes

### FeatureWorkflowContext (updated)

Add to existing interface in `src/features/workflows/types.ts`:

```typescript
/** Append-only log of workflow step transitions */
transitions?: TransitionEntry[];
```

### NavState (updated)

Add to existing interface in `src/features/spec-viewer/types.ts`:

```typescript
/** Transition history for rendering in spec viewer */
transitions?: TransitionEntry[];
/** Ordered step names for backtracking detection */
workflowStepOrder?: string[];
```

## Validation Rules

- `transitions` array is append-only; existing entries MUST NOT be modified or removed
- `from` is `null` only for the very first transition (file creation)
- `by` is always `"extension"` for extension-written transitions
- `at` is always a valid ISO 8601 timestamp
- No transition entry is appended when `step` and `substep` are unchanged

## State Transitions

```
No file → create file → transition { from: null, step: X, by: "extension" }
Step A → Step B (by extension) → transition { from: { step: A }, step: B, by: "extension" }
Step A → Step B (by SDD) → transition { from: { step: A }, step: B, by: "sdd" }
Step B → Step A (backtrack) → transition { from: { step: B }, step: A, by: "..." } [highlighted orange]
Same step → no-op → no transition appended
```
