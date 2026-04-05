# Data Model: Centralize Magic Strings

This feature introduces no new persistent data or entities. It adds compile-time constant objects that map symbolic names to string values already in use.

## New Constant Objects

### WorkflowSteps

| Field | Value | Usage |
|-------|-------|-------|
| SPECIFY | `'specify'` | Workflow phase identifier |
| PLAN | `'plan'` | Workflow phase identifier |
| TASKS | `'tasks'` | Workflow phase identifier |
| IMPLEMENT | `'implement'` | Workflow phase identifier |
| CONFIG_SPECIFY | `'step-specify'` | Legacy config key |
| CONFIG_PLAN | `'step-plan'` | Legacy config key |
| CONFIG_TASKS | `'step-tasks'` | Legacy config key |
| CONFIG_IMPLEMENT | `'step-implement'` | Legacy config key |

### SpecStatuses

| Field | Value | Usage |
|-------|-------|-------|
| ACTIVE | `'active'` | Default lifecycle state |
| TASKS_DONE | `'tasks-done'` | All tasks completed |
| COMPLETED | `'completed'` | User marked complete |
| ARCHIVED | `'archived'` | Read-only state |

### AIProviders

| Field | Value | Usage |
|-------|-------|-------|
| CLAUDE | `'claude'` | Provider identifier |
| GEMINI | `'gemini'` | Provider identifier |
| COPILOT | `'copilot'` | Provider identifier |
| CODEX | `'codex'` | Provider identifier |
| QWEN | `'qwen'` | Provider identifier |

### ConfigKeys.globalState

| Field | Value | Usage |
|-------|-------|-------|
| skipVersion | `'speckit.skipVersion'` | Version skip tracking |
| lastUpdateCheck | `'speckit.lastUpdateCheck'` | Update check timestamp |
| initSuggestionDismissed | `'speckit.initSuggestionDismissed'` | Init suggestion dismissal |

### TreeItemContext (consolidated additions from treeContextValues.ts)

19 values merged from `TreeContext`: STEERING_LOADING, STEERING_HEADER, STEERING_DOCUMENT, STEERING_FILE, SPECKIT_HEADER, SPECKIT_CONSTITUTION, SPECKIT_SCRIPTS_CATEGORY, SPECKIT_SCRIPT, SPECKIT_TEMPLATES_CATEGORY, SPECKIT_TEMPLATE, PROVIDER_HEADER, PROVIDER_PROJECT_GROUP, PROVIDER_USER_GROUP, PROVIDER_AGENTS_GROUP, PROVIDER_SKILLS_GROUP, PROVIDER_SETTINGS, AGENT, SKILL, SKILL_WARNING, CREATE_GLOBAL, CREATE_PROJECT, SEPARATOR.

Note: Some values (AGENT, STEERING_DOCUMENT) overlap with existing TreeItemContext entries. During merge, existing entries take precedence for key naming; new entries from TreeContext adopt camelCase naming to match TreeItemContext convention.

## State Transitions

No state transitions change. All constant values are identical to the raw strings they replace.

## Validation Rules

- All constant values are `as const` (literal types, not widened to `string`)
- AIProviderType union is derived from AIProviders object (single source of truth)
- No circular imports between constants.ts and feature-specific type files
