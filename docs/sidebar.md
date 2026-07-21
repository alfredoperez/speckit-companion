# Sidebar Reference

Detailed reference for the SpecKit Companion sidebar. For an overview, see the [main README](../README.md#sidebar-at-a-glance).

The sidebar is native VS Code throughout — the editor owns row height, indentation, keyboard navigation, focus, selection, hover surfaces, and menu rendering. There is no webview and no custom styling anywhere in it.

## The four views

The SpecKit activity-bar container holds four views, contributed in this order:

| View | What it holds | Default |
|------|---------------|---------|
| **Specs** | Per-feature specs, grouped by lifecycle | Visible, expanded |
| **Living Specs** | Durable capability documents (was *Spec Explorer*) | Collapsed; shown only when the companion spec-kit extension is installed |
| **Steering** | Provider rules, agents, skills, SpecKit project files, references | Visible |
| **Settings & Feedback** | Open Settings, Report a Bug, Request a Feature, Rate on Marketplace | Collapsed, hidden by default |

You can reorder the views yourself; the contribution order is a default, not an override.

## Spec groups

Specs are grouped into three collapsible sections based on their status (stored in `.spec-context.json`). Each group header displays a count, e.g. `Active (3)`, `Completed (12)`, `Archived (8)`.

- **Active** — Specs in progress, ordered by numeric prefix (newest first) by default, **expanded** by default. This group also holds **implemented** specs — ones where the pipeline finished the implement step but you have not yet confirmed them done. They stay in Active (not Completed) so the still-needs-your-Mark-Complete state stays visible, which matters most for stock specs that never auto-complete. They are told apart from in-progress specs by icon tint — see [Spec tree icons](#spec-tree-icons).
- **Completed** — Specs you have explicitly marked done (status `completed`), **collapsed** by default. An `implemented` spec does **not** appear here until you confirm it.
- **Archived** — Specs moved to archive, **collapsed** by default.

A group with zero specs is omitted entirely.

**Individual spec rows start collapsed**, including active ones. A workspace with hundreds of completed specs therefore opens to a short, readable list rather than a flood of document rows. Use **Expand All** (from More Actions, or the Command Palette) to open every row for the session.

## Opening a spec

**Click a spec's name to open it.** The viewer opens for that spec and lands on its **Overview** — the durable-context dossier: why the spec exists, what constrained it, what was verified, the decisions, and the requirement-to-test map. A spec with no recorded run has no Overview, so it opens on its first available document instead; that is the viewer's own landing rule, not a second decision made by the tree. If the spec's viewer is already open, the click reveals it and returns it to the Overview rather than opening a second panel.

The name click also toggles the row, so the spec's documents come into view with it — the same way the editor's Testing view both opens a suite's file and expands it. **To browse without opening the viewer, click the chevron**: it expands and collapses the row on its own.

Clicking a **document** row still opens that document, exactly as before.

## Title toolbar

The Specs title bar shows **at most four actions**, always in this order:

1. **Filter…** (`$(filter)`)
2. **Sort…** (`$(sort-precedence)`)
3. **More Actions…** (`$(ellipsis)`)
4. **New Spec** (`$(plus)`) — the trailing, rightmost primary action

Everything that used to crowd the toolbar now lives behind **More Actions**, which is a **native VS Code menu** — it drops open directly under the `…` button, and VS Code owns its rendering, hover, keyboard navigation, and theming. Its entries are gated by the same conditions the old title buttons used:

```text
Collapse All / Expand All        whichever the tree's current state calls for
─────────────────────────────
Install Companion Extension      when spec-kit is available and the companion isn't installed
Upgrade…                         when spec-kit is detected or its CLI is installed
```

A native menu expresses grouping with a **separator line** rather than a labelled section header, so the two groups (view actions, then maintenance) read as two blocks with a rule between them.

Every one of those commands also remains available from the Command Palette under `SpecKit: …`.

**Living Specs** carries two title actions — **Refresh** and **Adopt Code Area…** (trailing). **Steering** carries **Refresh** and **New Steering Document…** (trailing). **Settings & Feedback** carries none.

## Filter and sort

**Filter** — click the filter icon to fuzzy-filter specs by slug or feature name. Matches are case-insensitive and subsequence-based, e.g. `ftr` matches `filter-specs-tree`. The input is **prefilled with the current query**, so edits are incremental, and **submitting an empty value clears the filter** — which is why there is no separate clear-filter icon in the toolbar. The query is persisted to workspace state and restored on the next activation. An empty-result message offers a one-click clear when no specs match, and `SpecKit: Clear Filter` remains in the Command Palette.

**Sort** — click the sort icon to open a compact picker with a check on the current order:

| Option | Meaning |
|---|---|
| **Number** | Default · Highest number first |
| **Name** | A–Z |
| **Date Created** | Newest first |
| **Date Modified** | Recently edited first |
| **Workflow Step** | Current progress |

Ties fall back to numeric prefix then name so output is deterministic. The chosen mode is persisted to workspace state; group order (Active → Completed → Archived) is fixed.

## Maintenance actions

The spec-kit upgrade commands are consolidated behind a single **Upgrade…** entry in the More Actions menu. Choosing it opens a picker with three options. **Upgrade All** and **Upgrade Project** resolve the `--ai` agent from your configured `speckit.aiProvider` (see [`docs/how-it-works.md`](how-it-works.md)) and re-scaffold with `specify init --here --force`; **Upgrade CLI** only upgrades the globally installed spec-kit CLI.

- **Upgrade All** (`speckit.upgradeAll`) — upgrades the spec-kit CLI, then re-scaffolds the project. The "just do it" choice.
- **Upgrade Project** (`speckit.upgradeProject`) — re-runs `specify init` in place to refresh this workspace's scaffolding only.
- **Upgrade CLI** (`speckit.upgradeCli`) — upgrades only the globally installed spec-kit CLI.

The entry appears when either spec-kit is detected in the workspace or the CLI is installed. All three individual commands remain available from the Command Palette under `SpecKit: Upgrade …`.

## Hover actions

A spec row shows **at most two** icons on hover:

1. **Resume** (`$(play)`) — only when the spec is currently eligible (see below).
2. **More Actions…** (`$(ellipsis)`) — the submenu described under [Right-click and multi-select](#right-click-and-multi-select).

A spec **document** row shows **Open Source File** on hover when the file exists; a related document does too. A missing document shows no action at all — no dead clicks.

In Steering, generated steering documents keep their **Refine** action, and an uninstalled Companion node keeps its inline **Install**. Reveal lives in the right-click menu everywhere, to keep the tree quiet.

## Resume (inline action)

Resume is available out of the box — there is no enable setting. Active specs show an inline **Resume** action on hover whenever the companion spec-kit extension is installed. Clicking it dispatches `/speckit.companion.resume` for that spec: the pipeline continues from the recorded step — with prior decisions in scope — and the next command is dispatched to your configured AI provider in the family the spec has been running (`/speckit.companion.<step>` for Companion specs, `/speckit.<step>` for stock specs). Inside the implement step it continues at the next unchecked task. Resume appears only on active specs (active / tasks-done), not on completed or archived ones, mirroring the lifecycle — and only when the companion spec-kit extension is installed (the resume command has no stock equivalent, so without the extension the button hides; a direct invocation shows an install-extension warning instead of dispatching). Once the dispatched step's capture hook writes state, the sidebar updates the row's step, badge, and last-transition line without a manual refresh.

## Set Status… (recovery escape hatch)

If an out-of-order or double click ever leaves a spec stranded — the lifecycle buttons won't let you continue and the only fix used to be hand-editing `.spec-context.json` — **Set Status…** gets it moving again. It's an advanced recovery action, so it lives in the spec row's **More Actions** menu (and the identical right-click menu) rather than taking a permanent hover slot. Choosing it opens a picker of the eight canonical lifecycle statuses (specifying, specified, planning, planned, ready-to-implement, implementing, implemented, completed); pick one and confirm the `"Force status to {status}?"` prompt, and the spec is forced to that status. Forcing a working status also re-points the spec's current step to that status's own phase (e.g. forcing "planning" puts the spec back on the Plan step), so the viewer's continue buttons and the spinning step indicator line up with where you just said the spec is. The override goes through the same sanctioned writer the rest of the lifecycle uses — it records the change as a history event authored by you, never a raw JSON edit — and the sidebar refreshes immediately. Because it bypasses the normal lifecycle gates, the confirm is always shown; a completed spec is only ever moved by your explicit pick, never silently downgraded.

## Step and last-transition on the row

Each spec row's description shows what its per-document step icons cannot: the active task and how long ago the spec was last touched (e.g. `T004 · 22h ago`), derived from the canonical append-only `history[]`. Relative time is measured from the most recent history entry, not from when the step started.

The tooltip is a short multi-line card:

```text
393-wibey-provider-support
Status: Ready to Implement
Last activity: Plan completed · 22h ago
```

The status is always the friendly Title Case label — a raw lifecycle key like `ready-to-implement` never reaches the UI. Duplicate-named specs show their parent directory in the description instead of the activity line, to disambiguate.

## Right-click and multi-select

The spec row's **hover More Actions** submenu and its **right-click menu** present the same actions, in the same order, in five groups — so the two surfaces can never disagree, and the one destructive action is isolated at the bottom:

```text
1_status     Set Status…
2_lifecycle  Mark Complete / Archive / Reactivate
3_copy       Copy Spec Name
             Copy Spec Path
4_reveal     Reveal in VS Code Explorer
             Reveal in File Manager
5_danger     Delete
```

Menu items reflect the spec's lifecycle group — e.g. **Reactivate** appears only on completed or archived specs. **Mark Complete** appears on active, tasks-done, and **implemented** specs: an implemented spec sits in the Active group but still needs your confirmation, so the menu offers Mark Complete to flip it to confirmed-completed.

**Copy Spec Path** copies the workspace-relative spec directory (e.g. `specs/060-spec-context-tracking`) to the clipboard; **Copy Spec Name** copies just the slug. Both show a brief auto-dismiss notification. They appear on specs in any lifecycle and are not shown on document children, related docs, or group headers.

**Multi-select** specs with shift-click or cmd/ctrl-click and bulk-archive, complete, or reactivate from the same right-click menu.

**Document rows** offer both reveal actions when the file exists, plus **Open Source File** on hover. A missing document offers neither.

## Group header bulk actions

Right-click a group header to apply a lifecycle transition to every spec in the group at once. The visible items reflect the group:

- **Active** — *Mark All Complete*, *Archive All*
- **Completed** — *Reactivate All*, *Archive All*
- **Archived** — *Reactivate All*

Each action shows a confirmation dialog of the form `"{Action} all {N} {group} specs?"` before any `.spec-context.json` files are written. Specs already in the target status are silently skipped, and if the post-skip set is empty no dialog is shown. When a filter is active, the count reflects only the visible specs — the action operates exclusively on the visible set.

## Lifecycle button matrix

The spec viewer footer shows lifecycle buttons based on the spec's current status:

- **Active** (tasks incomplete): Regenerate, Archive, + primary CTA (Plan / Tasks / Implement depending on next step)
- **Active** (tasks 100% complete): Archive + Complete (primary)
- **Completed**: Archive + Reactivate
- **Archived**: Reactivate only

The lifecycle flow is **Active → Completed → Archived**, with **Reactivate** available on Completed and Archived specs to return them to Active.

## History logging

Every workflow step change is automatically recorded in the `history` array inside `.spec-context.json`. Each entry captures the previous step, new step, source (`extension`, `cli`, `ai`, or `user`), and timestamp. External changes (for example, from terminal CLI tools) are detected via file watcher and logged to the SpecKit output channel.

## Badge and dates

Both badge text and dates are derived from `.spec-context.json` (the single source of truth for workflow state):

- The **badge** in the viewer's metadata bar shows the current workflow state (e.g., `SPECIFYING`, `PLANNING`, `IMPLEMENTING`, `COMPLETED`). Hidden when no context exists.
- **Created** and **Last Updated** dates are derived from `history[]` timestamps. Gracefully omitted when context is missing or incomplete.
- Specs with only a `.spec-context.json` (no markdown files yet) still appear in the explorer, so in-progress specs are always visible.

## Header badge color tiers

Every canonical status is mapped to a distinct color treatment so badges read at a glance without re-reading the label.

- **In-progress** (`SPECIFYING`, `PLANNING`, `TASKING`, `IMPLEMENTING`) — accent-tinted with a gentle border breath animation.
- **Intermediate-done** (`SPECIFIED`, `PLANNED`, `READY-TO-IMPLEMENT`, `COMPLETED`) — success-subtle (quiet green tint).
- **Idle** (`DRAFT`, `ARCHIVED`) — muted token, low visual weight.

## The icon system

One rule: **Codicons for meaning, custom art for identity.** Every functional and status concept in the sidebar uses a themed VS Code icon, so it inherits light, dark, and high-contrast behavior from the editor. The only custom artwork left is the product's own mark and the official provider logos. No tree row uses an emoji, and no status depends on color alone — shape, group, description, and tooltip all carry it too.

### Spec tree icons

Group headers:

| Group | Icon |
|---|---|
| Active | `pulse` |
| Completed | `pass-filled`, tinted with the theme's "passed" color |
| Archived | `archive` |

Spec rows carry a color-tinted beaker for their lifecycle:

- **Plain beaker** — a new spec with no recorded step yet
- **Blue beaker** — a spec with an active workflow step (in progress)
- **Yellow beaker** — an implemented spec (pipeline finished implement, awaiting your Mark Complete confirmation); it sits in the Active group, where the tint distinguishes it from still-in-progress specs
- **Green beaker** — a confirmed-completed spec
- **Spinner** — a workflow step is running right now; the tooltip says so in words as well

Document rows carry their **own** state, independent of the parent spec's lifecycle — so expanding a completed or archived spec still shows a coherent picture rather than a blank list. One derived state drives both the icon and the tooltip, so the two can never disagree:

- **Green check — "Complete"** — the workflow finished this step (or the whole spec is completed/archived) *and* the file holds real content.
- **Blue dot — "In Progress"** — the step is the current one, or the workflow considers it done but the file is still a stub. A finished spec does not force a green check onto a stub file.
- **Hollow circle — "Not Started"** — the file exists but the workflow has not reached this step.
- **No icon — "Not Created"**, with a `not created` note — the step's file does not exist yet. Such a row offers no open or reveal action.

### Living Specs icons

`folder` for a directory group in the capability tree, `question` for Orphans, `symbol-namespace` for a capability (in the warning color when it has drifted), `circle-outline` for a capability whose spec does not exist yet, `book` / `type-hierarchy` / `checklist` for the Spec, Architecture, and Coverage tiers, and `info` for the disabled and empty states.

### Steering icons

`root-folder` for Project, `account` for User, `hubot` for Agents, `tools` for Skills, `gear` for Settings, `library` for SpecKit Project Files, `law` for the Constitution, `terminal` for Scripts, `files` for Templates and Steering Docs, `references` for References, and `warning` (in the warning color) for a skill with invalid frontmatter. Leaf files stay iconless, which keeps the indentation legible. The Companion node keeps the moss mark; the provider node keeps its brand logo.

### Provider icons

The provider row's **label and mark always name the same product** — both are resolved from the same host-editor detection, so they cannot drift apart:

| Provider | Mark |
|---|---|
| Claude, Claude (VS Code) | Claude logo |
| Gemini | Gemini logo |
| Qwen | Qwen logo |
| GitHub Copilot | Copilot logo (light/dark) |
| Codex | Codex logo (light/dark) |
| OpenCode | OpenCode logo (light/dark) |
| IDE Chat in VS Code | Copilot logo |
| IDE Chat in Cursor | Cursor logo |
| IDE Chat in Windsurf | Windsurf logo |
| IDE Chat in any other host | Neutral chat icon — **never** another vendor's branding |
| Wibey CLI, Wibey (VS Code) | Neutral chat icon (documented fallback — no official Wibey mark ships with the extension) |
| Anything unrecognized | Neutral chat icon |

The monochrome brand marks ship light/dark variants so they stay legible on both themes.

## Living Specs

The **Living Specs** view (formerly *Spec Explorer*) is a project-wide home for *living specs* — the long-lived capability documents that describe how a part of your codebase behaves, separate from the per-feature specs in the Specs view above. It appears in the SpecKit activity-bar container **only when the companion spec-kit extension is installed** (`.specify/extensions/companion/` exists on disk); projects that don't use living specs never see it. It starts collapsed.

**A directory tree, not a flat list.** Capabilities are grouped into a folder tree that mirrors where their specs actually live, so the shape matches the codebase — a capability whose spec sits at `src/features/specs/specs.spec.md` shows up as a `specs` leaf under a `src` → `features` folder path, and siblings in the same area sit together. Each folder group is a plain directory node; the capability leaves carry the row health and every action. This replaces the old flat list where each row wore a grey `central`/`colocated` word — the tree now conveys location, so that word is gone.

Below the capability tree, one more group:

- **Orphans** — spec files in the project that no capability claims, in either layout: a colocated `*.spec.md`, or a central `capabilities/<name>/spec.md`. The feature `specs/` folder, reserved tier siblings (`*.arch.md` / `*.coverage.md`), claimed spec paths, and any file inside a configured capability's folder are excluded, so only genuinely-unowned specs appear here. Nested projects are excluded too: any directory below the workspace root that carries its own capability registry is a separate project, and the scan stops at it — sample apps, fixtures, and sandboxes inside your repo never show up in the parent's orphan list, and neither do specs shipped inside installed dependencies. The group is omitted entirely when there are none.

Each capability is defined in `living-specs.yml` at the project root (or, for a project that has not moved yet, the legacy `livingSpecs` block in `.specify/companion.yml`) and labelled with the capability name. A capability whose spec file doesn't exist yet is still listed, shown with a hollow icon and a `not created` note — it has no open action and no file actions rather than a broken click. Expanding a capability reveals its **tiers**: the **Spec** itself, plus an **Architecture** and a **Coverage** child, each shown only when that sibling file exists on disk.

Clicking any capability spec, tier, or orphan opens that file in the editor.

**Actions.** Right-clicking a capability offers **Check for Drift** and **Check Requirement Coverage** — each sends the matching `/speckit.companion.{drift,coverage}` command (scoped to that capability) to your configured AI assistant — plus the standard file actions the Specs tree offers: **Copy Name**, **Copy Path**, **Copy Relative Path**, **Reveal in VS Code Explorer**, **Reveal in File Manager**, and **Delete** (single-file, with the same "this cannot be undone" confirmation destructive actions get elsewhere — it removes the spec/tier file only, never the surrounding code folder). Those file actions are on the tier and orphan rows too. The view's title bar carries **Adopt Code Area…** (starts the brownfield adoption wizard, useful from the empty state as the on-ramp) and a **Refresh** button that recomputes the tree and its health signals.

**Update a drifted spec.** When a capability has drifted — code changed since the spec's last commit — the right-click menu gains an **Update to Match Code** action (it appears only while the row is drifted). It gathers the files that changed and dispatches an instruction to your AI assistant to bring the spec back in sync: *update, do not regenerate* — every clarification, requirement, and scenario already written is preserved, and only what the code changes require is revised. The same **Update** button also sits next to the `drift` marker in the spec viewer's header, so you can act on drift from wherever you spotted it.

**Row health.** Each capability row carries a lightweight health readout, computed by the extension itself without dispatching anything: when the capability has a coverage tier, the description shows how many requirements have a mapped test (e.g. `3/5 covered`); when files matching the capability changed since its living spec's last commit, the row gains a `drift` note and the capability icon turns the warning color, with the tooltip explaining both. The computation is best-effort and time-bounded — no git, missing files, or a slow repo simply renders the row exactly as before, never an error or a stall.

**The viewer shows the same numbers.** Opening a capability puts its coverage count and drift marker in the spec viewer's header alongside its requirement and scenario counts, the file patterns it claims, and where its spec lives. Both surfaces read one computation (`readCapabilityHealth` in `src/features/specs/livingSpecsModel.ts`), so a row and its open spec can never report different figures. See [`docs/viewer-states.md`](./viewer-states.md#living-spec-header).

**Empty and hidden states.** The view **never renders as a blank panel**. When living specs are turned off (`enabled` is not `true`) it shows one calm row, `Living Specs are off`, whose tooltip explains how to enable them; when they're on but nothing is found it shows `No living specs yet` with a pointer to the adopt wizard. Neither is an error, and neither row is clickable. The view refreshes automatically when `.specify/companion.yml`, the `capabilities/` tree, or any `*.spec.md` changes on disk, and when the companion extension is installed or removed — no window reload required.

**A leftover legacy block is called out.** When `living-specs.yml` answers and `.specify/companion.yml` still carries a `livingSpecs` block, the view adds a notice row above everything else saying those entries are ignored. The old block is left on disk rather than deleted — its capabilities were never carried across, so removing it for you would lose them — and the notice tells you to move anything still worth keeping before deleting it yourself.

**An unreadable registry says so.** If `living-specs.yml` exists but won't parse, the view shows an error row — `Can't read living-specs.yml` — with the parse failure in its tooltip, instead of the `Living Specs are off` row. The distinction matters: a file that never parsed can't be fixed by changing a setting inside it, so pointing you at `enabled: true` would send you the wrong way. An unreadable registry is also never quietly replaced by the old `.specify/companion.yml` block — the extension refuses to fall back rather than resurrect a set you'd already moved on from.

## Steering

The Steering root is built in one explicit order:

```text
Steering
  Companion
  <Configured Provider>
    Project
      <provider steering file, or Create Project Rule>
      Agents
      Skills
      Settings
    User
      <provider steering file, or Create User Rule>
      Agents
      Skills
      Settings
  Steering Docs
  SpecKit Project Files
    Constitution
    Scripts
    Templates
  References
```

Only sections that have content are shown — except the Companion and Provider nodes, which are stable entry points. The vocabulary is **User**, never "Global".

**Missing rule actions are nested where they belong.** When your provider's project or user rule file doesn't exist yet, the create action appears **inside** that scope's group rather than floating at the tree root, and it names your provider's real filename: `Create project-level GEMINI.md`, `Create user-level QWEN.md`, `Create project-level AGENTS.md`. It never hard-codes `CLAUDE.md`.

**Every file-backed row** in this tree — steering documents, provider steering files, provider settings, agents, skills, the Constitution, scripts, templates, references, and the Companion's configuration, commands, and templates — offers **Reveal in VS Code Explorer** and **Reveal in File Manager** on right-click. Destructive actions stay restricted to the steering documents the extension generates: only those offer **Refine** and **Delete Steering**. Provider-owned and SpecKit-owned files can be revealed and opened, never deleted from here.

Refreshing the tree invalidates it immediately — there is no artificial loading flicker.

### Companion node (Steering view)

The **Companion** node — marked with the moss icon, positioned first — gives SpecKit Companion a home alongside your steering docs, agents, and skills. It answers three questions at a glance: is the companion extension installed, where does its configuration live, and which commands does it provide.

**Not installed.** When the companion spec-kit extension is absent from the project (no `.specify/extensions/companion/` directory), the Companion node shows a warning icon and a **Not installed** label, and offers an inline **install** action on hover. Clicking it runs the same install flow surfaced elsewhere in the extension; once it finishes, the node switches to the moss icon and its children populate — no window reload needed.

**Installed.** When the extension is present the node expands into up to three groups:

- **Configuration** — clicking it **opens `.specify/companion.yml` directly**; expanding it lists one entry per top-level setting group in that file (for example `commands`, `hooks`, `livingSpecs`), each of which also opens the file. The group is omitted entirely when the file is absent, and the open target is validated to stay inside the workspace.
- **Commands** — the full `/speckit.companion.*` set, with each command's description on hover. Clicking a command opens its body file (the prompt the command runs) from the installed extension. The list is read live from the installed extension's manifest, so commands the extension adds later appear automatically with no update to the GUI.
- **Templates** — the prompt templates the Companion preset ships (the per-step command bodies it installs over stock SpecKit). Clicking one opens the template file. Shown only when the installed extension actually carries preset templates.

The Companion node refreshes on its own when the extension is installed or removed, or when `.specify/companion.yml` changes.

## Accessibility

- All rows, disclosure controls, title actions, inline actions, and menus are reachable by keyboard — VS Code owns the navigation model, and the redesign adds nothing that bypasses it.
- Every icon-only title and inline action takes its hover label from its contributed command title, which is why those titles are short and unambiguous.
- No status is conveyed by color alone: icon shape, group membership, the row description, and the tooltip each carry it independently.
- The only animation in the tree is the native running-step spinner, and the tooltip says a step is running in words as well.
