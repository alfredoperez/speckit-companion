# Plan: Consolidate Sidebar — Merge Skills & Agents, Remove MCP, Fix Workflow Commands

**Spec**: [spec.md](./spec.md) | **Date**: 2026-03-26

## Approach

Integrate Skills and Agents as delegate groups inside `SteeringExplorerProvider.getChildren()` by importing `SkillManager`/`AgentManager` and rendering their data as nested `SteeringItem` nodes — no new providers needed. Delete the entire MCP feature (`src/features/mcp/`, view registration, commands, settings, file watcher refs). Fix the workflow commands bug by adding a `workflow.steps[]` iteration path in `resolveWorkflowCommandFiles`.

## Files

### Delete

| File/Dir | Reason |
|----------|--------|
| `src/features/mcp/` | Remove broken MCP Servers feature entirely |

### Modify

| File | Change |
|------|--------|
| `src/features/steering/steeringExplorerProvider.ts` | Add Agents and Skills groups at bottom of `getChildren()` root. Import `SkillManager`/`AgentManager`, add `setSkillManager()`/`setAgentManager()` setters. Handle `agents-header`, `agents-group`, `agent`, `skills-header`, `skills-group`, `skill` context values in `getChildren()` and `SteeringItem` icon mapping. Fix `resolveWorkflowCommandFiles` to iterate `workflow.steps[]` commands alongside legacy `step-*` keys. Add file watchers for skills/agents that trigger `_onDidChangeTreeData.fire()`. |
| `src/extension.ts` | Remove MCP import/instantiation/registration. Pass `agentManager` and `skillManager` to `steeringExplorer` via setters. Remove `mcpExplorer` from `setupFileWatchers` and `registerUtilityCommands` calls. Remove `speckit.views.agents`/`speckit.views.skills`/`speckit.views.mcp` tree data provider registrations. Keep skills refresh command but wire it to `steeringExplorer.refresh()`. |
| `src/core/constants.ts` | Remove `Views.mcp`, `Views.agents`, `Views.skills` and `ConfigKeys.mcpVisible`, `ConfigKeys.agentsVisible`, `ConfigKeys.skillsVisible` |
| `src/core/fileWatchers.ts` | Remove `MCPExplorerProvider` import and all `mcpExplorer` params/calls. Remove `AgentsExplorerProvider` param (agents refresh now handled by steering). |
| `src/speckit/utilityCommands.ts` | Remove `MCPExplorerProvider` import, `mcpExplorer` param, and `speckit.mcp.refresh` command registration |
| `src/features/steering/steeringCommands.ts` | Remove `agentsExplorer` param if passed for refresh — steering handles it now |
| `package.json` | Remove `speckit.views.agents`, `speckit.views.skills`, `speckit.views.mcp` from views. Remove `speckit.mcp.refresh` command. Remove `speckit.views.mcp.visible`, `speckit.views.agents.visible`, `speckit.views.skills.visible` settings. Remove MCP-related `viewsWelcome` and menu entries. Keep agents/skills context menu entries but retarget to `speckit.views.steering`. |

## Risks

- **Tree depth increases**: Agents and Skills add 2–3 nesting levels inside Steering. Mitigation: default collapsed state for agents/skills groups so the view isn't overwhelming on open.
- **File watcher consolidation**: Moving skills/agents watchers into `steeringExplorerProvider` means more watchers on one provider. Mitigation: reuse the same watcher setup pattern already proven in `SkillsExplorerProvider`/`AgentsExplorerProvider`.
