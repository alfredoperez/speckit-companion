# Quickstart: Centralize Magic Strings

## What changed

Six constant groups added/consolidated in `src/core/constants.ts`:
- `WorkflowSteps` — 'specify', 'plan', 'tasks', 'implement' + config key variants
- `SpecStatuses` — 'active', 'tasks-done', 'completed', 'archived'
- `AIProviders` — 'claude', 'gemini', 'copilot', 'codex', 'qwen'
- `ConfigKeys.globalState` — extension state keys
- `TreeItemContext` — expanded with values from deleted `treeContextValues.ts`
- Consistent `CORE_DOCUMENTS` usage from `spec-viewer/types.ts`

## How to use

```typescript
import { WorkflowSteps, SpecStatuses, AIProviders, ConfigKeys, TreeItemContext } from '../core/constants';

// Workflow steps
if (step === WorkflowSteps.SPECIFY) { ... }
const configKey = WorkflowSteps.CONFIG_PLAN;

// Spec statuses
if (status === SpecStatuses.ACTIVE) { ... }

// AI providers
if (provider === AIProviders.CLAUDE) { ... }

// Global state
context.globalState.get(ConfigKeys.globalState.skipVersion);

// Tree context
item.contextValue = TreeItemContext.steeringDocument;
```

## Adding new values

- **New workflow step**: Add to `WorkflowSteps` in `constants.ts`
- **New spec status**: Add to `SpecStatuses` in `constants.ts`, update `SpecStatus` type in `spec-viewer/types.ts`
- **New AI provider**: Add to `AIProviders` in `constants.ts`; `AIProviderType` derives automatically
- **New tree context**: Add to `TreeItemContext` in `constants.ts`

## Verification

```bash
npm run compile   # Must pass with zero errors
npm test          # Must pass with zero failures
```
