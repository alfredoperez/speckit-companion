# SpecKit Companion: review AI specs before they ship as broken code

![Build Status](https://img.shields.io/github/actions/workflow/status/alfredoperez/speckit-companion/release.yml?label=build)
![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.84.0-blue)
![GitHub Release](https://img.shields.io/github/v/release/alfredoperez/speckit-companion?label=version)
![License](https://img.shields.io/badge/license-MIT-blue)

The spec workspace for developers running AI agents through Spec-Driven Development. Catch bad specs before they become bad code.

![SpecKit Companion: Spec-driven development, visualized. Specify, Plan, Tasks, Done.](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/hero.jpg)

## What you get

A spec workspace that turns AI-assisted, spec-driven development into something you can actually see and steer — without leaving VS Code:

- **Catch bad specs before they become bad code.** Review AI-generated specs the way you review pull requests: inline comments on specific lines, refine in place, and kill a vague requirement before it turns into 200 lines of wrong implementation.
- **Watch every feature flow through its phases.** Specify → Plan → Tasks → Done, each a one-click action, with live progress, a phase timeline, and an Activity overview of everything the spec tracks.
- **Run leaner with Turbo.** Opt into the companion spec-kit extension's trimmed `/speckit.companion.*` pipeline — smaller specs, files-and-dependencies tasks, an optional fast-path for small changes — without giving up the stock flow.
- **Bring your own AI and your own workflow.** Eight providers, custom phases, custom commands. Drop in your own SDD process; the sidebar and viewer adapt.

## Recently Shipped

- **v0.23.0** One-click install + graceful degradation for the companion spec-kit extension (detection, banners, sidebar action) · a finished implementation reliably shows as done — the viewer auto-refreshes and the in-flight spinner is consolidated onto the step tab · in-app update notifications work again and install links resolve · the in-editor "Install/Update spec-kit Extension" always pulls the newest build · Beta Features simplified to on/off and ordered by adoption · per-spec **SpecKit Companion** pipeline pick in *Create New Spec* (beta) · higher-contrast text on dark + sidebar polish
- **v0.22.0** Status + Resume — each active spec row shows its current step and last transition with an inline **Resume** action that continues the pipeline from where it stopped; live per-task journaling on implement (real per-task timing, not one end-of-run burst); malformed-`.spec-context.json` recovery with a reset action
- **v0.21.0** Spec-context `history[]` schema migration with explicit `kind` field, end-to-end state-machine correctness fixes (15 findings, F1–F16), brand-name provider labels, wrapping task-line rendering polish, inline-comment persistence across all docs, install-pipeline reliability (tsc chained in prepublish)
- [Full changelog →](./CHANGELOG.md)

## Why it exists

**Review AI-generated specs the way you review code.** Add inline comments on specific lines, refine requirements, and catch a vague requirement before the AI turns it into 200 lines of wrong code. Every comment persists to the spec's `.spec-context.json` the moment you add it, so an in-progress review is durable across sessions and committable to source control.

**Plug any AI assistant into any spec-driven workflow.** Eight providers ship today (Claude Code, Gemini, GitHub Copilot, Codex, Qwen, OpenCode, IDE Chat, Claude in VS Code), and the workflow engine accepts custom phases, commands, and sub-documents. Drop in [Agent Teams Lite](https://github.com/Gentleman-Programming/agent-teams-lite), your own SDD process, or anything that takes commands and produces markdown.

**Spec-driven phases without leaving VS Code.** Each feature flows through Specify, Plan, Tasks, Done, with progress tracking, sticky headers, and a structured viewer built for long specs.

## Features

### Visual Spec Viewer

Guide your features through structured phases with a dedicated viewer that renders markdown specs, shows phase progress, and provides one-click actions for each step. Mermaid diagrams render inline with zoom controls for navigating complex diagrams. After each action, a toast confirms the result and the viewer auto-advances to the next phase.

![Spec viewer](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/viewer.png)
*The spec viewer. Step tabs, sub-document chips, an inline diagram, and a footer button that advances Specify → Plan → Tasks → Done. Markdown stays in your repo, never on a server.*

### Inline Review Comments

Review spec documents with inline comments. Add feedback directly on specific lines, refine requirements, and collaborate on specs before implementation begins. Each comment is **persisted to the spec's `.spec-context.json` the moment you add or remove it** — not only when you refine — so an in-progress review survives closing the tab, is committable, and can be picked up later (next session, another machine, or another reviewer after a pull). When you click the **Refine** button, that document's pending comments are dispatched to the AI for a direct, in-place edit of the source and then marked *applied* (kept as history — no separate files).

![Inline Comments](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/comments.png)
*Inline review comments. Catch a vague requirement on line 12 before the AI turns it into 200 lines of wrong code.*

### Persistent, Resumable Comments

Reopen a spec and every pending comment is **restored inline**, anchored to its source location. Restore is resilient: a comment remembers its nearest heading and surrounding block, so if the source drifted (a line moved or was edited) it best-effort re-anchors to the nearest matching heading rather than being dropped — a comment is never silently lost.

Comments live entirely in `.spec-context.json`; the old per-document `<doc>-extra.md` scratchpad files and the read-only "Notes" sub-tab have been removed. There is one storage surface (the committed context file) and one overview surface (the **Activity** panel's *Review comments* card — a consolidated list across spec/plan/tasks with per-comment status, jump-to-line, and a per-document **Run refinement** action). The inline surface stays the always-on primary path; the Activity list is the power-user overview (when the Activity panel is toggled off, inline comments still work and still persist).

### Create Specs Visually

Create new specs with a dedicated dialog. Write a detailed description, select your workflow, and attach screenshots or mockups for context.

![Create Spec](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/create-spec.png)
*Create-spec dialog. Write a detailed description, pick a workflow, attach a screenshot. The AI never sees a one-liner.*

### Spec-Driven Phases

Each feature flows through four phases, each a one-click footer action in the viewer above:

- **Specify** — define requirements with user stories and acceptance scenarios before any code is written.
- **Plan** — create the technical design: architecture, data models, and research, grouped under one step with sub-document chips.
- **Tasks** — generate an implementation checklist with parallel-execution markers and live progress.
- **Done** — mark the spec complete (or archive it) once implementation lands.

### Reading Specs

The spec viewer is built for fast scanning of long-form specs:

- **Title-leading header**: the spec name dominates above a compact `[STATUS] [⌥ branch] · date` cluster, so the page anchor is the first thing your eye lands on.
- **Sticky chrome**: step tabs (Specification / Plan / Tasks) and header stay pinned at the top while you scroll.
- **Children rail**: when a step has sub-files (e.g., Plan's `data-model.md`, `quickstart.md`, `research.md`), they render as chips directly under the active step tab, with the parent step itself as the first chip so any sub-doc has a one-click path back to the overview.
- **Persistent inline comments**: review comments persist to `.spec-context.json` as you make them and restore inline when the spec reopens (best-effort re-anchoring if the source drifted). The old per-document `… Notes` scratchpad sub-tabs are gone — the consolidated cross-document list now lives in the Activity panel's *Review comments* card.
- **Table of contents**: sticky outline column on the left of the content area. Defaults to h2-only (so phase-heavy `tasks.md` reads as a clean ~7-entry list); a small `+` toggle expands h3 subsections when needed. Auto-hides on narrow panes.
- **Quiet content**: when the structured header has the metadata, in-content duplicates (the `Input:` block, repeated branch chips, literal `Slug:`/`Date:` paragraphs) are suppressed so the body is just the spec content.
- **Diagrams**: wide mermaid diagrams scroll horizontally inside the prose column instead of bleeding past it. Each diagram has its own `−` / Reset / `+` zoom controls.
- **Activity panel**: an `Activity` toggle swaps the markdown pane for a card-stack overview of everything `.spec-context.json` carries. See [Activity Panel](https://github.com/alfredoperez/speckit-companion#activity-panel) below.
- **Quiet, intentional footer**: the footer surfaces only what fits the moment — `Regenerate` plus a forward button labelled with the next phase (`Plan` / `Tasks` / `Implement` / `Complete`). While a step generates, that button is disabled and reads `Generating <step>…` until the artifact actually lands on disk, so the footer never advances ahead of the work. `Archive` and `Mark Completed` appear only once the spec is closure-eligible (`ready-to-implement` and beyond). See [`docs/viewer-states.md`](./docs/viewer-states.md) for the full footer state matrix.
- **Optional SpecKit commands per tab**: SpecKit's three refinement commands surface as one-click footer buttons where each is most useful — **Clarify** on Spec, **Checklist** on Plan, **Analyze** on Tasks. No configuration required; a custom command with the same id wins. They disappear once the spec reaches the closure gate.

### Activity Panel

Toggle **Activity** in the viewer's nav bar to swap the markdown pane for a card-stack overview of everything `.spec-context.json` carries:

- **Approach** — one-line strategy, status pill, PR link, and commit/PR checkpoints.
- **Phases** — a horizontal timeline reporting **active time** per step and substep (idle gaps are capped, so an overnight pause doesn't inflate a step); the in-flight step pulses and the terminal phase finalizes.
- **Tasks** — per-`T###` status, summary, file chips, and inline concerns.
- **Decisions**, **Concerns**, **Review comments** (every persisted comment grouped by document, with jump-to-line and a per-document **Run refinement** button), and **Files touched** (clickable).

Each card hides itself when its data is missing, so a minimal speckit-style spec collapses to just *Phases*. Visibility is gated by `speckit.viewer.activityPanel` — `"off"`, `"beta"` (default; toggle shows a *beta* pill), or `"on"`.

![Activity Panel](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/activity.png)
*Activity panel. The Phases timeline plus Approach, Tasks, and Review-comments cards — one overview of everything the spec's context file tracks.*

### Custom Workflows & Commands

SpecKit Companion isn't tied to a single methodology. Swap out the default phases for any SDD workflow such as [Agent Teams Lite](https://github.com/Gentleman-Programming/agent-teams-lite), your own team's process, or anything that uses commands and produces markdown files. Define custom steps, labels, output files, and sub-documents. Add custom commands that appear as action buttons in specific phases (e.g., Verify, Archive, Commit, Create PR).

The sidebar, progress tracking, and workflow editor all adapt automatically to your custom workflow. [See Configuration below.](https://github.com/alfredoperez/speckit-companion#configuration)

### Sidebar at a Glance

The sidebar organizes everything your AI assistant needs: **Specs** for feature development, **Steering** for AI guidance documents, **Agents** for custom agent definitions, **Skills** for reusable capabilities, and **Hooks** for automation triggers.

Specs are grouped into three collapsible sections, each with a count in the header: **Active**, **Completed**, **Archived**. Filter by name, sort by number/name/date/status, multi-select to bulk-archive or complete, and right-click for per-spec actions like Reveal in File Explorer. Right-click also offers **Copy Path** (workspace-relative path) and **Copy Name** (slug only) for referencing specs in PRs, chat, or external tools. **Right-click a group header** to apply lifecycle actions to every spec in the group at once (e.g., *Archive all*, *Reactivate all*) — each gated by a confirmation dialog. Header badges and tree icons are color-coded by status so progress reads at a glance.

Each active spec row shows its **current step** and a one-line **last transition** (e.g. `plan — Plan started · 2h ago`) and an inline **Resume** action. Clicking Resume dispatches `/speckit.companion.resume` for that spec: the pipeline continues from the recorded step, with prior decisions in scope, and the next `/speckit.*` command is sent to your AI provider — continuing at the next unchecked task when mid-implementation. The row updates live once the dispatched step records its state. See [`docs/sidebar.md`](docs/sidebar.md) for the full reference.

When a step command is running, the spec shows a spinner and a live elapsed timer; a step-complete notification fires when it finishes (toggle via `speckit.notifications.stepComplete`).

The spec-kit upgrade commands are consolidated behind a single **Upgrade…** icon in the Specs view title bar. Clicking it opens a picker with **Upgrade All**, **Upgrade Project**, and **Upgrade CLI** — the project-scaffolding actions use your configured AI provider, while **Upgrade CLI** updates only the global CLI. All three remain available individually from the Command Palette.

The sidebar is visible alongside the viewer in the screenshot above. For the full reference (lifecycle button matrix, badge tier mapping, transition logging, all icon meanings), see [`docs/sidebar.md`](./docs/sidebar.md).

### Offline-First UI

Fonts (Geist Variable) and icons (codicons) ship bundled inside the extension `.vsix`. The spec viewer, spec editor, and workflow editor all render identically on a plane with no internet connection. No runtime requests to CDNs for fonts or icon glyphs.

### Safety Affordances for Destructive Actions

Actions that change the spec's lifecycle are protected so a misfired click is easy to walk back:

- **Regenerate** queues behind a 5-second undo toast. Clicking **Undo** or pressing **Esc** cancels the regeneration; otherwise the backend fires when the timer elapses.
- **Archive**, **Complete**, and **Reactivate** each require two clicks. The first click swaps the button label to **"Confirm?"** for 3 seconds; a second click within that window confirms. Otherwise the label reverts silently and nothing happens.
- **Locked future steps**: while a step is running, downstream step tabs lock and surface a tooltip explaining why, so dispatched work cannot be interrupted by an out-of-order click.
- The OS-level **Reduce Motion** preference is honored globally. In-flight step pulses and other infinite animations stop when it's enabled.

## Getting Started

1. **Install** the extension from a `.vsix` file or the VS Code marketplace
2. **Open the sidebar**: the SpecKit icon is always visible in the activity bar; with no folder open, clicking it shows an empty-state panel with an **Open Folder** action
3. **Create a spec**: once a folder is open, click the `+` button in the Specs view to start your first feature

## Install the spec-kit Extension

There are **two** installs, and they're independent:

1. **The VS Code extension** (this product) — the Visual Spec Viewer, inline review comments, the sidebar, and command dispatch. Install it from the VS Code Marketplace (or a `.vsix`). This works on its own.
2. **The companion spec-kit *CLI* extension** — adds the leaner `/speckit.companion.*` pipeline (**Turbo** mode) and the lifecycle **capture** hooks that drive the Activity timeline. This is a [spec-kit](https://github.com/github/spec-kit) *CLI* extension, **not** a VS Code Marketplace extension, so it installs through the `specify` CLI.

**One-click from inside the editor.** When the spec-kit extension is missing, an **Install spec-kit extension** banner appears in the Create-Spec and Activity panels, and an install icon appears in the Specs sidebar. Click it and the extension runs the install in an integrated terminal — no copy-paste. (Already have it installed? You'll never see the banner.)

**Manual install.** You need a **github-source** spec-kit CLI first — the stock PyPI `specify-cli` does **not** ship the `extension` subcommand:

```bash
# 1. github-source spec-kit CLI (required: stock PyPI specify-cli lacks `extension`)
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git --force

# 2. the companion spec-kit extension (installs/updates; --force is idempotent)
specify extension add companion --from https://github.com/alfredoperez/speckit-companion/releases/download/companion-latest/companion.zip --force
```

> The `companion-latest/companion.zip` URL is a stable rolling asset — it always serves the newest build, so the same command installs **and** updates (re-run with `--force`). Once the extension is listed in the spec-kit catalog, it shortens to `specify extension add companion --force`.

**Update it later** from the Specs view **Upgrade…** menu → *Update spec-kit Extension* (runs the same install with `--force`).

![What installing the spec-kit extension unlocks: live progress capture, status, resume, the turbo pipeline, the complexity fast-path, and honest state recovery](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/install-banner.jpg)

## Setup & Components

SpecKit Companion is one extension that sits *on top of* a spec-driven workflow — it does not replace the command-line [spec-kit](https://github.com/github/spec-kit) process, and most of its pieces are optional. Here's what's actually required:

| Component | Required? | What it's for |
|-----------|-----------|---------------|
| **SpecKit Companion extension** | **Required** | Everything in this README — the Visual Spec Viewer, inline review comments, the sidebar, and command dispatch. Install it and the spec-review workflow works. |
| **spec-kit CLI** (`specify`) | Optional | Only needed to *run* the `/speckit.*` phase commands (specify / plan / tasks / implement) that the extension dispatches. Install it via `specify init` (the upstream spec-kit project). The viewer and review comments work without it. |
| **`.specify/` scaffolding** | Optional | Generated by `specify init` in your workspace; holds spec-kit's templates and the `/speckit.*` command definitions your host AI resolves. Present only if you use spec-kit phase commands. |
| **`companion` hook** in `.specify/extensions.yml` | Optional | Wires the extension's git steps (branch, commit) into spec-kit runs. A convenience for spec-kit users — not required for the extension itself. |

**What the extension does on its own.** The extension's only runtime coupling to an AI provider is dispatching command *text*: it assembles a prompt and hands it to a terminal CLI, the host editor's built-in chat, or the Claude Code panel. It never installs the spec-kit CLI for you and never reads a provider's response back. The Visual Spec Viewer and inline review comments read and write the spec markdown and `.spec-context.json` files directly, so they work with no CLI installed at all.

**Extension dispatch vs. running spec-kit in a terminal.** Whether a phase is driven by clicking a footer button in the viewer or by typing `/speckit.specify` yourself in a terminal, the work lands in the same place: the spec markdown under `.claude/specs/<spec>/` plus the `.spec-context.json` that tracks state. There is no separate extension-owned database — the on-disk spec files are the single source of truth. That makes the two surfaces interchangeable and never competing: drive a step from the terminal and the viewer reflects it on the next file change; drive it from the viewer and your terminal sees the same files. Neither "owns" the workflow — they're two front-ends over one set of files.

For the dispatch *styles* (terminal CLI vs. the editor's built-in chat vs. the Claude Code panel), see [Supported AI Providers](https://github.com/alfredoperez/speckit-companion#supported-ai-providers) — IDE Chat and Claude in VS Code route the prompt to an in-editor surface instead of a terminal, but the file-ownership model above is identical. For a deeper architecture walkthrough, see [`docs/how-it-works.md`](./docs/how-it-works.md).

## Sample Specs

Looking for "what does good look like?" The repo's own `specs/` directory is the answer. Every feature ships with the spec that drove it. A few worth opening:

- [`specs/008-spec-viewer-ux/`](./specs/008-spec-viewer-ux/): **full SpecKit flow**: spec, plan, research, data model, quickstart, tasks, plus checklists and contracts.
- [`specs/065-multi-select-specs/`](./specs/065-multi-select-specs/): **minimal SDD flow**: just `spec.md` + `plan.md` + `tasks.md` for a small UX change.
- [`specs/051-explorer-viewer-fixes/`](./specs/051-explorer-viewer-fixes/): **minimal SDD flow**: same minimal shape, applied to a focused bug-fix bundle.

Compare the file lists side by side to see the contrast between the full and minimal flows.

## Supported AI Providers

<!-- Column count must match the `speckit.aiProvider` enum length in package.json.
     The docs-consistency test in tests/integration/docs-consistency.test.ts enforces this on every `npm test`. -->

| Feature | Claude Code | GitHub Copilot CLI | Gemini CLI | Codex CLI | Qwen Code | OpenCode | IDE Chat | Claude in VS Code |
|---------|-------------|-------------------|------------|-----------|-----------|----------|----------|-------------------|
| **Steering File** | CLAUDE.md | .github/copilot-instructions.md | GEMINI.md | AGENTS.md | QWEN.md | AGENTS.md | Not supported | CLAUDE.md |
| **Steering Path** | .claude/steering/ | .github/instructions/*.instructions.md | Hierarchical GEMINI.md | Hierarchical AGENTS.md | .qwen/steering/ | Hierarchical AGENTS.md | Not supported | .claude/steering/ |
| **Agents** | .claude/agents/*.md | .github/agents/*.agent.md | Limited support | Hierarchical AGENTS.md | Not supported | .opencode/agent/*.md | Not supported | .claude/agents/*.md |
| **Hooks** | .claude/settings.json | Not supported | Not supported | Not supported | Not supported | Not supported | Not supported | .claude/settings.json |
| **MCP Servers** | .claude/settings.json | ~/.copilot/mcp-config.json | ~/.gemini/settings.json | ~/.codex/config.toml | ~/.qwen/settings.json | ~/.opencode/opencode.jsonc | Not supported | .claude/settings.json |
| **CLI Command** | `claude` | `ghcs` / `gh copilot` | `gemini` | `codex` | `qwen` | `opencode` | Built-in editor chat (Copilot / Composer / Cascade) | Claude Code GUI panel (no terminal) |

Configure your preferred provider: **Settings > speckit.aiProvider**

### IDE Chat

`IDE Chat` is not a CLI — instead of spawning a terminal, it routes the assembled
prompt to your editor's built-in AI chat (GitHub Copilot in VS Code, Composer in
Cursor, Cascade in Windsurf), detected automatically. Because the chat must
recognize the `/speckit.*` commands, **spec-kit must be initialized for the host
editor** (run **SpecKit: Initialize Workspace**, i.e. `specify init`). When the
workspace is initialized, IDE Chat auto-submits the prompt; when it isn't, it
prefills the chat and shows a warning instead of sending a command the chat can't
run. This is one-way dispatch — it does not read responses back or sync status.

![SpecKit Companion dispatching /speckit.plan into GitHub Copilot Chat in VS Code](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/copilot.png)

### Claude in VS Code

`Claude in VS Code` dispatches to the **Claude Code GUI panel** instead of
spawning the `claude` CLI in a terminal — for users who live in the panel rather
than a terminal. It shares the same `.claude/` setup as the terminal `claude`
provider (steering, agents, hooks, MCP). The extension opens the panel via Claude
Code's URI handler and **prefills** the command; the Claude Code panel exposes no
programmatic submit, so you **press Enter** to run it.
Requires the [Claude Code extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code);
if it isn't installed, the provider suggests switching to terminal `claude`.

![SpecKit Companion dispatching /speckit.implement into the Claude Code panel in VS Code](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/claude-vscode.png)

## Configuration

### Permission Mode

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

> **Copilot exception**: GitHub Copilot CLI cannot surface permission prompts in `-p` mode. Even with `permissionMode: "interactive"`, the extension auto-switches Copilot to auto-approve at dispatch time — otherwise the terminal would silently hang waiting for a prompt that never appears. This is enforced at runtime; dismissing the startup warning toast does not re-enable interactive mode for Copilot.

### Beta Features

The opt-in beta toggles appear under **Beta Features** in VS Code Settings in adoption-funnel order — the sequence you'd enable them in, not alphabetical:

| Order | Setting | Requires the spec-kit extension? |
|-------|---------|----------------------------------|
| 1 | `speckit.companion.installPrompt` — install banner when the extension is missing | No (its job is to surface the missing extension) |
| 2 | `speckit.companion.templateProfile` — default pipeline shape for new specs | Yes |
| 3 | `speckit.companion.turboWorkflowPicker` — per-spec turbo choice in Create-Spec | Yes |
| 4 | `speckit.companion.complexityFastPath` — fold plan/tasks into specify for small changes | Yes |
| 5 | `speckit.companion.resumeBeta` — resume (▶) button on sidebar specs | Yes |
| 6 | `speckit.viewer.activityPanel` — per-spec Activity timeline in the viewer | Yes |

Every toggle except the install prompt only functions when the [companion spec-kit extension](#install-the-spec-kit-extension) is installed; their settings descriptions carry the same note with that install link, so a toggle that looks inert is usually waiting on the extension. Each setting is detailed in the subsections below.

### Template Profiles

Selects the spec-kit pipeline shape for the project. This is an **opt-in beta** — it **defaults to `off`** (plain upstream spec-kit). **Both command families are always installed** — this setting only routes which one a spec dispatches. `standard` runs the stock `/speckit.*` commands (same sections, same files, with better timing capture); `turbo` runs the trimmed `/speckit.companion.*` commands (no user-story section, files/dependencies tasks, a smaller spec folder); `off` routes to the stock commands and opts out of the Companion install/repair step.

```json
{
  "speckit.companion.templateProfile": "off"
}
```

| Value | Behavior |
|-------|----------|
| `"off"` (default) | Routes to the stock `/speckit.*` commands and opts out of the Companion install/repair step. It won't remove `companion-standard` if a prior setting already installed it, so any timing-augmented bodies stay until you remove that preset yourself. |
| `"standard"` | Routes to the stock `/speckit.*` commands — unchanged, with timing baked in. |
| `"turbo"` | Routes to the trimmed `/speckit.companion.*` commands — the turbo shape. |

Switching is **non-destructive**: neither command set is ever removed or overwritten — only the dispatched shape changes, so you never hit "Unknown command" after a switch (the standard family is re-added automatically if a project is ever missing it). The value persists to `.specify/companion.yml` — a machine-local, gitignored mirror the extension writes and regenerates on activation, so your choice never leaks into another checkout — and each spec **pins** the project default the moment it's created, so changing the default never reshapes a spec already in flight. The turbo `/speckit.companion.*` commands ship with the [spec-kit extension](./speckit-extension/README.md), and the stock `/speckit.*` family stays present automatically; full reference in [`docs/template-profiles.md`](./docs/template-profiles.md).

**Per-spec turbo, at creation (beta).** Beyond the project default, you can pick **turbo for a single spec** from the **Workflow** dropdown in *Create New Spec* — a "SpecKit Companion" choice that pins turbo on just that spec, regardless of the default. It's an **opt-in beta** gated by `speckit.companion.turboWorkflowPicker` (`off | beta | on`, defaults to `beta`) and only appears when the Companion spec-kit extension is installed in the project; otherwise the dropdown is unchanged. Creating a spec without picking it keeps today's behavior (the project default). See [`docs/template-profiles.md`](./docs/template-profiles.md#selecting-a-profile--one-setting-routed-per-spec).

#### Mode comparison: off vs standard vs turbo

Which mode should you pick? The short version:

- **`off`** — plain upstream spec-kit. Stock `/speckit.*` commands, no Companion install, no timing capture. Pick this if you want zero changes to the spec-kit you already run.
- **`standard`** — the stock `/speckit.*` shape (same sections, same files) **plus** lifecycle timing capture that powers the Activity timeline. Pick this for the full spec-kit ceremony with the Companion overview on top.
- **`turbo`** — the trimmed `/speckit.companion.*` pipeline: no user-story section, files-and-dependencies tasks, a smaller spec folder, and the optional complexity fast-path for small changes. Pick this to move fast on focused work. Requires the spec-kit extension.

| | `off` | `standard` | `turbo` |
|---|---|---|---|
| Commands dispatched | stock `/speckit.*` | stock `/speckit.*` | trimmed `/speckit.companion.*` |
| User-story / scenario section | yes | yes | no |
| Tasks shape | per stock template | per stock template | files & dependencies |
| Activity timeline (capture) | no | yes | yes |
| Complexity fast-path available | no | no | yes (opt-in) |
| Needs the spec-kit extension | no | no | **yes** |

**Measured impact** comes from a 9-cell benchmark (`/bench-run-all`, 2026-06-10): the same feature set built through each mode at three sizes (easy / medium / hard), in isolated sandbox clones with a deterministic harness plus an independent judge. Wall-clock is a single sample per cell, so read timing as directional.

| Per size (easy / medium / hard) | `off` | `standard` | `turbo` |
|---|---|---|---|
| Spec size (`spec.md` lines) | 61 / 91 / 94 | 60 / 87 / 52 | 24 / 29 / 36 |
| Throwaway side files written | 3 / 4 / 4 | 0 / 3 / 0 | 0 / 0 / 0 |
| Wall-clock | 2m05s / 4m31s / 7m38s | 3m45s / 7m56s / 6m35s | 3m03s / 5m03s / 5m59s |

Turbo specs run roughly 60 to 68% leaner than `off`, write zero throwaway side files at any size (`research.md` / `data-model.md` / `quickstart.md` / `contracts/`), and trend fastest as the feature gets harder. Correctness was a tie: every cell in every mode shipped a passing, convention-following build (9/9 builds, all-green regression suite, 5.0/5 independent-judge rubric), so no mode needed rework. The difference is ceremony and progress visibility, not whether the feature works.

![Mode comparison chart: off vs standard vs turbo, with turbo the fastest to results](https://raw.githubusercontent.com/alfredoperez/speckit-companion/main/docs/screenshots/mode-comparison.jpg)

### Complexity Fast-Path

An **opt-in beta** that **defaults to `false`**. When enabled in `turbo` mode, small changes auto-detect and fast-track — folding plan and tasks into the specify pass instead of running them as separate stages. When `/speckit.companion.specify` decides a change is small (it projects ≤ 5 files / ≤ 10 tasks and reads no "larger" scope phrase like *rewrite* or *overhaul*), it writes **three lean files in one pass** — `spec.md` with an inline **Approach**, a **`plan.md`** pointer to it, and a real-checklist **`tasks.md`** — and folds plan and tasks into the same run, so the spec lands **ready-to-implement** in one run (the file-driven stepper and sidebar read the files as present, not "not created"; implement is the next user-triggered step). Larger changes keep the full specify → plan → tasks → implement pipeline; a change that crosses the 5-files / 10-tasks guardrail warns and runs the full pipeline rather than fast-tracking silently.

```json
{
  "speckit.companion.complexityFastPath": false
}
```

| Value | Behavior |
|-------|----------|
| `false` (default) | Force the full pipeline on every change — no combining, no warning. |
| `true` | Auto-detect small changes and fast-track them; larger changes keep the full pipeline. |

The flag is set in the editor (this setting) and mirrored into `.specify/companion.yml` — a machine-local, gitignored cache the command body reads — so the editor setting is the single source of truth. It applies only to the turbo `/speckit.companion.*` commands. Full reference in [`docs/template-profiles.md`](./docs/template-profiles.md#complexity-fast-path-turbo-only).

### Resume Button

An **opt-in beta** that **defaults to `false`**. When enabled, the sidebar shows a resume (▶) button on active specs (active / tasks-done) that dispatches the next pipeline step — picking up from the recorded step with prior decisions in scope, or the next unchecked task inside implement. Off by default, the button is hidden everywhere; toggling it on or off updates visibility immediately, with no window reload.

```json
{
  "speckit.companion.resumeBeta": false
}
```

| Value | Behavior |
|-------|----------|
| `false` (default) | The resume (▶) button is hidden on all specs. |
| `true` | The resume (▶) button appears on eligible specs (active / tasks-done). |

Resume dispatches the **command family the spec has been running** — a spec on the turbo flow resumes with `/speckit.companion.<step>`, a spec on the stock flow resumes with `/speckit.<step>` — based on the per-spec profile pin. Unlike the complexity fast-path, this gate lives only in VS Code settings; it is not mirrored into `.specify/companion.yml`.

### Command Format

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

### AI Context Instructions

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

The preamble adds ~200–300 tokens per dispatch and is identical across all providers (Claude, Gemini, Copilot, Codex, Qwen). Extension-side step-boundary writes remain the hard guarantee for `startedAt` / `completedAt`: this preamble unlocks finer-grained substep tracking.

### Step-Complete Notifications

When a dispatched spec step finishes, the extension shows a VS Code information message naming the spec and step (e.g. `Spec 074 · Plan complete`). The message includes an **Open spec** action that focuses the viewer for that spec. VS Code routes info messages to the native OS notification surface when the window is unfocused, so you can tab away during long runs.

```json
{
  "speckit.notifications.stepComplete": true
}
```

Set to `false` to silence the message while keeping the in-viewer elapsed timer.

### Spec Directories

By default, specs are discovered in `specs/` **and** `.specify/specs/` (the SpecKit CLI's own layout), so a spec created either way shows up without extra configuration. You can configure additional directories or use glob patterns:

```json
{
  "speckit.specDirectories": ["specs", "openspec/changes/*"]
}
```

Simple names (e.g., `specs`) list their children as specs. Patterns with wildcards treat each match as a spec folder.

### Custom Workflows

Define alternative workflows with custom steps, output files, and sub-documents. Any SDD methodology that uses commands and produces markdown files can be plugged into SpecKit Companion.

#### Real-world example: Agent Teams Lite

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

#### Basic example: remap default steps

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

#### Workflow Commands

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

#### Provider Compatibility

A workflow can declare which AI providers it supports with `supportedAiProviders`. When set, the workflow is **hidden entirely** unless the active `speckit.aiProvider` is in the list — it disappears from the workflow picker, the spec editor, and every step/footer action. Omit the field (or use an empty array) to support all providers.

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

A workflow whose commands are implemented as Claude Code skills (e.g. `/myflow:*`) can declare `["claude"]` to keep it from appearing — as a dead, unrunnable path — under GitHub Copilot, Gemini, Qwen, or Codex.

| Property | Required | Description |
|----------|----------|-------------|
| `supportedAiProviders` | No | Array of provider ids the workflow supports: `claude`, `gemini`, `copilot`, `codex`, `qwen`, `opencode`, `ide-chat`, `claude-vscode`. Omit or leave empty for all providers. An unknown id matches no real provider, hiding the workflow everywhere. |

The built-in default workflow has no declaration and is always available, so at least one workflow is always selectable regardless of provider.

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
| `command` | Yes | Slash command to execute (e.g., `"myflow.specify"`) |
| `label` | No | Display name in sidebar (defaults to capitalized `name`) |
| `file` | No | Output file for this step (defaults to `{name}.md`) |
| `actionOnly` | No | When `true`, the step has no output file and is hidden from the document tree (e.g., an "Implement" step that just runs a command) |
| `subFiles` | No | Array of child file paths shown under this step |
| `subDir` | No | Directory to scan for child `.md` files (non-recursive) |
| `includeRelatedDocs` | No | When `true`, unassigned `.md` files in the spec folder are grouped under this step. Only one step should have this flag. |

#### Behavior

- The sidebar shows only the steps declared by the active workflow
- Steps with missing output files appear as "not started"
- Steps with `actionOnly: true` are action-only. They appear in the workflow editor but not in the file tree
- When a spec is created via the editor, the selected workflow is automatically persisted to `.spec-context.json` in the spec directory
- If no workflow is selected, the `speckit.defaultWorkflow` setting is used (falls back to the built-in default)
- Once persisted, all subsequent operations (viewer, step execution, command palette) use the same workflow consistently
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
- `name`: Command identifier
- `title`: Display name in picker
- `command`: Slash command to execute
- `step`: Phase to show in: `spec`, `plan`, `tasks`, or `all` (default)
- `tooltip`: Description shown on hover
- `autoExecute`: Auto-run in terminal (default: true)
- `requiresSpecDir`: Inject spec directory (default: true)

## Spec Context (`.spec-context.json`)

Every spec directory holds a `.spec-context.json` file that is the single
source of truth for lifecycle state. The viewer derives badges, pulse,
highlight, and footer button visibility from this file only. File
existence is never used to infer step completion.

### Canonical schema

```json
{
  "workflow": "speckit-companion | speckit-terminal | <custom>",
  "specName": "060-spec-context-tracking",
  "branch": "060-spec-context-tracking",
  "currentStep": "specify | clarify | plan | tasks | analyze | implement",
  "status": "draft | specifying | specified | planning | planned | tasking | ready-to-implement | implementing | completed | archived",
  "history": [
    { "step": "specify", "substep": null, "from": { "step": null, "substep": null }, "by": "extension", "at": "ISO" }
  ]
}
```

`history[]` is the single append-only source of truth for step
boundaries. Per-step timing (start / completion / substeps) is derived
in-memory by the viewer; it is **not** persisted. Files written by older
versions that still carry `stepHistory` or `transitions` are accepted on
read and migrated on the next write.

The full JSON Schema lives at
`src/core/types/spec-context.schema.json` and
`specs/060-spec-context-tracking/contracts/spec-context.schema.json`.

### Extension-side lifecycle writes

The extension appends a `history[]` entry — start or completion — and
flips the canonical `status` whenever a step is dispatched (via the
SpecKit commands or the viewer's next-step / Regenerate buttons — the
next-step button is labelled with the upcoming phase name, e.g. `Plan`,
`Tasks`, `Implement`, or `Complete` on the final step), and when a
spawned terminal closes, independent of AI cooperation. Spec status
changes (`Mark as Completed`, `Archive`, `Reactivate`) write the
canonical status and append a history entry. Write failures log to the
SpecKit output channel without blocking dispatch.

Advancing `currentStep` is atomic: setting it to a new step always
appends the matching start-entry in the same write. `currentStep` ahead
of `history[]` is the failure mode that makes the viewer show a fake
"Generating <step>…" with no actual progress.

### Invariants

- Unknown top-level fields are preserved across writes.
- `history` is append-only. Never rewrite prior entries.
- The last `history[]` entry's `step` matches `currentStep`.
- When the viewer opens a spec with no context file, it writes a minimal
  `draft` document; no step is marked completed from file presence alone.

### Status vocabulary

`draft` → `specifying` → `specified` → `planning` → `planned` → `tasking` →
`ready-to-implement` → `implementing` → `completed` → `archived`.

Legacy shapes (`status: "active"`, `status: "tasks-done"`, or files that
only contain `{ status: "completed" }`) are coerced by
`normalizeSpecContext` at read time.

### Recovering a malformed context file

A `.spec-context.json` that is *syntactically* broken — a truncated write, a hand edit, or merge-conflict markers — cannot be parsed, so the viewer falls back to a read-only, draft-state render of the spec. Instead of failing silently, it surfaces an error notification naming the JSON parse error and the offending file path, with a **Reset context** action. Choosing **Reset context** moves the broken file aside to a timestamped backup (`.spec-context.json.bak-<timestamp>`) and writes a fresh minimal skeleton in its place, then reloads the viewer. The original bytes are never overwritten in place — they survive in the backup so you can salvage lifecycle history by hand. Dismissing the notification leaves the broken file untouched; reopening the spec re-offers the reset. (This covers JSON-syntax failures only — a file that parses but is semantically off is tolerated and coerced as above.)

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

| Platform     | Support  | Notes                                                                       |
| ------------ | -------- | --------------------------------------------------------------------------- |
| macOS        | Yes      | Fully supported                                                             |
| Linux        | Yes      | Fully supported                                                             |
| Windows WSL  | Yes      | Supported                                                                   |
| Windows      | Yes      | All bash-only providers (Copilot, Claude, OpenCode, Qwen) auto-detect PowerShell and use the equivalent `Get-Content -Raw` substitution; cmd.exe is supported on a best-effort basis (long prompts may exceed cmd's 8191-char line limit — switch to PowerShell or Git Bash if you hit it). |

## Contributing

PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, the `F5` dev-host loop, test conventions, the Conventional Commit style this repo uses, and the README docs map you should follow before opening a PR.

## Acknowledgments

This project started from the amazing work at https://github.com/notdp/kiro-for-cc

## License

MIT License
