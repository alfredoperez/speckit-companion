# Tasks: AI Provider Config Tree

**Plan**: [plan.md](./plan.md) | **Date**: 2026-04-03

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Add displayName to ProviderPaths — `src/ai-providers/aiProvider.ts` | R002
  - **Do**: Add `displayName: string` field to `ProviderPaths` interface. Populate in `PROVIDER_PATHS` for each provider: `"Claude Code"`, `"Gemini CLI"`, `"GitHub Copilot"`, `"Codex CLI"`, `"Qwen CLI"`.
  - **Verify**: `npm run compile` passes with no type errors.

- [x] **T002** Remove Workflow section from tree *(depends on T001)* — `src/features/steering/steeringExplorerProvider.ts` | R001
  - **Do**: Remove the Workflow block from `getChildren()` root level (lines ~201–211 that add `workflow-commands-header`). Remove `getWorkflowStepRefs()`, `resolveWorkflowStepRefs()`, `getWorkflowCommandChildren()` methods. Remove the `workflow-commands-header` and `workflow-command` branches from `getChildren()` element routing (line ~325) and from `SteeringItem` constructor icon mapping (lines ~1109–1115). Remove the `getWorkflow` and `WorkflowConfig` imports if no longer used.
  - **Verify**: `npm run compile` passes. Tree no longer shows "Workflow" header.

- [x] **T003** Add provider-named header section *(depends on T002)* — `src/features/steering/steeringExplorerProvider.ts` | R002, R005
  - **Do**: In `getChildren()` root level, after SpecKit Files, add a new collapsible item with `contextValue: 'provider-header'` using `getProviderPaths(providerType).displayName` as the label and `Collapsed` state. Add `provider-header` icon mapping in `SteeringItem` constructor (use `'hubot'` or `'symbol-misc'` icon).
  - **Verify**: Tree shows provider name (e.g., "Claude Code") as a collapsible section.

- [x] **T004** Add Project/User sub-groups under provider *(depends on T003)* — `src/features/steering/steeringExplorerProvider.ts` | R003
  - **Do**: In `getChildren()`, when `element.contextValue === 'provider-header'`, return children: a "Project" item (`provider-project-group`) and a "User" item (`provider-user-group`), plus a "Hooks" item (reusing `hooks-header` contextValue) if `supportsHooks`. For `provider-project-group` children, return project agents + project skills. For `provider-user-group` children, return user agents + user skills + plugin agents (R004) + plugins. Reuse existing `getAgentChildren()`, `getSkillChildren()` methods directly — no sub-group headers needed, just flat lists of items.
  - **Verify**: Expanding "Claude Code" → "Project" shows project agents/skills. "User" shows user agents/skills/plugins.
  - **Leverage**: Existing `getAgentsGroupChildren()` and `getSkillsGroupChildren()` patterns for how to call managers.

- [x] **T005** Remove old top-level Agents/Skills/Hooks sections *(depends on T004)* — `src/features/steering/steeringExplorerProvider.ts` | R003
  - **Do**: Remove the standalone Agents, Skills, and Hooks header blocks from `getChildren()` root level (lines ~213–257). Remove `agents-header` and `skills-header` routing from `getChildren()` element routing since those are now handled under provider sub-groups. Keep `hooks-header` routing as-is (it's reused). Remove `getAgentsGroupChildren()` and `getSkillsGroupChildren()` methods (their logic is now inlined into provider sub-group children). Keep `getAgentChildren()`, `getSkillChildren()`, `getHooksChildren()` as they render leaf items.
  - **Verify**: `npm run compile` passes. No duplicate Agents/Skills/Hooks sections appear at root level.

- [x] **T006** Clean up package.json if needed *(depends on T005)* — `package.json` | R001
  - **Do**: Check `contributes.menus` for any `workflow-commands-header` or `workflow-command` context references and remove them. If none found, skip this task.
  - **Verify**: Extension loads without errors. `npm run compile` passes.

---

## Progress

- Phase 1: T001–T006 [x]
