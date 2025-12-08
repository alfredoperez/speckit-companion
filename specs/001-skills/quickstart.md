# Quickstart: Claude Code Skills Explorer

**Feature**: 001-skills
**Date**: 2025-12-08

## Overview

This feature adds a Skills section to the SpecKit Companion sidebar that displays Claude Code Skills grouped by type (Plugin, User, Project). Skills are only visible when Claude Code is selected as the AI provider.

## Prerequisites

- VS Code ^1.84.0
- SpecKit Companion extension
- Claude Code CLI installed (for skills to exist)
- `speckit.aiProvider` setting set to `"claude"`

## Implementation Steps

### Step 1: Add Skills View to package.json

```json
{
  "views": {
    "speckit": [
      // ... existing views
      {
        "id": "speckit.views.skills",
        "name": "Skills",
        "when": "config.speckit.aiProvider == 'claude' && config.speckit.views.skills.visible"
      }
    ]
  },
  "configuration": {
    "properties": {
      "speckit.views.skills.visible": {
        "type": "boolean",
        "default": true,
        "scope": "window",
        "description": "Show Skills view (Claude Code only)"
      }
    }
  }
}
```

### Step 2: Create SkillManager

```typescript
// src/features/skills/skillManager.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as yaml from 'js-yaml';

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
  type: 'plugin' | 'user' | 'project';
  allowedTools?: string[];
  pluginName?: string;
  hasWarning?: boolean;
}

export class SkillManager {
  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.OutputChannel
  ) {}

  async getSkillList(type: 'project' | 'user' | 'plugin' | 'all' = 'all'): Promise<SkillInfo[]> {
    const skills: SkillInfo[] = [];

    if (type === 'project' || type === 'all') {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (workspaceRoot) {
        const projectSkillsPath = path.join(workspaceRoot, '.claude/skills');
        skills.push(...await this.getSkillsFromDirectory(projectSkillsPath, 'project'));
      }
    }

    if (type === 'user' || type === 'all') {
      const userSkillsPath = path.join(os.homedir(), '.claude/skills');
      skills.push(...await this.getSkillsFromDirectory(userSkillsPath, 'user'));
    }

    if (type === 'plugin' || type === 'all') {
      skills.push(...await this.getPluginSkills());
    }

    return skills;
  }

  private async getSkillsFromDirectory(dirPath: string, type: 'project' | 'user'): Promise<SkillInfo[]> {
    // Scan for {skill-folder}/SKILL.md
  }

  private async getPluginSkills(): Promise<SkillInfo[]> {
    // Read ~/.claude/plugins/installed_plugins.json
    // For each plugin, scan {installPath}/skills/
  }

  private async parseSkillFile(filePath: string, type: SkillInfo['type']): Promise<SkillInfo | null> {
    // Parse YAML frontmatter from SKILL.md
  }
}
```

### Step 3: Create SkillsExplorerProvider

```typescript
// src/features/skills/skillsExplorerProvider.ts
import * as vscode from 'vscode';
import { SkillManager, SkillInfo } from './skillManager';
import { getConfiguredProviderType } from '../../ai-providers/aiProvider';

export class SkillsExplorerProvider implements vscode.TreeDataProvider<SkillItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SkillItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private context: vscode.ExtensionContext,
    private skillManager: SkillManager,
    private outputChannel: vscode.OutputChannel
  ) {
    this.setupFileWatchers();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async getChildren(element?: SkillItem): Promise<SkillItem[]> {
    // Check if Claude is selected
    if (getConfiguredProviderType() !== 'claude') {
      return [new SkillItem('Skills only available for Claude Code', ...)];
    }

    if (!element) {
      // Root: return skill groups
      return this.getSkillGroups();
    }

    if (element.contextValue === 'skill-group') {
      // Return skills for this group
      const skills = await this.skillManager.getSkillList(element.groupType);
      return skills.map(skill => new SkillItem(skill.name, ..., skill));
    }

    return [];
  }
}
```

### Step 4: Register in extension.ts

```typescript
// In activate()
const skillManager = new SkillManager(context, outputChannel);
const skillsExplorer = new SkillsExplorerProvider(context, skillManager, outputChannel);

context.subscriptions.push(
  vscode.window.registerTreeDataProvider(Views.skills, skillsExplorer)
);

// Add refresh command
context.subscriptions.push(
  vscode.commands.registerCommand('speckit.skills.refresh', () => {
    skillsExplorer.refresh();
  })
);
```

### Step 5: Add View Title Menu Actions

```json
{
  "menus": {
    "view/title": [
      {
        "command": "speckit.skills.refresh",
        "when": "view == speckit.views.skills",
        "group": "navigation"
      }
    ]
  }
}
```

## Testing Checklist

### Manual Testing (F5 in VS Code)

1. **View Visibility**
   - [ ] Skills view appears when Claude Code is selected
   - [ ] Skills view is hidden when Gemini/Copilot is selected
   - [ ] Skills view respects `speckit.views.skills.visible` setting

2. **Skill Detection**
   - [ ] User skills from `~/.claude/skills/` appear under "User Skills"
   - [ ] Project skills from `.claude/skills/` appear under "Project Skills"
   - [ ] Plugin skills appear under "Plugin Skills" (if any installed)

3. **Skill Interaction**
   - [ ] Clicking a skill opens its SKILL.md file
   - [ ] Hovering shows skill description as tooltip
   - [ ] Refresh button re-scans skill directories

4. **Edge Cases**
   - [ ] Folders without SKILL.md are ignored
   - [ ] Invalid YAML shows warning icon
   - [ ] Empty directories show empty group
   - [ ] Non-existent directories are handled gracefully

## File Checklist

New files to create:
- [ ] `src/features/skills/index.ts`
- [ ] `src/features/skills/skillManager.ts`
- [ ] `src/features/skills/skillsExplorerProvider.ts`

Files to modify:
- [ ] `package.json` - Add view, command, menu, setting
- [ ] `src/core/constants.ts` - Add `Views.skills`
- [ ] `src/core/fileWatchers.ts` - Add skills watcher
- [ ] `src/ai-providers/aiProvider.ts` - Add skillsDir to ProviderPaths
- [ ] `src/extension.ts` - Register provider and commands

## Contracts

This feature has no external API contracts. It is a read-only VS Code TreeView that:
- Reads SKILL.md files from disk
- Parses YAML frontmatter
- Displays information in sidebar

No HTTP endpoints, no WebSockets, no CLI commands to expose.
