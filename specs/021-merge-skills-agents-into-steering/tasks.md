# Tasks: Consolidate Sidebar — Merge Skills & Agents, Remove MCP, Fix Workflow Commands

**Plan**: [plan.md](./plan.md) | **Date**: 2026-03-26

## Format

- `[P]` = Can run in parallel  |  `[A]` = Agent-eligible

---

## Phase 1: Core Implementation (Sequential)

- [x] **T001** Remove MCP feature entirely — `src/features/mcp/`, `package.json`, `src/extension.ts`, `src/core/constants.ts`, `src/core/fileWatchers.ts`, `src/speckit/utilityCommands.ts`
  - **Do**: Delete `src/features/mcp/` directory. Remove `MCPExplorerProvider` import and instantiation from `extension.ts`. Remove `Views.mcp` from `constants.ts` and `ConfigKeys.mcpVisible`. Remove `mcpExplorer` param from `setupFileWatchers` and `registerUtilityCommands` in `fileWatchers.ts` and `utilityCommands.ts`. In `package.json`: remove `speckit.views.mcp` view, `speckit.mcp.refresh` command, `speckit.views.mcp.visible` setting, MCP `viewsWelcome` entry, and MCP menu entries.
  - **Verify**: `npm run compile` passes with no MCP references. No "mcp" in `constants.ts` or `extension.ts` imports.

- [x] **T002** Remove standalone Agents and Skills view registrations *(depends on T001)* — `package.json`, `src/extension.ts`, `src/core/constants.ts`
  - **Do**: In `package.json`: remove `speckit.views.agents` and `speckit.views.skills` from `views.speckit[]`. Remove `speckit.views.agents.visible` and `speckit.views.skills.visible` settings. Retarget agents/skills menu `when` clauses from their old views to `view == speckit.views.steering`. In `extension.ts`: remove `registerTreeDataProvider` calls for `Views.agents` and `Views.skills`. Keep `AgentsExplorerProvider`/`SkillsExplorerProvider` imports for now (removed in T004). Remove `Views.agents` and `Views.skills` from `constants.ts`.
  - **Verify**: `npm run compile` passes. Only `speckit.views.steering` remains for the consolidated view.

- [x] **T003** Fix workflow commands to read `steps[]` array *(depends on T002)* — `src/features/steering/steeringExplorerProvider.ts`
  - **Do**: In `resolveWorkflowCommandFiles`, add iteration over `workflow.steps[]` array: for each step with a `.command` that differs from the default `speckit.*` commands, add the command name to `commandNames`. Keep existing legacy `step-*` key iteration intact. Also check `~/.claude/commands/{cmd}.md` in addition to project `.claude/commands/{cmd}.md`.
  - **Verify**: `npm run compile` passes. Manually confirm: a workflow with `steps: [{command: "sdd.plan"}]` resolves to the matching command file.

- [x] **T004** Integrate Agents group into SteeringExplorerProvider *(depends on T002)* — `src/features/steering/steeringExplorerProvider.ts`
  - **Do**: Import `AgentManager` and add `private agentManager: AgentManager | undefined` field with `setAgentManager()` setter. In `getChildren()` root, after Workflow Commands, add an "Agents" header item (`contextValue: 'agents-header'`, icon `robot`) if provider supports agents (`getProviderPaths(providerType).agentsDir` is truthy). Handle `agents-header` → return sub-groups (User Agents, Plugin Agents, Project Agents) using `agentManager.getAgentList()`. Handle `agents-group` → return individual agent items with click-to-open command. Add icon/tooltip mapping for `agents-header`, `agents-group`, `agent` in `SteeringItem` constructor. Copy file watcher setup from `AgentsExplorerProvider` into steering provider (watch `.claude/agents/**/*.md` and `~/.claude/agents/**/*.md`, fire `_onDidChangeTreeData`).
  - **Verify**: `npm run compile` passes.

- [x] **T005** Integrate Skills group into SteeringExplorerProvider *(depends on T004)* — `src/features/steering/steeringExplorerProvider.ts`
  - **Do**: Import `SkillManager` and add `private skillManager: SkillManager | undefined` field with `setSkillManager()` setter. In `getChildren()` root, after Agents, add a "Skills" header item (`contextValue: 'skills-header'`, icon `extensions`) only if provider is `claude` or `codex`. Handle `skills-header` → return sub-groups (Plugin Skills, User Skills, Project Skills) using `skillManager.getSkillList()`. Handle `skills-group` → return individual skill items with click-to-open, warning icon for invalid frontmatter, tools count description. Add icon/tooltip mapping for `skills-header`, `skills-group`, `skill` in `SteeringItem` constructor. Copy file watcher setup from `SkillsExplorerProvider` (watch `.claude/skills/**/SKILL.md`, `~/.claude/skills/**/SKILL.md`, `installed_plugins.json`).
  - **Verify**: `npm run compile` passes.

- [x] **T006** Wire managers in extension.ts and clean up dead code *(depends on T005)* — `src/extension.ts`, `src/core/fileWatchers.ts`, `src/features/steering/steeringCommands.ts`
  - **Do**: In `extension.ts`: call `steeringExplorer.setAgentManager(agentManager)` and `steeringExplorer.setSkillManager(skillManager)` after creation. Remove `AgentsExplorerProvider` and `SkillsExplorerProvider` instantiation and imports. Rewire `speckit.skills.refresh` command to call `steeringExplorer.refresh()`. Remove `agentsExplorer` from `setupFileWatchers` and `registerSteeringCommands` params. In `fileWatchers.ts`: remove `AgentsExplorerProvider` import and `agentsExplorer` param from `setupFileWatchers` and `setupClaudeDirectoryWatcher`. In `steeringCommands.ts`: remove `agentsExplorer` param if present.
  - **Verify**: `npm run compile` passes with zero errors. Extension loads in dev host showing consolidated Steering view with Agents + Skills groups.

- [x] **T007** Delete unused Skills and Agents explorer providers *(depends on T006)* — `src/features/skills/skillsExplorerProvider.ts`, `src/features/agents/agentsExplorerProvider.ts`, `src/features/skills/index.ts`, `src/features/agents/index.ts`
  - **Do**: Delete `src/features/skills/skillsExplorerProvider.ts` and `src/features/agents/agentsExplorerProvider.ts`. Update `src/features/skills/index.ts` to only export `SkillManager` (remove `SkillsExplorerProvider`, `SkillItem` exports). Update `src/features/agents/index.ts` to only export `AgentManager` (remove `AgentsExplorerProvider`, `AgentItem` exports). Grep for any remaining imports of deleted classes and fix.
  - **Verify**: `npm run compile` passes. `grep -r "SkillsExplorerProvider\|AgentsExplorerProvider" src/` returns no results.

---

## Phase 2: Quality (Parallel — launch agents in single message)

- [ ] **T008** [P][A] Unit tests — `test-expert`
  - **Files**: `tests/features/steering/steeringExplorerProvider.test.ts`
  - **Pattern**: Jest with `describe`/`it`, VS Code mock from `tests/__mocks__/vscode.ts`
  - **Reference**: existing steering tests if any, or `tests/` directory patterns
  - **Cover**: (1) Agents group appears/hidden based on provider, (2) Skills group appears only for claude/codex, (3) `resolveWorkflowCommandFiles` reads both `steps[]` and legacy keys, (4) MCP references fully removed

---

## Progress

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | T001–T007 | [ ] |
| Phase 2 | T008 | [ ] |
