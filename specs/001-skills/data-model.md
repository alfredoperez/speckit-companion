# Data Model: Claude Code Skills Explorer

**Feature**: 001-skills
**Date**: 2025-12-08

## Entities

### SkillInfo

Represents a Claude Code skill discovered from the file system.

```typescript
interface SkillInfo {
  /** Skill name from YAML frontmatter (or derived from folder name) */
  name: string;

  /** Skill description from YAML frontmatter */
  description: string;

  /** Absolute path to the SKILL.md file */
  path: string;

  /** Source type: where the skill was discovered from */
  type: 'plugin' | 'user' | 'project';

  /** Optional: restricted tools list from YAML frontmatter */
  allowedTools?: string[];

  /** Optional: plugin name (only for plugin-sourced skills) */
  pluginName?: string;

  /** True if YAML frontmatter was invalid (name derived from folder) */
  hasWarning?: boolean;
}
```

**Relationships**:
- Belongs to one SkillType group
- References one SKILL.md file on disk

**Validation Rules**:
- `name`: Required, derived from frontmatter or folder name if frontmatter invalid
- `description`: Optional if frontmatter invalid, empty string fallback
- `path`: Required, must be absolute path to existing SKILL.md file
- `type`: Required, one of enum values

**State Transitions**: N/A (read-only entity)

---

### SkillType

Enumeration representing the source/scope of a skill.

```typescript
type SkillType = 'plugin' | 'user' | 'project';
```

**Values**:
| Value | Directory | Scope |
|-------|-----------|-------|
| `plugin` | `~/.claude/plugins/{plugin}/skills/` | Installed plugin skills |
| `user` | `~/.claude/skills/` | Personal skills, all projects |
| `project` | `.claude/skills/` (workspace root) | Project-specific, shared via git |

---

### SkillItem (TreeItem)

VS Code TreeItem subclass for rendering skills in the sidebar.

```typescript
class SkillItem extends vscode.TreeItem {
  /** The skill information (null for group nodes) */
  skillInfo?: SkillInfo;

  /** Group type for group nodes */
  groupType?: SkillType;

  /** Context value for menu contributions */
  contextValue: 'skill' | 'skill-group' | 'skill-loading' | 'skill-not-supported';
}
```

**Tree Structure**:
```
Skills (view root)
├── Plugin Skills (skill-group, groupType='plugin')
│   ├── plugin-name:skill-1 (skill)
│   └── plugin-name:skill-2 (skill)
├── User Skills (skill-group, groupType='user')
│   └── my-personal-skill (skill)
└── Project Skills (skill-group, groupType='project')
    └── team-skill (skill)
```

**Visual Properties**:
| Context | Icon | Tooltip | Description |
|---------|------|---------|-------------|
| `skill-group` (plugin) | `$(extensions)` | "Skills from installed Claude Code plugins" | - |
| `skill-group` (user) | `$(globe)` | "User-wide skills available across all projects" | - |
| `skill-group` (project) | `$(root-folder)` | "Project-specific skills" | - |
| `skill` | `$(symbol-misc)` | Skill description | `allowed-tools` count if present |
| `skill` (warning) | `$(warning)` | "Invalid SKILL.md frontmatter" | Folder name |
| `skill-loading` | `$(sync~spin)` | "Loading skills..." | - |
| `skill-not-supported` | `$(info)` | "Skills not supported for this provider" | - |

---

## File System Schema

### SKILL.md Format

```yaml
---
name: skill-name-here              # Required: lowercase, hyphens, max 64 chars
description: What it does...       # Required: max 1024 chars
allowed-tools: Read, Grep, Glob    # Optional: comma-separated
---

# Skill Content

Markdown instructions for Claude...
```

### Directory Structure

```
# User Skills (personal)
~/.claude/skills/
├── my-skill-1/
│   └── SKILL.md
└── my-skill-2/
    ├── SKILL.md
    ├── reference.md
    └── scripts/
        └── helper.py

# Project Skills (shared)
{workspace}/.claude/skills/
├── team-skill-1/
│   └── SKILL.md
└── team-skill-2/
    └── SKILL.md

# Plugin Skills (installed)
~/.claude/plugins/{plugin-name}/skills/
├── plugin-skill-1/
│   └── SKILL.md
└── plugin-skill-2/
    └── SKILL.md
```

---

## Provider Paths Extension

Add to `ProviderPaths` interface in `aiProvider.ts`:

```typescript
interface ProviderPaths {
  // ... existing fields

  /** Directory for skill definitions */
  skillsDir: string;

  /** Pattern for skill folders (each containing SKILL.md) */
  skillsPattern: string;
}
```

**Provider Values**:

```typescript
const PROVIDER_PATHS: Record<AIProviderType, ProviderPaths> = {
  claude: {
    // ... existing
    skillsDir: '.claude/skills',
    skillsPattern: '*/SKILL.md',
  },
  gemini: {
    // ... existing
    skillsDir: '',  // Not supported
    skillsPattern: '',
  },
  copilot: {
    // ... existing
    skillsDir: '',  // Not supported
    skillsPattern: '',
  },
};
```

---

## Constants Extension

Add to `constants.ts`:

```typescript
export const Views = {
  // ... existing
  skills: 'speckit.views.skills',
};
```

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Skill folder has no SKILL.md | Ignored (not shown in tree) |
| SKILL.md has invalid YAML | Show with warning icon, name = folder name |
| Empty description field | Show with empty tooltip |
| User skills directory doesn't exist | Show empty "User Skills" group or hide |
| No skills in any location | Show empty state message |
| Duplicate names across types | Show both, distinguished by group |
| Skill folder is empty | Ignored |
| SKILL.md is empty file | Show with warning, name = folder name |
