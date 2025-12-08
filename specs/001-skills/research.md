# Research: Claude Code Skills Explorer

**Feature**: 001-skills
**Date**: 2025-12-08
**Status**: Complete

## Research Questions

1. What is the Claude Code Skills directory structure?
2. What is the SKILL.md file format?
3. How do plugin skills work?
4. What existing patterns can we follow in this codebase?

---

## Findings

### 1. Skills Directory Locations

**Decision**: Skills are discovered from three locations (mirroring the Agents pattern).

| Type | Location | Scope |
|------|----------|-------|
| User Skills | `~/.claude/skills/{skill-name}/SKILL.md` | Personal, available across all projects |
| Project Skills | `.claude/skills/{skill-name}/SKILL.md` | Shared with team via git |
| Plugin Skills | `~/.claude/plugins/{plugin}/skills/{skill-name}/SKILL.md` | Installed via plugin marketplace |

**Rationale**: This follows the same pattern as Agents (`~/.claude/agents/`, `.claude/agents/`, plugins) and is documented in official Claude Code documentation.

**Alternatives considered**:
- Single directory - rejected as it doesn't match Claude Code's actual behavior
- Different directory names - rejected to maintain consistency with official docs

**Source**: [Agent Skills - Claude Code Docs](https://code.claude.com/docs/en/skills)

---

### 2. SKILL.md File Format

**Decision**: SKILL.md uses YAML frontmatter with required `name` and `description` fields.

#### Required Fields
| Field | Requirements | Purpose |
|-------|--------------|---------|
| `name` | Lowercase letters, numbers, hyphens; max 64 chars | Unique identifier |
| `description` | Max 1024 chars | What it does AND when to use it |

#### Optional Fields
| Field | Type | Purpose |
|-------|------|---------|
| `allowed-tools` | Comma-separated string | Restricts available tools when skill is active |

#### Example SKILL.md
```yaml
---
name: generating-commit-messages
description: Generates clear commit messages from git diffs. Use when writing commit messages or reviewing staged changes.
---

# Generating Commit Messages

Instructions for Claude...
```

**Rationale**: This is the official documented format. The description field is critical because Claude uses it for skill discovery (model-invoked, not user-invoked).

**Alternatives considered**:
- JSON format - rejected (official format is YAML frontmatter in Markdown)
- Additional required fields - rejected (only `name` and `description` are required per docs)

**Source**: [Agent Skills - Claude Code Docs](https://code.claude.com/docs/en/skills)

---

### 3. Plugin Skills Discovery

**Decision**: Plugin skills are discovered from installed plugins via `~/.claude/plugins/installed_plugins.json`.

The extension already implements plugin agent discovery in `AgentManager.getPluginAgents()`. Skills will follow the same pattern:

```typescript
// From installed_plugins.json, get plugin installPath
// Look for skills at: {installPath}/skills/{skill-name}/SKILL.md
```

**Rationale**: Consistency with existing agent plugin discovery pattern in codebase.

**Alternatives considered**:
- Hard-coded plugin paths - rejected (plugins can be installed anywhere)
- Separate plugin registry - rejected (installed_plugins.json already exists)

**Source**: Existing codebase pattern in `src/features/agents/agentManager.ts:258-315`

---

### 4. Existing Codebase Patterns to Follow

**Decision**: Follow the AgentsExplorer pattern exactly, with skills-specific adaptations.

#### File Structure Pattern
```
src/features/skills/
├── index.ts                    # Re-exports
├── skillManager.ts             # Business logic (like agentManager.ts)
└── skillsExplorerProvider.ts   # TreeDataProvider (like agentsExplorerProvider.ts)
```

#### Key Patterns from AgentsExplorer
1. **Provider-conditional visibility**: Check `getConfiguredProviderType() === 'claude'`
2. **Three-group structure**: Plugin Skills, User Skills, Project Skills
3. **Recursive directory scanning**: `readSkillsRecursively()`
4. **YAML frontmatter parsing**: Using `js-yaml` package (already a dependency)
5. **File watchers**: Watch `~/.claude/skills/` and `.claude/skills/`
6. **Loading state**: Show spinner during async operations

#### Provider Paths Update
Add to `aiProvider.ts`:
```typescript
claude: {
  // existing...
  skillsDir: '.claude/skills',
  skillsPattern: '*/SKILL.md',
}
```

**Rationale**: Consistency with existing patterns reduces cognitive load and ensures maintainability.

**Source**:
- `src/features/agents/agentManager.ts`
- `src/features/agents/agentsExplorerProvider.ts`

---

### 5. Key Differences from Agents

| Aspect | Agents | Skills |
|--------|--------|--------|
| File name | `*.md` (any markdown) | `SKILL.md` (exact name required) |
| Location | Direct in agents folder | In subfolder: `{skill-name}/SKILL.md` |
| Invocation | User-invoked | Model-invoked (Claude decides) |
| Required fields | `name`, `description` | `name`, `description` |

This means the skill scanner must:
1. Look for directories, not files directly
2. Look for `SKILL.md` inside each directory
3. Handle missing `SKILL.md` gracefully (ignore folder)

---

## Implementation Notes

### SkillInfo Interface
```typescript
interface SkillInfo {
  name: string;
  description: string;
  path: string;           // Path to SKILL.md
  type: 'plugin' | 'user' | 'project';
  allowedTools?: string[];
  pluginName?: string;    // For plugin skills
}
```

### Edge Case Handling
- **No SKILL.md in folder**: Ignore the folder (per FR-010)
- **Invalid YAML frontmatter**: Show skill with warning, derive name from folder name (per spec edge cases)
- **Empty skills directory**: Show empty group or hide it (per FR-011)
- **Duplicate names across types**: Show both, distinguished by group (per spec edge cases)

---

## Sources

- [Agent Skills - Claude Code Docs](https://code.claude.com/docs/en/skills)
- [Skill authoring best practices - Claude Docs](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices)
- [Inside Claude Code Skills: Structure, prompts, invocation | Mikhail Shilkov](https://mikhail.io/2025/10/claude-code-skills/)
- [GitHub - anthropics/skills: Public repository for Skills](https://github.com/anthropics/skills)
- [Introducing Agent Skills | Claude](https://www.anthropic.com/news/skills)
- Existing codebase: `src/features/agents/agentManager.ts`, `src/features/agents/agentsExplorerProvider.ts`
