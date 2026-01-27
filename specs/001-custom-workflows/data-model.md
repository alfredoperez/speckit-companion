# Data Model: Custom Workflows

**Feature**: 001-custom-workflows
**Date**: 2026-01-26

## Entity Definitions

### WorkflowConfig

The primary configuration entity for a custom workflow.

```typescript
/**
 * Custom workflow configuration stored in VS Code settings
 */
interface WorkflowConfig {
  /** Unique identifier for the workflow (required, must be non-empty) */
  name: string;

  /** Optional display name (defaults to name if not provided) */
  displayName?: string;

  /** Optional description shown in workflow picker */
  description?: string;

  /** Custom command for the specify step (defaults to 'speckit.specify') */
  'step-specify'?: string;

  /** Custom command for the plan step (defaults to 'speckit.plan') */
  'step-plan'?: string;

  /** Custom command for the implement step (defaults to 'speckit.implement') */
  'step-implement'?: string;

  /** Optional checkpoint definitions */
  checkpoints?: CheckpointConfig[];
}
```

**Validation Rules**:
- `name` is required and must be unique across all workflows
- `name` cannot be "default" (reserved for built-in workflow)
- `name` must match pattern `^[a-z][a-z0-9-]*$` (lowercase, hyphenated)
- Step commands, if provided, must be non-empty strings
- Workflow with missing step commands inherits from default

### CheckpointConfig

Configuration for workflow checkpoints (pause points with user prompts).

```typescript
/**
 * Checkpoint configuration for commit/PR generation
 */
interface CheckpointConfig {
  /** Checkpoint identifier */
  id: 'commit' | 'pr';

  /** When to trigger the checkpoint */
  trigger: 'after-implement' | 'after-commit';

  /** Whether to prompt user before executing (default: true) */
  requiresApproval?: boolean;

  /** For commit checkpoint: exclude co-author attribution */
  excludeCoAuthor?: boolean;

  /** For PR checkpoint: custom PR title template */
  prTitleTemplate?: string;
}
```

**Validation Rules**:
- `id` must be one of the defined checkpoint types
- `trigger: 'after-commit'` is only valid for `id: 'pr'`
- `excludeCoAuthor` is only applicable when `id: 'commit'`
- `prTitleTemplate` is only applicable when `id: 'pr'`

### FeatureWorkflowContext

Persisted context linking a feature to its selected workflow.

```typescript
/**
 * Feature-workflow context stored in .speckit.json
 */
interface FeatureWorkflowContext {
  /** Name of the selected workflow */
  workflow: string;

  /** Timestamp when workflow was selected */
  selectedAt: string; // ISO 8601

  /** Checkpoint progress tracking */
  checkpointStatus?: {
    commit?: 'pending' | 'completed' | 'skipped';
    pr?: 'pending' | 'completed' | 'skipped';
  };
}
```

**File Location**: `specs/{feature-name}/.speckit.json`

### DefaultWorkflow

The built-in default workflow (always available).

```typescript
const DEFAULT_WORKFLOW: WorkflowConfig = {
  name: 'default',
  displayName: 'Default',
  description: 'Standard SpecKit workflow',
  'step-specify': 'speckit.specify',
  'step-plan': 'speckit.plan',
  'step-implement': 'speckit.implement',
  checkpoints: []
};
```

## Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Settings                          │
│  speckit.customWorkflows: WorkflowConfig[]                  │
└────────────────────────┬────────────────────────────────────┘
                         │ 1:N
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    WorkflowConfig                            │
│  name, step-specify, step-plan, step-implement              │
└────────────────────────┬────────────────────────────────────┘
                         │ 1:N (optional)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   CheckpointConfig                           │
│  id, trigger, requiresApproval, excludeCoAuthor             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              Feature Directory (specs/{name}/)               │
│  spec.md, plan.md, tasks.md                                 │
└────────────────────────┬────────────────────────────────────┘
                         │ 1:1
                         ▼
┌─────────────────────────────────────────────────────────────┐
│             .speckit.json (FeatureWorkflowContext)          │
│  workflow, selectedAt, checkpointStatus                     │
└─────────────────────────────────────────────────────────────┘
```

## State Transitions

### Workflow Selection State

```
[No Selection] ──(user runs specify)──▶ [Selection Prompt]
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │                                                   │
                    ▼                                                   ▼
            [Only Default]                                    [Multiple Available]
            (auto-select)                                     (show QuickPick)
                    │                                                   │
                    └─────────────────────────┬─────────────────────────┘
                                              ▼
                                    [Workflow Selected]
                                              │
                                              ▼
                               [Persist to .speckit.json]
```

### Checkpoint Execution State

```
[Workflow Step Complete] ──(has checkpoint)──▶ [Checkpoint Triggered]
                                                        │
                    ┌───────────────────────────────────┴───────────────────────────┐
                    │                                   │                           │
                    ▼                                   ▼                           ▼
        [requiresApproval: true]           [requiresApproval: false]          [No Checkpoint]
        (show approval prompt)             (auto-execute)                     (continue)
                    │                                   │
        ┌───────────┴───────────┐                      │
        ▼                       ▼                      │
    [Approved]              [Declined]                 │
        │                       │                      │
        ▼                       ▼                      │
    [Execute]               [Skip]                     │
        │                       │                      │
        └───────────┬───────────┴──────────────────────┘
                    ▼
            [Update Status]
                    │
                    ▼
        [Next Checkpoint or Complete]
```

## Configuration Schema (package.json)

```json
{
  "speckit.customWorkflows": {
    "type": "array",
    "default": [],
    "scope": "window",
    "description": "Custom workflow definitions for spec-driven development",
    "items": {
      "type": "object",
      "required": ["name"],
      "properties": {
        "name": {
          "type": "string",
          "pattern": "^[a-z][a-z0-9-]*$",
          "description": "Unique workflow identifier (lowercase, hyphenated)"
        },
        "displayName": {
          "type": "string",
          "description": "Display name shown in workflow picker"
        },
        "description": {
          "type": "string",
          "description": "Description shown in workflow picker"
        },
        "step-specify": {
          "type": "string",
          "description": "Custom command for specify step"
        },
        "step-plan": {
          "type": "string",
          "description": "Custom command for plan step"
        },
        "step-implement": {
          "type": "string",
          "description": "Custom command for implement step"
        },
        "checkpoints": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["id", "trigger"],
            "properties": {
              "id": {
                "type": "string",
                "enum": ["commit", "pr"],
                "description": "Checkpoint type"
              },
              "trigger": {
                "type": "string",
                "enum": ["after-implement", "after-commit"],
                "description": "When to trigger checkpoint"
              },
              "requiresApproval": {
                "type": "boolean",
                "default": true,
                "description": "Prompt user before executing"
              },
              "excludeCoAuthor": {
                "type": "boolean",
                "default": false,
                "description": "Exclude co-author attribution from commit"
              },
              "prTitleTemplate": {
                "type": "string",
                "description": "Template for PR title (supports ${featureName})"
              }
            }
          }
        }
      },
      "additionalProperties": false
    }
  }
}
```

## Example Configurations

### Lightweight Workflow

```json
{
  "speckit.customWorkflows": [
    {
      "name": "light",
      "displayName": "Lightweight",
      "description": "Quick workflow with auto-commit and PR",
      "step-specify": "speckit.light-specify",
      "step-plan": "speckit.light-plan",
      "step-implement": "speckit.light-implement",
      "checkpoints": [
        {
          "id": "commit",
          "trigger": "after-implement",
          "requiresApproval": true,
          "excludeCoAuthor": true
        },
        {
          "id": "pr",
          "trigger": "after-commit",
          "requiresApproval": true
        }
      ]
    }
  ]
}
```

### Team-Specific Workflow

```json
{
  "speckit.customWorkflows": [
    {
      "name": "frontend",
      "displayName": "Frontend Team",
      "description": "Workflow for UI components",
      "step-specify": "speckit.frontend-specify",
      "step-plan": "speckit.plan",
      "step-implement": "speckit.frontend-implement"
    }
  ]
}
```
