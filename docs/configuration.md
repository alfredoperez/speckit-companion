# Configuration

Every setting the extension contributes, with the reasoning behind it. Telemetry has its own page: [telemetry.md](./telemetry.md).

## Permission Mode

Controls whether AI CLIs run with permission prompts (safe) or bypass them (YOLO):

```json
{
  "speckit.permissionMode": "interactive"
}
```

| Value | Behavior |
|-------|----------|
| `"interactive"` | The CLI prompts before taking actions (recommended) |
| `"auto-approve"` | (YOLO) Skip all permission prompts. Faster but no review of tool calls. |

This applies to all providers that support it: Claude (`--permission-mode bypassPermissions`), Copilot (`--yolo`), and Qwen (`--yolo`). Gemini and Codex ignore this setting.

> **Copilot exception**: GitHub Copilot CLI cannot surface permission prompts in `-p` mode. Even with `permissionMode: "interactive"`, the extension auto-switches Copilot to auto-approve at dispatch time, because otherwise the terminal would silently hang waiting for a prompt that never appears. This is enforced at runtime; dismissing the startup warning toast does not re-enable interactive mode for Copilot.

## Companion & Telemetry Settings

These settings live under **Companion & Telemetry** in VS Code Settings. The SpecKit Companion workflow itself has no enable toggle: the Create-Spec picker and the Continue/Resume button are always available once the companion spec-kit extension is installed.

| Setting | Requires the spec-kit extension? |
|---------|----------------------------------|
| `speckit.companion.installPrompt`, the install banner when the extension is missing | No (it surfaces the missing extension) |
| `speckit.viewer.activityPanel`, the per-spec Activity timeline in the viewer | Yes |
| `speckit.telemetry`, anonymous PII-free usage telemetry | No |

The install banner shows whenever the extension is missing and you have not turned its own prompt off (or dismissed it).

## Workflow Choice

You make **one decision, once**: run the stock **SpecKit** pipeline or the **SpecKit Companion** pipeline. That choice lives in a single setting, `speckit.defaultWorkflow`, and is pre-selected in the **Workflow** choice of *Create New Spec*. There is no separate template-profile, turbo-picker, or fast-path toggle; those three settings were retired and folded into this one choice.

The **Workflow** choice renders each workflow as a card with its description visible — Companion's carries its proof line (specs 60–68% leaner, same correctness). It always lists Companion, with no setting to turn on first: when the spec-kit extension isn't installed, the Companion card shows *Install to enable*, and picking it offers a one-click install first (declining falls back to stock, never a silent no-op). When your default is stock, the Companion card also offers **Try Companion for this spec** — it applies Companion to that one spec and leaves `speckit.defaultWorkflow` untouched.

```json
{
  "speckit.defaultWorkflow": "speckit"
}
```

| Value | Behavior |
|-------|----------|
| `"speckit"` (default) | The stock SpecKit pipeline: `/speckit.*` commands, same sections and files as upstream spec-kit. |
| `"companion"` | The SpecKit Companion pipeline: the trimmed `/speckit.companion.*` commands (no user-story section, files/dependencies tasks, a smaller spec folder), built-in right-sizing for small vs. large changes, and a terminal mark-complete step. Requires the companion spec-kit extension. |

The chosen workflow is recorded on the spec at creation and dispatches **its** command family for every step of the run, so there's no cross-workflow command leakage. Existing users see no change: the default stays `speckit`.

**Right-sizing is built in.** What used to be the opt-in "complexity fast-path" now lives inside the Companion workflow itself: its routing step detects a small change and folds the ceremony (skips the review-gate pauses) without you flipping any setting. Larger changes keep the full specify, plan, tasks, implement pipeline.

**When the extension is missing.** Companion's `/speckit.companion.*` commands ship with the [spec-kit extension](../speckit-extension/README.md). If you pick **SpecKit Companion** in a project that doesn't have it installed, each step **falls back to the stock `/speckit.*` command** and a one-click "Install spec-kit Extension" prompt appears, so you never hit an "Unknown command". Full reference in [template-profiles.md](./template-profiles.md).

**Measured impact** comes from a benchmark (`/bench-run-all`, 2026-06-10): the same feature set built through each workflow at three sizes (easy / medium / hard), in isolated sandbox clones with a deterministic harness plus an independent judge. Wall-clock is a single sample per cell, so read timing as directional.

| Per size (easy / medium / hard) | SpecKit | SpecKit Companion |
|---|---|---|
| Spec size (`spec.md` lines) | 61 / 91 / 94 | 24 / 29 / 36 |
| Throwaway side files written | 3 / 4 / 4 | 0 / 0 / 0 |
| Wall-clock | 2m05s / 4m31s / 7m38s | 3m03s / 5m03s / 5m59s |

Companion specs run roughly 60 to 68% leaner, write zero throwaway side files at any size (`research.md` / `data-model.md` / `quickstart.md` / `contracts/`), and trend fastest as the feature gets harder. Correctness was a tie: every cell in both workflows shipped a passing, convention-following build (all-green regression suite, 5.0/5 independent-judge rubric), so neither needed rework. The difference is ceremony and progress visibility, not whether the feature works.

## The picker and Continue/Resume button (no setting)

The Create-Spec workflow picker and the sidebar Continue/Resume (▶) button are available to everyone out of the box; there is **no beta toggle to turn on**. Both appear whenever the companion spec-kit extension is installed: Create Spec offers the SpecKit / SpecKit Companion picker, and active specs (active / tasks-done) show a resume (▶) button on hover. When the extension isn't installed, the picker and the resume button stay hidden (the resume command has no stock equivalent), and the install banner offers to add the extension.

Resume dispatches the **command family the spec has been running**: a spec on the Companion workflow resumes with `/speckit.companion.<step>`, a spec on the stock SpecKit workflow resumes with `/speckit.<step>`, based on the workflow recorded on the spec.

## Command Format

Controls how speckit commands are formatted when sent to AI providers:

```json
{
  "speckit.commandFormat": "auto"
}
```

| Value | Behavior |
|-------|----------|
| `"auto"` | Let the AI provider decide the format (default) |
| `"dot"` | Always use dot notation (e.g., `speckit.plan`) |
| `"dash"` | Always use dash notation (e.g., `speckit-plan`) |

Use `auto` unless your speckit version requires a specific command format. Override with `dot` or `dash` when the provider's default doesn't match what your setup expects.

## AI Context Instructions

Controls whether the extension prepends a short context-update preamble to every SpecKit step prompt sent to the AI CLI:

```json
{
  "speckit.aiContextInstructions": true
}
```

| Value | Behavior |
|-------|----------|
| `true` (default) | Prepend a marker-wrapped preamble that instructs the AI to keep `.spec-context.json` current, including canonical substeps (e.g., `plan.research`, `plan.design`, `implement.run-tests`). |
| `false` | Send the raw `/speckit.<step>` command with no preamble. Useful if your AI ignores it or you're debugging raw prompts. |

The preamble adds roughly 200 to 300 tokens per dispatch and is identical across all providers (Claude, Gemini, Copilot, Codex, Qwen). Extension-side step-boundary writes remain the hard guarantee for `startedAt` / `completedAt`: this preamble unlocks finer-grained substep tracking.

## Completion Notifications

When a dispatched spec step finishes, the extension shows a VS Code information message naming the spec and step (e.g. `Spec 074 · Plan complete`). The message includes an **Open spec** action that focuses the viewer for that spec. VS Code routes info messages to the native OS notification surface when the window is unfocused, so you can tab away during long runs. The same switch also governs the notification shown when a task phase completes.

```json
{
  "speckit.notifications.stepComplete": true
}
```

Set to `false` to silence both notifications while keeping the in-viewer elapsed timer. (This one toggle replaces the former separate `speckit.notifications.phaseCompletion` setting; an existing "off" preference is carried over automatically.)

## Spec Directories

By default, specs are discovered in `specs/` **and** `.specify/specs/` (the SpecKit CLI's own layout), so a spec created either way shows up without extra configuration. You can configure additional directories or use glob patterns:

```json
{
  "speckit.specDirectories": ["specs", "openspec/changes/*"]
}
```

Simple names (e.g., `specs`) list their children as specs. Patterns with wildcards treat each match as a spec folder.

## Custom Workflows

Define alternative workflows with custom steps, output files, and sub-documents. Any SDD methodology that uses commands and produces markdown files can be plugged into SpecKit Companion. The sidebar and progress tracking adapt automatically to your custom workflow.

### Real-world example: Agent Teams Lite

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
- The workflow defines **Spec, Design, Tasks** phases with custom labels and commands
- `specDirectories` tells the sidebar where to find specs (including archived ones)
- Custom commands add **Verify** and **Archive** buttons to the Tasks phase

### Basic example: remap default steps

```json
{
  "speckit.customWorkflows": [
    {
      "name": "my-workflow",
      "displayName": "My Workflow",
      "steps": [
        { "name": "specify",   "label": "Specify",   "command": "myflow.specify",   "file": "spec.md" },
        { "name": "plan",      "label": "Plan",      "command": "myflow.plan",      "file": "plan.md" },
        { "name": "tasks",     "label": "Tasks",     "command": "myflow.tasks",     "file": "tasks.md" },
        { "name": "implement", "label": "Implement", "command": "myflow.implement", "actionOnly": true }
      ],
      "commands": [
        {
          "name": "auto",
          "title": "Auto Mode",
          "command": "myflow:auto",
          "step": "specify",
          "tooltip": "Goes through the whole specification in auto mode"
        }
      ]
    }
  ]
}
```

### Workflow Commands

Workflows can define `commands`: extra action buttons that appear next to the primary action for a given step. For example, a command with `"step": "specify"` renders as a button next to **Submit** in the spec editor.

```json
{
  "commands": [
    {
      "name": "auto",
      "title": "Auto Mode",
      "command": "/myflow:auto",
      "step": "specify",
      "tooltip": "Runs the full pipeline automatically"
    }
  ]
}
```

| Property | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Unique command identifier |
| `command` | Yes | Command to execute verbatim (e.g., `"/myflow:auto"`; include the leading `/` for slash-command providers) |
| `step` | Yes | Which workflow step to show this button on (e.g., `"specify"`) |
| `title` | No | Button label (defaults to `name`) |
| `tooltip` | No | Hover text for the button |

Commands with `step: "specify"` appear as secondary buttons next to Submit in the spec creation dialog. Multiple commands per step are supported.

### Provider Compatibility

A workflow can declare which AI providers it supports with `supportedAiProviders`. When set, the workflow is **hidden entirely** unless the active `speckit.aiProvider` is in the list: it disappears from the workflow picker, the spec editor, and every step/footer action. Omit the field (or use an empty array) to support all providers.

```json
{
  "speckit.customWorkflows": [
    {
      "name": "my-workflow",
      "displayName": "My Workflow",
      "supportedAiProviders": ["claude"],
      "steps": [
        { "name": "specify", "label": "Specify", "command": "myflow.specify", "file": "spec.md" }
      ]
    }
  ]
}
```

A workflow whose commands are implemented as Claude Code skills (e.g. `/myflow:*`) can declare `["claude"]` to keep it from appearing, as a dead unrunnable path, under GitHub Copilot, Gemini, Qwen, or Codex.

| Property | Required | Description |
|----------|----------|-------------|
| `supportedAiProviders` | No | Array of provider ids the workflow supports: `claude`, `gemini`, `copilot`, `codex`, `qwen`, `opencode`, `ide-chat`, `claude-vscode`. Omit or leave empty for all providers. An unknown id matches no real provider, hiding the workflow everywhere. |

The built-in default workflow has no declaration and is always available, so at least one workflow is always selectable regardless of provider.

### Steps with sub-files

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

### Step Properties

| Property | Required | Description |
|----------|----------|-------------|
| `name` | Yes | Step identifier (e.g., `"specify"`, `"design"`) |
| `command` | Yes | Slash command to execute (e.g., `"myflow.specify"`) |
| `label` | No | Display name in sidebar (defaults to capitalized `name`) |
| `file` | No | Output file for this step (defaults to `{name}.md`) |
| `actionOnly` | No | When `true`, the step has no output file (e.g., an "Implement" step that just runs a command). It gets no entry on the viewer's pipeline rail (the rail lists documents only) and stays hidden from the sidebar's document tree; the step still runs, records history, and drives the footer's actions |
| `subFiles` | No | Array of child file paths shown under this step |
| `subDir` | No | Directory to scan for child `.md` files (non-recursive) |
| `includeRelatedDocs` | No | When `true`, unassigned `.md` files in the spec folder are grouped under this step. Only one step should have this flag. |

### Behavior

- The sidebar shows only the steps declared by the active workflow
- Steps with missing output files appear as "not started"
- Steps with `actionOnly: true` are action-only. They never render on the viewer's pipeline rail (the rail lists only steps that produce a readable document) and they stay out of the sidebar's file tree. The step itself is unaffected: it runs, records history, and shows its progress on the last document tab (a running Implement shows its live task percent on Tasks). Custom commands scoped to an action-only step surface in the footer's actions while the workflow sits at that step
- When a spec is created via the editor, the selected workflow is automatically persisted to `.spec-context.json` in the spec directory
- If no workflow is selected, the `speckit.defaultWorkflow` setting is used (falls back to the built-in default)
- Once persisted, all subsequent operations (viewer, step execution, command palette) use the same workflow consistently
- The default workflow (`spec.md`, `plan.md`, `tasks.md`, implement) is always available

## Custom Commands

Add custom slash commands that appear in the **SpecKit: Run Custom Command** picker.

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
- `name`: Command identifier
- `title`: Display name in picker
- `command`: Slash command to execute
- `step`: Phase to show in: `spec`, `plan`, `tasks`, or `all` (default)
- `tooltip`: Description shown on hover
- `autoExecute`: Auto-run in terminal (default: true)
- `requiresSpecDir`: Inject spec directory (default: true)
