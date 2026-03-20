# Data Model: Fix Workflow Step Bugs

**Spec**: [spec.md](./spec.md) | **Date**: 2026-03-19

## Entity Changes

### WorkflowStepConfig (addition to existing type from 018)

Add optional `icon` property:

```typescript
// In src/features/workflows/types.ts (after 018 changes)
export interface WorkflowStepConfig {
    name: string;
    label?: string;
    command: string;
    file?: string;
    subFiles?: string[];
    subDir?: string;
    icon?: string;  // NEW (R006) — VS Code ThemeIcon id, e.g. "telescope"
}
```

### STEP_ICON_MAP (new constant)

```typescript
// In src/features/specs/specExplorerProvider.ts (or a shared constants file)
const STEP_ICON_MAP: Record<string, string> = {
    // Legacy document type names (used as documentType in SpecItem)
    'spec': 'chip',
    'plan': 'layers',
    'tasks': 'tasklist',

    // New flexible step names
    'specify': 'chip',
    'design': 'circuit-board',
    'implement': 'play',
    'explore': 'telescope',
    'verify': 'check-all',
    'archive': 'archive',
    'review': 'eye',
    'test': 'beaker',
    'deploy': 'rocket',
};

// Fallback icons
const DEFAULT_FILE_ICON = 'file';
const DEFAULT_ACTION_ICON = 'terminal';
```

### Icon Resolution Order

1. `step.icon` (explicit override from config) → use directly as ThemeIcon id
2. `STEP_ICON_MAP[step.name]` → use mapped icon
3. Step has file → `DEFAULT_FILE_ICON` (`file`)
4. Step has no file → `DEFAULT_ACTION_ICON` (`terminal`)

## State Transitions

### Action-Only Step Rendering

```
Step has `file` property?
  ├─ YES → Render as file-producing step (status indicator, file icon)
  └─ NO → Does `{name}.md` exist on disk?
       ├─ YES → Render as file-producing step (inferred file)
       └─ NO → Render as action-only step (play icon, no status, command dispatch on click)
```

## No Schema Changes

- `.speckit.json` format unchanged
- `package.json` settings schema: only addition is `icon` property to step items (additive, non-breaking)
- VS Code settings validation unaffected
