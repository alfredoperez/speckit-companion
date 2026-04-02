# SpecKit Companion

![Build Status](https://img.shields.io/github/actions/workflow/status/alfredoperez/speckit-companion/release.yml?label=build)
![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.84.0-blue)
![GitHub Release](https://img.shields.io/github/v/release/alfredoperez/speckit-companion?label=version)
![License](https://img.shields.io/badge/license-MIT-blue)

![SpecKit Companion](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/hero.png)

- **Define** requirements with structured specs
- **Track** progress through Specify → Plan → Tasks → Done
- **Review** with inline comments, just like a code review
- **Extend** with custom workflows, commands, and any AI assistant

## Features

### Visual Workflow Editor

Guide your features through structured phases with a dedicated editor that renders markdown specs, shows phase progress, and provides one-click actions for each step.

![Workflow Editor](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/workflow-spec.png)

### Inline Review Comments

Review spec documents with inline comments. Add feedback directly on specific lines, refine requirements, and collaborate on specs before implementation begins.

![Inline Comments](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/inline-comment-dialog.png)

### Create Specs Visually

Create new specs with a dedicated dialog — write a detailed description, select your workflow, and attach screenshots or mockups for context.

![Create Spec](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/create-spec.png)

### Spec-Driven Phases

Each feature flows through four phases:

**Specify** — Define requirements with user stories and acceptance scenarios.

![Spec Phase](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/workflow-spec.png)

**Plan** — Create the technical design with research, data models, and implementation strategy.

![Plan Phase](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/workflow-plan.png)

**Tasks** — Generate an implementation checklist with progress tracking and parallel execution markers.

![Tasks Phase](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/workflow-tasks.png)

### Sidebar at a Glance

The sidebar organizes everything your AI assistant needs: **Specs** for feature development, **Steering** for AI guidance documents, **Agents** for custom agent definitions, **Skills** for reusable capabilities, and **Hooks** for automation triggers.

Specs are grouped into three collapsible sections based on their status (stored in `.spec-context.json`):
- **Active** — Specs in progress, expanded by default
- **Completed** — Specs marked as done, collapsed by default
- **Archived** — Specs moved to archive, collapsed by default

Right-click a spec to access **Mark as Completed** and **Archive Spec** actions.

**Color indicators:**
- Green beaker icon — completed spec
- Blue beaker icon — spec with an active workflow step
- Green check — completed step
- Blue dot — current step

When a workflow step command is running for a spec, the spec node displays a spinning progress indicator instead of its default icon.

![Sidebar Overview](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/sidebar-overview.png)

### Custom Workflows & Commands

SpecKit Companion isn't tied to a single methodology. Swap out the default phases for any SDD workflow — [Agent Teams Lite](https://github.com/Gentleman-Programming/agent-teams-lite), your own team's process, or anything that uses commands and produces markdown files. Define custom steps, labels, output files, and sub-documents. Add custom commands that appear as action buttons in specific phases (e.g., Verify, Archive, Commit, Create PR).

The sidebar, progress tracking, and workflow editor all adapt automatically to your custom workflow. [See Configuration below.](#configuration)

## Getting Started

1. **Install** the extension from a `.vsix` file or the VS Code marketplace
2. **Open the sidebar** — click the SpecKit icon in the activity bar
3. **Create a spec** — click the `+` button in the Specs view to start your first feature

## Supported AI Providers

| Feature | Claude Code | GitHub Copilot CLI | Gemini CLI | Codex CLI |
|---------|-------------|-------------------|------------|-----------|
| **Steering File** | CLAUDE.md | .github/copilot-instructions.md | GEMINI.md | .codex/AGENTS.md |
| **Steering Path** | .claude/steering/ | .github/instructions/*.instructions.md | Hierarchical GEMINI.md | .codex/ |
| **Agents** | .claude/agents/*.md | .github/agents/*.agent.md | Limited support | .codex/agents/*.md |
| **Hooks** | .claude/settings.json | Not supported | Not supported | Not supported |
| **MCP Servers** | .claude/settings.json | ~/.copilot/mcp-config.json | ~/.gemini/settings.json | Not supported |
| **CLI Command** | `claude` | `ghcs` / `gh copilot` | `gemini` | `codex` |

Configure your preferred provider: **Settings > speckit.aiProvider**

## Configuration

### Spec Directories

By default, specs live in `specs/`. You can configure multiple directories or use glob patterns:

```json
{
  "speckit.specDirectories": ["specs", "openspec/changes/*"]
}
```

Simple names (e.g., `specs`) list their children as specs. Patterns with wildcards treat each match as a spec folder.

### Custom Workflows

Define alternative workflows with custom steps, output files, and sub-documents. Any SDD methodology that uses commands and produces markdown files can be plugged into SpecKit Companion.

#### Real-world example — Agent Teams Lite

Here's a full configuration using [Agent Teams Lite](https://github.com/Gentleman-Programming/agent-teams-lite), a multi-agent SDD framework:

```json
{
  "speckit.customWorkflows": [
    {
      "name": "agent-teams-lite",
      "displayName": "Agent Teams Lite (SDD)",
      "description": "Multi-agent SDD workflow",
      "steps": [
        { "name": "specify", "label": "Spec",   "command": "sdd-spec",   "file": "spec.md", "subDir": "specs" },
        { "name": "plan",    "label": "Design", "command": "sdd-design", "file": "design.md", "includeRelatedDocs": true },
        { "name": "tasks",   "label": "Tasks",  "command": "sdd-tasks",  "file": "tasks.md" }
      ]
    }
  ],
  "speckit.specDirectories": ["specs", "openspec/changes/*", "openspec/changes/archive/*"],
  "speckit.customCommands": [
    { "name": "verify",  "title": "Verify",  "command": "/sdd-verify",  "step": "tasks", "tooltip": "Validate implementation matches specs" },
    { "name": "archive", "title": "Archive", "command": "/sdd-archive", "step": "tasks", "tooltip": "Archive completed change" }
  ]
}
```

Notice how custom workflows, spec directories, and custom commands work together:
- The workflow defines **Spec → Design → Tasks** phases with custom labels and commands
- `specDirectories` tells the sidebar where to find specs (including archived ones)
- Custom commands add **Verify** and **Archive** buttons to the Tasks phase

#### Basic example — remap default steps

```json
{
  "speckit.customWorkflows": [
    {
      "name": "sdd",
      "displayName": "SDD Workflow",
      "steps": [
        { "name": "specify",   "label": "Specify",   "command": "sdd.specify",   "file": "spec.md" },
        { "name": "plan",      "label": "Plan",      "command": "sdd.plan",      "file": "plan.md" },
        { "name": "tasks",     "label": "Tasks",     "command": "sdd.tasks",     "file": "tasks.md" },
        { "name": "implement", "label": "Implement", "command": "sdd.implement", "actionOnly": true }
      ],
      "commands": [
        {
          "name": "auto",
          "title": "Auto Mode",
          "command": "sdd:auto",
          "step": "specify",
          "tooltip": "Goes through the whole specification in auto mode"
        }
      ]
    }
  ]
}
```

#### Workflow Commands

Workflows can define `commands` — extra action buttons that appear next to the primary action for a given step. For example, a command with `"step": "specify"` renders as a button next to **Submit** in the spec editor.

```json
{
  "commands": [
    {
      "name": "auto",
      "title": "Auto Mode",
      "command": "sdd:auto",
      "step": "specify",
      "tooltip": "Runs the full pipeline automatically"
    }
  ]
}
```

| Property | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Unique command identifier |
| `command` | Yes | Command to execute (e.g., `"sdd:auto"` — no leading slash needed) |
| `step` | Yes | Which workflow step to show this button on (e.g., `"specify"`) |
| `title` | No | Button label (defaults to `name`) |
| `tooltip` | No | Hover text for the button |

Commands with `step: "specify"` appear as secondary buttons next to Submit in the spec creation dialog. Multiple commands per step are supported.

#### Steps with sub-files

Steps can declare child documents that appear as expandable items in the sidebar:

```json
{
  "steps": [
    {
      "name": "plan",
      "label": "Plan",
      "command": "speckit.plan",
      "file": "plan.md",
      "subDir": "plan"
    }
  ]
}
```

This scans `plan/` for `.md` files and shows them as children of the Plan step. You can also use an explicit list:

```json
{
  "subFiles": ["plan/architecture.md", "plan/api-design.md"]
}
```

#### Step Properties

| Property | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Step identifier (e.g., `"specify"`, `"design"`) |
| `command` | Yes | Slash command to execute (e.g., `"sdd.specify"`) |
| `label` | No | Display name in sidebar (defaults to capitalized `name`) |
| `file` | No | Output file for this step (defaults to `{name}.md`) |
| `actionOnly` | No | When `true`, the step has no output file and is hidden from the document tree (e.g., an "Implement" step that just runs a command) |
| `subFiles` | No | Array of child file paths shown under this step |
| `subDir` | No | Directory to scan for child `.md` files (non-recursive) |
| `includeRelatedDocs` | No | When `true`, unassigned `.md` files in the spec folder are grouped under this step. Only one step should have this flag. |

#### Behavior

- The sidebar shows only the steps declared by the active workflow
- Steps with missing output files appear as "not started"
- Steps with `actionOnly: true` are action-only — they appear in the workflow editor but not in the file tree
- When multiple workflows exist, you're prompted to choose when starting a new spec
- The default workflow (`spec.md` → `plan.md` → `tasks.md` → implement) is always available

### Custom Commands

Add custom slash commands that appear in the workflow editor and the **SpecKit: Run Custom Command** picker.

```json
{
  "speckit.customCommands": [
    "review",
    {
      "name": "commit",
      "title": "Commit Changes",
      "command": "/speckit.commit",
      "step": "tasks",
      "tooltip": "Generate a commit for completed work",
      "requiresSpecDir": false
    },
    {
      "name": "pr",
      "title": "Create PR",
      "command": "/speckit.pr",
      "step": "tasks",
      "tooltip": "Create a pull request for the feature"
    }
  ]
}
```

**Properties:**
- `name` — Command identifier
- `title` — Display name in picker
- `command` — Slash command to execute
- `step` — Phase to show in: `spec`, `plan`, `tasks`, or `all` (default)
- `tooltip` — Description shown on hover
- `autoExecute` — Auto-run in terminal (default: true)
- `requiresSpecDir` — Inject spec directory (default: true)

## Development

### Setup

```bash
git clone https://github.com/alfredoperez/speckit-companion.git
cd speckit-companion
npm install
npm run compile
```

### Running

1. Open the project in VS Code
2. Press `F5` to launch Extension Development Host

### Building

```bash
npm run package
# Output: speckit-companion-{version}.vsix
```

### Platform Support

| Platform     | Support | Notes           |
| ------------ | ------- | --------------- |
| macOS        | Yes     | Fully supported |
| Linux        | Yes     | Fully supported |
| Windows WSL  | Yes     | Supported       |
| Windows      | No      | Not supported   |

## Acknowledgments

This project started from the amazing work at https://github.com/notdp/kiro-for-cc

## License

MIT License
