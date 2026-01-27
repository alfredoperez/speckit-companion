# Quickstart: Custom Workflows Implementation

**Feature**: 001-custom-workflows
**Date**: 2026-01-26

## Prerequisites

- Node.js 18+
- VS Code 1.84.0+
- Extension development environment configured (`npm install` completed)

## Implementation Order

### Phase 1: Foundation (Types and Configuration)

1. **Add workflow types** (`src/features/workflows/types.ts`)
   ```typescript
   // Copy interfaces from contracts/workflow-api.ts
   export interface WorkflowConfig { ... }
   export interface CheckpointConfig { ... }
   export interface FeatureWorkflowContext { ... }
   ```

2. **Update package.json** - Add configuration schema for `speckit.customWorkflows`

3. **Update constants** (`src/core/constants.ts`)
   ```typescript
   export const ConfigKeys = {
     // existing...
     customWorkflows: 'speckit.customWorkflows',
   };
   ```

### Phase 2: Workflow Manager

4. **Create WorkflowManager** (`src/features/workflows/workflowManager.ts`)
   - `getWorkflows()` - Load from settings + add default
   - `validateWorkflow()` - Check name, step commands
   - `getFeatureWorkflow()` - Read from `.speckit.json`
   - `saveFeatureWorkflow()` - Write to `.speckit.json`
   - `resolveStepCommand()` - Get command for step

### Phase 3: Workflow Selection UI

5. **Create WorkflowSelector** (`src/features/workflows/workflowSelector.ts`)
   - `needsSelection()` - Check if multiple workflows exist
   - `selectWorkflow()` - Show QuickPick, return selection

### Phase 4: Integration

6. **Modify specCommands.ts** (`src/features/specs/specCommands.ts`)
   - Import workflow manager and selector
   - Add workflow selection before phase commands
   - Resolve step command from selected workflow

### Phase 5: Checkpoints (User Story 3)

7. **Create CheckpointHandler** (`src/features/workflows/checkpointHandler.ts`)
   - `promptForApproval()` - Show confirmation dialog
   - `executeCommit()` - Create commit via Git API
   - `executePR()` - Create PR via `gh` CLI

8. **Integrate checkpoints** into implement command

## Key Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add `speckit.customWorkflows` configuration schema |
| `src/core/constants.ts` | Add `ConfigKeys.customWorkflows` |
| `src/core/types/config.ts` | Add workflow interfaces |
| `src/features/specs/specCommands.ts` | Integrate workflow selection |

## Key Files to Create

| File | Purpose |
|------|---------|
| `src/features/workflows/index.ts` | Module exports |
| `src/features/workflows/types.ts` | Type definitions |
| `src/features/workflows/workflowManager.ts` | Workflow CRUD and validation |
| `src/features/workflows/workflowSelector.ts` | QuickPick UI |
| `src/features/workflows/checkpointHandler.ts` | Commit/PR automation |

## Testing Strategy

### Unit Tests

```typescript
// tests/features/workflows/workflowManager.test.ts
describe('WorkflowManager', () => {
  it('should return default workflow when no custom workflows configured');
  it('should merge custom workflows with default');
  it('should validate workflow names');
  it('should reject duplicate workflow names');
  it('should resolve step commands with fallback to default');
});

// tests/features/workflows/workflowSelector.test.ts
describe('WorkflowSelector', () => {
  it('should not prompt when only default workflow exists');
  it('should show QuickPick with all available workflows');
  it('should return undefined when user cancels');
});
```

### Integration Tests

1. Configure custom workflow in settings.json
2. Run specify command
3. Verify workflow picker appears
4. Select custom workflow
5. Verify correct command is executed
6. Verify `.speckit.json` is created

## Example Usage

### User Configuration

```json
// .vscode/settings.json
{
  "speckit.customWorkflows": [
    {
      "name": "light",
      "displayName": "Lightweight",
      "description": "Quick workflow without detailed planning",
      "step-specify": "speckit.light-specify",
      "step-plan": "speckit.light-plan",
      "step-implement": "speckit.light-implement",
      "checkpoints": [
        {
          "id": "commit",
          "trigger": "after-implement",
          "excludeCoAuthor": true
        },
        {
          "id": "pr",
          "trigger": "after-commit"
        }
      ]
    }
  ]
}
```

### Expected Behavior

1. User runs "SpecKit: Create" command
2. QuickPick shows: "Default", "Lightweight"
3. User selects "Lightweight"
4. Extension runs `/speckit.light-specify {spec-dir}`
5. After implementation, user sees: "Generate Commit?" [Yes] [No]
6. On approval, commit is created without co-author
7. User sees: "Create PR?" [Yes] [No]
8. On approval, PR is created via `gh pr create`

## Validation Checklist

- [ ] Workflow configuration validates on extension load
- [ ] Invalid workflows show warning, are skipped
- [ ] Default workflow always available
- [ ] Workflow selection appears only when multiple workflows exist
- [ ] Selected workflow persists in `.speckit.json`
- [ ] Checkpoints prompt before execution
- [ ] Git operations handle errors gracefully
- [ ] Missing custom commands fall back to default with warning
