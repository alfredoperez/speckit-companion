# Data Model: Plan Step Highlight and Sub-menu Ordering

**Feature Branch**: `001-plan-step-highlight`
**Created**: 2026-01-02

## Entities

### SpecInfo

The central data structure containing all state for the workflow editor.

| Field | Type | Description |
|-------|------|-------------|
| `currentPhase` | `number (1-4)` | Current workflow phase: 1=Spec, 2=Plan, 3=Tasks, 4=Done |
| `completedPhases` | `number[]` | Array of completed phase numbers |
| `phaseIcon` | `string` | Emoji icon for current phase |
| `progressPercent` | `number` | Overall progress percentage |
| `taskCompletionPercent` | `number` | Percentage of completed tasks (0-100) |
| `specDir` | `string` | Absolute path to the spec directory |
| `documentType` | `'spec' \| 'plan' \| 'tasks' \| 'other'` | Type of current document |
| `enhancementButton` | `EnhancementButton \| null` | Optional enhancement action button |
| `nextPhaseExists` | `boolean` | Whether next phase file exists |
| `currentFileName` | `string` | Name of current file (e.g., "research.md") |
| `allDocs` | `RelatedDoc[]` | All related documents for tab display |

**Validation Rules**:
- `currentPhase` must be 1-4
- `documentType` for plan sub-sections (research.md, data-model.md, etc.) must be `'plan'`
- `allDocs` must have Plan.md first when it exists

### RelatedDoc

Represents a document tab in the sub-menu.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Display name (e.g., "Plan", "Research", "Data Model") |
| `fileName` | `string` | File name (e.g., "plan.md", "research.md") |
| `path` | `string` | Absolute file path |

**Validation Rules**:
- `name` should be formatted with capitalized words separated by spaces
- Plan.md must appear first in the array, followed by others alphabetically

### EnhancementButton

Optional action button shown in the workflow editor.

| Field | Type | Description |
|-------|------|-------------|
| `label` | `string` | Button text (e.g., "Clarify", "Checklist") |
| `command` | `string` | Command to execute (e.g., "clarify", "checklist") |
| `icon` | `string` | Icon character or emoji |
| `tooltip` | `string` | Hover tooltip text |

## State Transitions

### Phase State Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Document Navigation                      │
└─────────────────────────────────────────────────────────────┘

  spec.md ──────────┬──────────── plan.md ──────────┬──────────── tasks.md
                    │                                │
                    │   ┌─────────────┐             │
                    └───│ research.md │             │
                        │ data-model.md│            │
                        │ quickstart.md│            │
                        │ contracts/   │            │
                        └─────────────┘             │
                               │                    │
                               ▼                    ▼
                    All show currentPhase=2    currentPhase=3
                    Plan step highlighted      Tasks step highlighted
```

### Step Highlight State

| State | CSS Class | Visual |
|-------|-----------|--------|
| Active | `.step.active` | Blue ring with glow |
| Completed | `.step.completed` | Green checkmark |
| In Progress | `.step.in-progress` | Partial indicator (Done step only) |
| Pending | (no class) | Gray/muted number |

### Tab Active State

| State | CSS Class | Visual |
|-------|-----------|--------|
| Active Tab | `.doc-tab.active` | Highlighted background |
| Inactive Tab | `.doc-tab` | Default background |

## Ordering Rules

### Sub-menu (Tab) Ordering

1. **Priority Item**: `plan.md` always appears first (if it exists)
2. **Alphabetical**: All other `.md` files sorted A-Z by filename
3. **Exclusions**: Main workflow files (`spec.md`, `tasks.md`) are not shown in plan sub-menu

**Example Order**:
```
Plan → Data Model → Quickstart → Research
```

## Message Types

### Extension to Webview

```typescript
type ExtensionToWebviewMessage =
    | { type: 'documentChanged'; content: string }
    | { type: 'updatePhaseInfo'; specInfo: SpecInfo };
```

### Webview to Extension

```typescript
type WebviewToExtensionMessage =
    | { type: 'switchTab'; fileName: string }
    | { type: 'navigateToPhase'; phase: string }
    // ... other message types
```

## Relationships

```
SpecInfo (1) ────────────── (0..n) RelatedDoc
    │
    └── documentType: 'plan' ←── triggers sub-menu visibility
    │
    └── currentPhase: 2 ←── triggers Plan step highlight

RelatedDoc ────────────── ordering rules applied
    │
    └── plan.md always first
    └── others sorted alphabetically
```

## CSS Class Application Logic

```typescript
// In phaseUI.ts
step.classList.toggle('active', phaseNum === specInfo.currentPhase && phase !== 'done');

// For Plan step (phaseNum = 2):
// - Active when viewing plan.md (currentPhase = 2)
// - Active when viewing research.md (currentPhase = 2)
// - Active when viewing data-model.md (currentPhase = 2)
// - Active when viewing quickstart.md (currentPhase = 2)
```
