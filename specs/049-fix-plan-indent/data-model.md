# Data Model: Fix Plan Sub-files Indentation

## Entities

No new entities. This is a bug fix in existing tree-building logic.

## Affected Data Structures

### WorkflowStepConfig (existing, unchanged)

```typescript
// src/features/workflows/types.ts
interface WorkflowStepConfig {
    name: string;
    label: string;
    command: string;
    file: string;
    subFiles?: string[];      // Explicit sub-file list
    subDir?: string;          // Directory to scan for sub-files
    includeRelatedDocs?: boolean;
}
```

### getStepSubFiles return value (changed behavior)

**Before**: Returns `subFiles` OR `subDir` contents (mutually exclusive due to early return)
**After**: Returns `subFiles` AND `subDir` contents combined

### Plan step configuration (existing, unchanged)

```typescript
{
    name: 'plan',
    label: 'Plan',
    file: 'plan.md',
    subFiles: ['research.md', 'data-model.md', 'quickstart.md'],
    subDir: 'contracts',
    includeRelatedDocs: true
}
```

## State Transitions

No state changes. The tree item `collapsibleState` is already correctly derived from `childDocs.length > 0` at line 495-497.
