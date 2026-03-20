# Quickstart: Fix Workflow Step Bugs

**Spec**: [spec.md](./spec.md) | **Date**: 2026-03-19

## Prerequisites

- Spec 018 (Flexible Workflow Steps) must be implemented first — this spec fixes bugs in that feature
- Node.js, npm, VS Code extension development environment

## Key Files to Modify

| File | Changes |
|------|---------|
| `src/features/workflows/types.ts` | Add `icon?: string` to `WorkflowStepConfig` |
| `src/features/specs/specExplorerProvider.ts` | Add `STEP_ICON_MAP`, update `SpecItem` icon logic, fix action-only rendering, fix subfile indentation |
| `src/features/workflows/workflowManager.ts` | Update `resolveStepCommand()` to use `steps` array |
| `src/features/workflows/workflowSelector.ts` | Update `buildWorkflowDetail()` to use `steps` array |
| `package.json` | Add `icon` to workflow step schema |

## Dev Loop

```bash
npm run watch          # Auto-compile on changes
# Press F5 in VS Code to launch Extension Development Host
# Configure a custom workflow in settings to test
```

## Test Configuration

Add to VS Code settings for testing:

```json
{
    "speckit.customWorkflows": [
        {
            "name": "sdd-test",
            "displayName": "SDD Test",
            "steps": [
                { "name": "specify", "command": "sdd-spec" },
                { "name": "design", "command": "sdd-design", "file": "design.md", "icon": "telescope" },
                { "name": "implement", "command": "sdd-apply" },
                { "name": "verify", "command": "sdd-verify", "file": "verify.md" }
            ]
        }
    ],
    "speckit.defaultWorkflow": "sdd-test"
}
```

Expected behavior:
- `specify` → chip icon, `spec.md` (default), status indicator
- `design` → telescope icon (custom), `design.md`, status indicator
- `implement` → play icon (action-only, no file), no status indicator
- `verify` → check-all icon, `verify.md`, status indicator
