# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **Resume button is now an opt-in beta** (#140): the sidebar resume (▶) button ships under the "Beta Features" group and defaults to off. Enable `speckit.companion.resumeBeta` to show it on active specs (active / tasks-done); toggling it on or off updates visibility immediately, with no window reload. Resume now also dispatches the command family the spec has been running — a turbo spec resumes with `/speckit.companion.<step>`, a stock spec with `/speckit.<step>` — across every step it can advance.
- **Complexity fast-path** (#137): an opt-in beta (off by default) that, in `turbo` mode, fast-tracks small changes straight from specify to implement, skipping the separate plan and tasks stages. When a change projects at or under 5 files / 10 tasks (and reads as a small change), specify writes a single combined `spec.md` — the usual sections plus an inline Approach and Implementation Tasks list — and lands the spec at the implement step in one run. Larger changes keep the full pipeline; a change that crosses the 5-files / 10-tasks guardrail warns and runs the full pipeline rather than fast-tracking silently. Enable it with the `speckit.companion.complexityFastPath` setting. See `docs/template-profiles.md`.
- **Template profiles** (#132, #134): a new `speckit.companion.templateProfile` setting (`standard` | `turbo` | `off`, default `off`) picks the shape of the spec-kit pipeline. `standard` runs the stock commands; `turbo` produces a trimmed shape — a spec with no user-story section, tasks grouped by files/dependencies, and a smaller spec folder; `off` falls back to plain upstream spec-kit. **Both command sets stay installed at all times** — switching the setting is non-destructive: it only routes which one a spec uses and never deletes either, so creating a spec never fails with "Unknown command", in any mode or after any number of switches. Each spec pins the project default the moment it's created, so changing the setting reshapes only new specs, never one already in flight. See `docs/template-profiles.md`.

### Changed

- **Clearer Beta Features descriptions** (#140): the four Beta Features settings (Activity panel, template profile, complexity fast-path, resume button) now lead with what they do before how they work, reading at about two lines each in the settings UI. No setting keys or values changed.
- **Template profiles and the complexity fast-path are now opt-in beta** (#137): both ship under a "Beta Features" settings group and default to off — `speckit.companion.templateProfile` now defaults to `off` (plain upstream spec-kit) and `speckit.companion.complexityFastPath` defaults to `false`. Turn template shaping on by selecting `standard` or `turbo`; existing projects that already pinned a profile are unaffected.
- **The trimmed profile is named "turbo"** (#226): the trimmed pipeline shape ships under the `turbo` value of `speckit.companion.templateProfile`; its pre-release working name "lean" was dropped before any release, so there is no old value to migrate.
- **More accurate timing in the activity panel** (#215): per-task and per-substep durations are now measured from single finish events rather than reconstructed from start/complete pairs. This removes the `0s` ticks, the unattributed gaps between tasks, and the substep "bursts" that previously showed up in the timeline, so per-step and per-task durations read accurately. See `docs/capture-and-timing.md`.
- **The in-flight indicator now lives on the step tab, not the footer** (#277): a running step used to show two competing cues — a "Generating…" pill at the bottom and the step tab. The footer pill is gone; the step tab is now the single "AI is working" signal, and during implement it shows a spinning indicator next to the live task percentage instead of a static "Tasks 0%". While a step is still in flight the footer no longer offers the next-step button (there's nothing to advance yet). Reduced-motion users get a static indicator.

### Fixed

- **A finished implementation reliably shows as done** (#277): when every task was checked and the work committed, the viewer could keep spinning and the timer keep counting indefinitely. Completing any step — specify, plan, tasks, or implement — now updates the open viewer on its own within a second or two, the spinner stops, and the next action appears, with no need to switch steps. This works wherever your specs live, including the configured spec directories rather than only the legacy location.
- **Newly-created specs appear instead of stranding on the welcome screen** (#270): a spec created under the SpecKit CLI's `.specify/specs/` layout was never discovered, so the sidebar stayed stuck on "Welcome to SpecKit / Create your first spec". `.specify/specs` is now scanned by default, and a freshly-created spec clears the welcome screen and lists itself without reloading the window.
- **In-app update notifications fire again, and install links resolve** (#274): the extension referenced a retired publisher handle, which silently disabled the "a new version is available" notification and pointed every Marketplace/OpenVSX install and listing link at a dead (404) page. The update check now reads your installed version reliably and the links resolve to the live listing. The check also compares only against the VS Code releases, so a spec-kit-side release no longer masquerades as a newer GUI version.
- **Switching modes no longer deletes your commands** (#134): selecting the trimmed shape used to swap command bundles in a way that could leave a project with no usable pipeline commands — creating a spec then failed with "Unknown command: /speckit-specify". The mode is now a non-destructive routing choice: both command sets are always present, and a project left without its stock commands by an earlier version recovers automatically on the next reload.

## [0.22.0] - 2026-06-07

### Added

- **Live per-task journaling on implement** (#130): the implement-step context preamble now instructs the AI to append a `history[]` entry as it finishes *each* task (`substep`/`task` = the task id, `by: "ai"`, real `date -u` timestamp), so the activity log shows real per-task timing instead of one end-of-run burst from the `after_implement` hook. The live entries carry the `task` id, so the hook's `--tasks-file` sync dedupes against them and becomes a no-op backstop (it still journals everything when the preamble is disabled). Applies to single-step `/speckit.implement` and multi-step/auto lifecycle runs.
- **Status + Resume in the sidebar** (#130): each active spec row now shows its current step and a one-line **last transition** (e.g. `plan — Plan started · 2h ago`, derived from the canonical `history[]`), plus an inline **Resume** action (`$(play)`). Resume dispatches `/speckit.companion.resume` for the spec via your configured AI provider — continuing the pipeline from the recorded step with prior decisions in scope, and at the next unchecked task when mid-implementation. The action is gated to active specs (not completed/archived) and the row updates live once the dispatched step records its state. Backed by two new Companion spec-kit commands (`speckit.companion.status` / `speckit.companion.resume`) and a `status-context.py` resolver that reads `.spec-context.json` or derives state from on-disk files when it's missing. Resume works on the stock spec-kit version (no `specify workflow resume` subcommand required).
- **Recovery for a malformed `.spec-context.json`** (#144): when a spec's context file exists but is not parseable JSON (truncated write, hand edit, merge-conflict markers), the viewer now surfaces an error notification naming the JSON parse error and the offending file path — instead of silently falling back to a read-only draft render. The notification offers a **Reset context** action that moves the broken file aside to a timestamped backup (`.spec-context.json.bak-<timestamp>`) and writes a fresh minimal skeleton in its place, then reloads the viewer. The original bytes are never overwritten in place (they survive in the backup); dismissing the notification leaves the broken file untouched and reopening the spec re-offers the reset. The reader now throws a typed `SpecContextParseError` (carrying `filePath` + `reason`) so the corrupt-file case is distinguished from a missing file without sniffing message text. JSON-syntax failures only — semantically-off-but-parseable files are still tolerated and coerced.

### Fixed

- **`upgradeProject` / `upgradeAll` sent an invalid `--ai claude-code`** (#195): the upgrade actions ignored the configured AI provider and always passed `--ai claude-code`, which the spec-kit CLI rejects with `Unknown agent 'claude-code'`. A pure resolver now maps `speckit.aiProvider` (and the host editor, for `ide-chat`) to a valid CLI agent; both dispatch sites route through it, and an unrecognized provider falls back to `claude`. The three upgrade commands are consolidated behind a single **Upgrade…** picker, and a stale `speckit.workflowEditor.enabled` doc reference was removed. (#190 — thanks @JLanders96)
- **Spec viewer footer/step buttons appeared or disappeared after clicking other controls** (#197): the footer and step tabs are now a deterministic function of a single `ViewerState`, so a still-valid button never vanishes and an expected one never fails to appear when you click an unrelated control — it reads as intentional progressive disclosure, not a glitch. (#193, #190 — thanks @JLanders96)
- **Approve could re-dispatch an already-completed phase** (spec 116, #186): the Approve action now dispatches off `ctx.currentStep` instead of the viewed document type, so viewing an earlier step's doc can't re-run a phase that's already done.
- **Ordinary prose with dots rendered as bogus file-reference pills** (#187): file-reference pills are now gated on the extension allow-list rather than a "contains a dot" heuristic, so text like `e.g. 1.5x` no longer turns into a fake clickable file link.
- **`analyze` and `clarify` left viewer stuck on "needs regeneration"** (#194): `buildPrompt` short-circuited for these two steps because `CANONICAL_SUBSTEPS` only listed `specify` / `plan` / `tasks` / `implement` — so the bookkeeping preamble was never injected and the AI had no instruction to flip status or append a completion history entry. Added `analyze` and `clarify` to the substep table (single-pass — empty arrays), wired their completed status (`ready-to-implement` / `specified`) and done phrase, and guarded the substep-line renderer for empty arrays. Works in isolation: no edits to `.specify/extensions.yml` or user-local skill files required.
- **`.spec-context.json` wipe on tab click**: a transient read failure (concurrent CLI write → partial JSON → `JSON.parse` throws) used to be conflated with "file doesn't exist" at every layer — `readSpecContext`, `getFeatureWorkflow`, and `writeSpecContext` all silently treated read errors as `null`. The spec viewer's `ensureSpecContext` would then write a fresh `backfillMinimalContext` (raw-basename `specName`, empty `history`, `status: 'draft'`) over the real file, destroying lifecycle history. Fixed across the stack: the readers now return `null` only for `ENOENT` and throw on parse/IO errors; `writeSpecContext` stat-guards the target and refuses to write when an existing file is present-but-unreadable; the spec viewer's `updateContent` only calls `ensureSpecContext` on the first open of a panel (subsequent tab clicks are strictly read-only); `saveFeatureWorkflow` only emits a minimal context on `ENOENT`. New regression tests (`specContextWipeGuard.test.ts`) pin the on-disk file-unchanged invariant.

### Changed

- **Spec viewer in-flight footer** (spec 115): `Generating <Step>…` is no longer rendered as a disabled primary button — it's now a non-clickable accent-tinted status chip (pill + spinner) on the **right** with `role="status"` / `aria-live="polite"`. The `Mark step complete` manual override moves to the **left** styled as a quiet secondary action, communicating "one thing is happening, one thing is a fallback override." Applies uniformly to specify / plan / tasks / implement. No behavior change to the override click handler; approve / inline-comment / post-completion footer modes are unchanged.
- **Create Spec moved to the Specs title bar; manual refresh dropped** (#189): the **Create Spec** action now lives as the rightmost Specs view title-bar action, and the redundant manual **Refresh** button was removed — the file watcher already keeps the tree current.
- **Removed the CLI path override settings** (#200): provider CLI paths are now resolved automatically instead of being hand-configured, so the per-provider path settings were dropped from the configuration.

### Docs

- **New "Setup & Components" README section** (#198): clarifies which components are required, how the VS Code extension relates to the CLI spec-kit, and which workflows are supported — addressing the onboarding confusion reported in #192. (#192, #190 — thanks @JLanders96)

## [0.21.0] - 2026-05-27

### Added

- **Brand-name provider labels** (spec 108): the AI provider dropdown now shows disambiguating brand names alongside the technical slugs (e.g. "Claude Code", "GitHub Copilot CLI", "Gemini CLI"), so the selection isn't ambiguous when multiple CLIs share a vendor.

### Changed

- **`.spec-context.json` schema migration**: collapsed the separate `stepHistory{}` map and `transitions[]` array into a single canonical append-only `history[]` log; added an explicit `kind: "start" | "complete"` field on each entry, replacing the self-loop `from.step === step` convention. Legacy files normalize transparently on read; the writer always emits the new shape. `stepHistory` is now derived in-memory by the viewer.
- **Per-spec history is the single source of truth**: viewer panels and the stepper derive their per-step state from `history[]`, eliminating the prior dual-source drift that produced phantom "Generating <step>…" states.

### Fixed

- **State machine end-to-end** (15 findings, F1–F16): no more duplicate completion entries on phase-button clicks; the Approve button is hidden on backward-viewed stepper tabs so it can't re-dispatch already-completed phases; status closes at `implemented` rather than skipping straight to `completed`. The `Mark Completed` button is now the single user-owned closure gate for the implement step.
- **Stepper visual sync**: the per-step stepper now re-derives `stepHistory` on filesystem-watcher updates, not just on user clicks — the badge and the orange progress ring stay synchronized after the AI completes a step (closes F16).
- **Wrapping task line rendering** (spec 112): wrapping tasks no longer reserve a phantom flex row beneath the text, and the `+` comment-button slot stays reserved through hover so the text doesn't reflow.
- **Sidebar empty rows** (spec 114): child step rows in `'empty'` state no longer attach an open command — clicking them stays inert until the AI generates the doc, replacing the prior file-not-found error toast.
- **Inline-comment persistence**: comments now persist on any document (`spec.md`, `plan.md`, `tasks.md`, child docs), not only `spec.md`.
- **Comment line-height parity** (spec 110): adjacent task lines render at the same height as commented lines, removing the inline-comment-induced jitter.
- **Preamble hardening**: every preamble now pins a real dispatch-time UTC for the seed entry (no more midnight placeholders), fences the seed-write block to override schema proposals in the feature description, and splits `by: "extension"` (extension-dispatched) from `by: "ai"` (AI-appended). A unicode-fenced closure checklist reinforces "MUST DO BEFORE ENDING" so the AI doesn't drop completion entries.
- **Install pipeline**: `vscode:prepublish` now chains `npm run compile` before `npm run package-web`, ensuring extension-side TypeScript always recompiles into `dist/` before `vsce package` bundles. Previously webpack-only prepublish silently shipped stale `dist/` when only extension code changed.
- **Viewer typography**: header bottom-margins increased for breathability (h1 16→20, h2 8→16, h3 6→10 px) and markdown content font size +1 px overall; the wrapping task line line-height tightens for visual cohesion.

## [0.20.0] - 2026-05-25

### Documentation

- **Fix broken Marketplace screenshots**: The "lean image set" refactor renamed/deleted screenshots while README image URLs stayed pinned to the `main` branch, so the published Marketplace listing resolved several images to files that no longer existed (404). Republishing carries the corrected README (all referenced images exist on `main`), and a new stable-filename policy (documented in `CLAUDE.md` and `docs/screenshots/CAPTURE.md`) prevents recurrence — screenshots are now overwritten in place, never renamed.
- **Fix heading/caption mismatch**: the `Visual Workflow Editor` feature heading sat above a spec-viewer screenshot; renamed to `Visual Spec Viewer` so heading, alt text, and caption agree.
- **Marketplace-safe links**: converted in-page anchor links (`#configuration`, `#activity-panel`) to absolute GitHub anchors, since same-page anchors don't navigate on the VS Code Marketplace.
- Added `docs/readme-content-review.md` — an audit of where the README carries too much implementation detail (for a future trim).

## [0.19.0] - 2026-05-25

### New Features

- **Claude in VS Code provider — drive specs from the Claude Code panel instead of a terminal**: A new `claude-vscode` value for `speckit.aiProvider` opens the Claude Code GUI panel (the `anthropic.claude-code` extension) and pre-fills the assembled prompt, rather than spawning the `claude` CLI in a terminal. The full prompt — including the `.spec-context.json` bookkeeping preamble — is written to a workspace file and `@`-mentioned so the panel receives the whole instruction, while the visible command is cleaned for readability. **Known limitation:** the panel pre-fills but does not auto-submit — press **Enter** to send. Falls back to the default provider for an unrecognized `speckit.aiProvider` value (#171).

- **Workflows hide themselves when the active provider can't run them**: A workflow can declare `supportedAiProviders`; when set, it is hidden from selection unless the active `speckit.aiProvider` is in that list (e.g. the Claude-only SDD workflow now surfaces only for `claude` / `claude-vscode`). Existing specs keep their real steps under any provider — `getWorkflow()` resolves against the unfiltered list, so only the selection menu is filtered (#172).

### Improvements

- **README refresh**: Screenshots re-shot against the current viewer UI with a leaner image set and an AI hero image; retired the deferred `VIDEO-PROMPT.md` (#174).

## [0.18.0] - 2026-05-22

### New Features

- **IDE Chat provider — route prompts to your editor's built-in AI chat**: A new `ide-chat` value for `speckit.aiProvider` dispatches the assembled prompt to the host editor's built-in chat instead of spawning a terminal CLI. It auto-detects the host (VS Code/Copilot, Cursor, Windsurf, Antigravity), resolves the right chat command, strips the bookkeeping preamble, shortens the spec path to just the spec name, inlines the new-spec description, and formats the command per host (dot `/speckit.tasks` for Copilot/Windsurf, dash `/speckit-tasks` for Cursor/Antigravity skills). Requires spec-kit initialized for the host editor (`specify init --ai <agent>`); when it isn't, the prompt is prefilled (not sent) with an actionable warning.

  > **⚠️ Cursor and Windsurf support is work-in-progress.** Only **VS Code / GitHub Copilot** is fully supported end-to-end (prefill **and** auto-submit). **Cursor** prefills the command but you must press **Enter** to send it (Cursor exposes no callable "submit prompt" command). **Windsurf** drops the prompt on open, so the command is **copied to your clipboard** and Cascade is opened for you to paste (⌘V) and press Enter. **Antigravity** is best-effort. These forks' chat commands are proprietary/undocumented and may change.

- **Optional SpecKit commands surface as per-tab buttons in the spec viewer**: SpecKit's three optional refinement commands now appear as one-click footer buttons on the tab where each is most useful — **Clarify** on the Spec tab, **Checklist** on the Plan tab, and **Analyze** on the Tasks tab (right before implementing). They are built-in and workflow-agnostic (no `customCommands`/`customWorkflows` entry required), sit alongside any custom-command buttons, and dispatch the same registered command you'd run from the Command Palette (provider formatting and step tracking included). A user-defined command with the same id takes precedence so overrides always win (#156).

- **Activity view & PHASES timeline overhaul**: Reworked the spec-viewer Activity tab and the `.spec-context.json` pipeline behind it. The PHASES card now reports active time (idle gaps capped) with an overall Started / Total / Ended header and per-substep timing; completion timestamps finalize correctly, sub-second durations no longer all read `<1s`, the Implement phase no longer repeats a generic `phase1` label, the repeated author badge is de-noised, and the Activity tab no longer shows the previously-selected tab's sub-navigation. Skill-authored context fields are now declared in the schema (#169).

### Bug Fixes

- **Spec documents render correctly on Windows and CRLF checkouts**: The spec viewer's markdown renderer now normalizes CRLF / lone CR to LF before parsing, so documents checked out with Windows line endings (git `autocrlf`) or opened in a Windows-mounted dev-container render as formatted markdown instead of raw text (literal `#`, `---`, and `-` prefixes). It also strips spec-kit's leading YAML frontmatter and the tasks.md `## Format:` notation legend so that authoring boilerplate no longer leaks into the rendered output on any platform (#170, closes #158).

## [0.17.0] - 2026-05-21

### New Features

- **Inline comment composer is now a single GitHub-style card**: The line composer reads as one cohesive bordered card — a context header (what you're commenting on), the comment textarea, and a single footer row — instead of a textarea with a secondary action floating above it. The secondary line action (Remove Line / Remove Story / Remove Section / Remove Scenario / Toggle + Remove Task) sits left-aligned in the footer, with Cancel / Add Comment right-aligned. Acceptance-scenario rows show the scenario context in the same header. Visual restructure only — anchoring, submission, scratchpad persistence, keyboard shortcuts, auto-focus, and every action's outcome are unchanged (#162).
- **Inline review comments now persist to a per-document scratchpad**: When you submit a batch of inline comments via the source-tab **Refine** button, the AI gets the direct-edit prompt as before *and* the same batch is appended to a matching `<doc>-extra.md` history file (`spec-extra.md`, `plan-extra.md`, `tasks-extra.md`). Each entry records the exact source line, the nearest preceding heading, and the full source block (paragraph or list item, walked from the actual source markdown) so the trail stays meaningful even after the source file is edited and line numbers shift. Entries render as a labeled `## Refinement batch · TIMESTAMP` → `### Line N · Section` → **Original** quote → **Comment** layout, newest batch on top, with `---` rules between batches. The scratchpad sub-tab appears in the children rail only once the file exists (no manual create path) and is a read-only history with only an Edit affordance for manual cleanup. Scratchpads are non-core: never gate phase transitions, never count toward task completion, committable to source control.

### Bug Fixes

- **Activity panel tolerates non-array task_summaries fields**: The viewer no longer blanks out when a `.spec-context.json` has `task_summaries[*].concerns` or `.files` stored as plain strings instead of arrays; such values are coerced so Phases and Tasks render cleanly (#159).
- **Multi-line blockquotes render as one card**: The viewer's markdown renderer now groups consecutive `>` lines into a single `<blockquote>` element instead of fragmenting them into one card per line.
- **Sidebar green check no longer contradicts "not created"**: The pass icon on Spec / Plan / Tasks sub-items in the explorer tree is now gated on the file actually existing on disk, so a hand-crafted or out-of-sync `.spec-context.json` can't show "completed" next to a missing document.

## [0.16.0] - 2026-05-12

### New Features

- **Viewer Footer State Machine**: Reshaped the spec-viewer footer to match the actual workflow state. Noisy controls hide while a step is in flight; the forward button dynamically labels itself per workflow step (Plan / Tasks / Implement / Complete) so the next action is self-describing. Adds a new `implemented` status as the final approval gate before `completed`. Storybook now covers the full lifecycle plus Refine variants. `docs/viewer-states.md` is the new source of truth for footer matrix and step-tab visuals (#157).
- **Per-Spec Timeline Panel**: A Timeline toggle in the spec-viewer nav bar swaps the markdown pane for a chronological view of every transition in `.spec-context.json`. Entries are grouped by step (oldest-first) with substep, actor badge (`extension` / `cli` / `sdd` / `ai` / `user`), and relative timestamps; absolute ISO is in the tooltip. Updates live when external `/sdd:*` skills append rows — piggybacks on the existing watcher, no new polling (#152, closes #110).
- **Beta Features settings section**: Split extension settings into two groups in VS Code's Settings UI — the main "SpecKit Companion" group and a new "SpecKit Companion: Beta Features" group. The Activity panel toggle (`speckit.viewer.activityPanel`, values `off` / `beta` / `on`) now lives in the Beta group so users can find and change it instead of relying on its undeclared default.

### Bug Fixes

- **Refine No Longer Wipes plan.md**: The Refine button used to dispatch the per-step slash command (e.g. `/speckit.plan`), whose first action copies the plan template over the existing file. Refinement now sends a direct-edit prompt that names the target file and forbids running setup scripts or regenerating from a template, applied uniformly to spec / plan / tasks (#155).

### Documentation

- **Contributing Guide + PR Template**: Fleshed out the contributing guide with concrete development, testing, and PR-flow guidance; new pull request template ensures every PR includes a summary, test plan, and screenshot checklist where applicable (#151).

## [0.15.0] - 2026-04-27

### New Features

- **Copy Spec Path / Copy Spec Name**: Right-click a spec in the sidebar to copy either the workspace-relative path or just the slug, ready to paste into PRs, chat, or external tools (#149)
- **Group Header Bulk Actions**: Right-click the Active, Completed, or Archived group header in the Specs sidebar to apply a lifecycle transition to every visible spec at once (Mark all as Completed / Archive all / Reactivate all). Gated by a confirmation dialog with the post-skip count (#148)
- **Group-Aware Right-Click Menu**: Per-spec right-click actions now hide options that don't apply to that spec's lifecycle group, so you only see actions you can actually run (#147)

### Bug Fixes

- **Diff View No Longer Hijacked**: Removed the custom editor that auto-redirected every `specs/**/*.md` open to the SpecViewer panel. Source Control diffs now show VS Code's text diff editor and the regular File Explorer opens raw markdown — the SpecKit sidebar remains the canonical entry point for SpecViewer (#150)
- **PowerShell + Copilot Auto-Approve**: Codex provider now uses PowerShell-compatible command substitution; Copilot CLI auto-approve flag is forced so commands no longer hang waiting on a prompt that can't be surfaced (#145)

## [0.14.0] - 2026-04-27

### New Features

- **Pinned Viewer Header + Responsive TOC Sidebar**: Spec viewer header stays pinned while scrolling, and a responsive table-of-contents sidebar links to each H2/H3 for fast navigation in long specs (#139)
- **Onboarding Card for Zero-Spec Workspaces**: Replaces the silent empty welcome view with a "Create your first spec" card that links to docs and triggers the spec editor in one click (#137)
- **Always-Show SpecKit Icon + Empty-State Welcome**: The activity-bar icon now appears whether or not a workspace is open, and shows a contextual empty state instead of disappearing — fixes the "extension didn't load" confusion on first install (#134)
- **Reveal in Finder + Explorer View from Tree**: Tree view file items now expose "Reveal in OS Finder" and "Reveal in Explorer View" context-menu actions (#132)

### Improvements

- **README Refresh**: Top-of-page positioning rewritten, latest features documented, factual gaps fixed, and a maintenance rule added so the README stays current per release (#143)
- **Sample Specs Section in README**: Points to in-repo example specs so new users have a clear "what does good look like" reference (#136)
- **Polished Related-Tab Styles**: Related-tab styling now matches the step-tab chip language for visual consistency in the spec viewer (#133)

### Bug Fixes

- **Viewer State Display**: Fixed branch chip rendering, in-flight `%` pill, and substep label in the spec viewer (#131)
- **Current-Step Chip Contrast**: Improved current-step chip contrast on purple themes so the active step stays readable (#130)

## [0.13.0] - 2026-04-24

### New Features

- **Color-Coded Badge Statuses**: Every canonical spec status (draft, specifying, specified, planning, planned, tasking, ready-to-implement, implementing, completed, archived) now has a distinct color treatment — accent in-progress tier with gentle border breath, success-subtle intermediate-done tier, muted draft tier — so header badges read at a glance (#125)
- **Spec Header Layout Refresh**: Spec viewer header moves the created-date to a small right-aligned muted pill in row 1, drops the "Created:" prefix, gives the branch tag a purple treatment with a `git-branch` codicon, and promotes the title to its own line (#125)
- **Live Elapsed Timer on Step Tabs**: Step tabs for running work now show a live elapsed timer (`12s` / `3m 22s` / `2h 15m`) next to the in-flight pill, derived from `stepHistory.startedAt` so it survives webview reloads. A step-complete notification fires when `completedAt` transitions (#120)
- **Specs Tree Fuzzy Filter**: Fuzzy filter input over the specs tree for quick navigation (#121)
- **Specs Tree Sort Options**: Sort the specs tree by name, date, or status (#122)

### Improvements

- **Step Tab Visual Polish**: Brighter completed-step labels, inset accent ring + tinted fill on the current step (wraps the whole tab even when in-flight), harmonized label colors (icons/rings carry state), extra breathing room on in-flight tabs so the working pulse doesn't crash into the connector (#125)
- **Storybook Coverage**: One story per canonical status for `Primitives/Badge` and `Viewer/SpecHeader`, plus `Viewer/StepTab` stories for current+in-flight, elapsed-timer bands, and a 4-step `AllStates` row (#125)

### Bug Fixes

- **Codex Cross-Shell Command Pipe**: Codex provider now uses PowerShell-compatible command substitution instead of Unix `<` input redirection, and honors the `script` setting from `.specify/init-options.json` so Windows PowerShell users can run SpecKit commands without parser errors (#124)

## [0.12.1] - 2026-04-22

### New Features

- **Two-Row Viewer Header**: Spec viewer header now renders in two rows — status/branch badges above the title — instead of a single cramped flex row; the redundant `spec.md` / `plan.md` / `tasks.md` pill under the divider is gone (#119)
- **Tree Group Counts**: Spec tree group headers now display the count of specs in each group (#101)
- **Live Viewer Repaint**: Viewer repaints automatically on approve/regenerate and forces an AI completion marker for snappier feedback (#117)
- **Unified Webview Tokens + Undo Safety**: Webview design tokens unified, assets bundled, and undo safety added for editor actions (d902ad4)

### Improvements

- **Quieter Viewer Colors + Larger Mermaid**: Title/heading colors softened, and flowchart/sequence mermaid diagrams render at natural width with larger text instead of shrinking to the container (#118)
- **SDD Branch Auto-Creation**: `.sdd.json` now supports a `branchStage` + `branchNameFormat` to auto-create feature branches at specify or implement (#100)

### Bug Fixes

- **Viewed-Step Checkmark Preserved**: Clicking a completed step tab no longer hides its ✓; the accent outline marker around the currently viewed tab has been restored (#119)

## [0.12.0] - 2026-04-20

### New Features

- **Canonical `.spec-context.json`**: `.spec-context.json` is the single source of truth for workflow state, derived by the extension and consumed by the viewer (#83, #84, #86)
- **Context Preamble for AI Prompts**: AI prompts automatically include a context-update preamble so providers keep `.spec-context.json` in sync through the lifecycle (#85)
- **Provider Registry & OpenCode Support**: AI providers moved to a registry pattern; OpenCode joins Claude Code, Gemini, Copilot, Codex, and Qwen (#87)
- **Multi-Select Bulk Status Commands**: Select multiple specs in the tree and change status (archive, complete, reactivate) in one action (#88)
- **Locked Future Steps**: Workflow tabs lock future steps while a step is running and expose tooltips to explain each action (#90)
- **Collapse/Expand All**: Spec tree now has a collapse/expand toggle with reduced flicker and tighter sub-file indentation (#95)
- **Reveal Spec Folder**: New tree context menu to reveal a spec's folder in Finder / Explorer (#98)

### Improvements

- **Step Completion Inference**: Completion is inferred from file state when `stepHistory` is missing, so older specs render correctly (#87, #92)
- **Cleaner Slash Command Routing**: Preamble is passed via `--append-system-prompt` so slash commands arrive cleanly to the AI CLI (#96)
- **Hidden Launch Prompts**: Prompt content is dispatched via a temp file to keep the terminal view clean (#82)

### Bug Fixes

- **Numeric Spec Sorting**: Specs sort by numeric prefix so `069` appears above `068` and `067` (#97)
- **Incomplete Spec-Context Reconciliation**: Viewer now reconciles partial `.spec-context.json` files and keeps lifecycle buttons enabled correctly (#93)
- **Tab Clicks No Longer Mutate Workflow**: Clicking a step tab in the viewer no longer changes `currentStep` in `.spec-context.json` (#89)

## [0.11.0] - 2026-04-10

### New Features

- **Floating Toast Notifications**: Upgraded terminal toast to a floating notification with slide-in/fade-out animations, positioned at bottom-right with auto-dismiss (#81)
- **Command Format Setting**: Added `speckit.commandFormat` setting to switch between dot (`speckit.plan`) and dash (`/speckit-plan`) command formats for compatibility with different speckit versions (fixes #73, #76)
- **Transition Logging**: `.spec-context.json` now logs step transitions with timestamps for debugging and audit (#75)
- **Archive Button Repositioned**: Archive button moved to left side of footer for better UX flow (#77)

### Improvements

- **Preact Migration**: Spec-viewer webview migrated from vanilla DOM to Preact with Storybook support (#74)

### Bug Fixes

- **Bullet Point Rendering**: Fixed bullet points not rendering correctly in lists containing code blocks (#79)
- **List Item Spacing**: Reduced excessive spacing between list items in spec viewer (#80)
- **Storybook Preact Aliases**: Added Preact aliases to resolve "React is not defined" errors in Storybook

## [0.10.0] - 2026-04-05

### New Features

- **Spec Context as Source of Truth**: `.spec-context.json` is now the single source of truth for workflow state, replacing scattered markdown-based heuristics. Badge text, created/last-updated dates, and step progress are all derived from context data (#61, #62)
- **Redesigned Spec Viewer Header**: Structured metadata layout showing badge, status, created date, and last-updated date from spec-context (#64)
- **Workflow Command Buttons**: Workflow-defined `commands` now render as action buttons in the spec-viewer footer alongside primary CTAs (#69)
- **Mermaid Diagram Zoom**: Mermaid diagrams in the spec viewer now include zoom controls (+, −, Reset) for navigating large diagrams
- **Provider Config Tree**: Steering sidebar restructured with Project/User groups for clearer organization of AI provider config files (#55)
- **Provider-Aware Commands**: AI provider prompts now include spec-context instructions and use provider-specific command formatting

### Bug Fixes

- **Step Completion Badges**: Working/active indicator no longer shows on completed steps — uses `stepHistory.completedAt` for accurate status (#67)
- **Workflow Persistence**: Workflow selection persists correctly across spec lifecycle; default renamed to "speckit" to prevent accidental overwrites (#60)
- **Explorer Status Icons**: Prefer SDD `step` field for explorer status icon; checklists now appear under Specify phase (#65)
- **Plan Sub-Files**: Combined `subFiles` and `subDir` in `getStepSubFiles` so Plan children display correctly (#68)
- **Read-Only Tree Rendering**: New `resolveWorkflow()` avoids writing `.spec-context.json` during tree rendering and viewer init
- **Disabled Step Tabs**: Step tabs for non-existent files are now disabled instead of being silently clickable
- **Completed Status**: Uses explicit `next=done` for completed status instead of fragile substep heuristics (#57)
- **Spec Directory Discovery**: Directories with `.spec-context.json` (SDD in-progress specs) now appear in explorer even without markdown files

### Improvements

- **Sorted Completed/Archived Specs**: Completed and archived specs now sort by creation date (newest first), matching active spec behavior
- **Unified Step Context Schema**: Simplified step context field names for consistency (#66)
- **Centralized Constants**: Magic strings extracted into named constants (#59)
- **Green Working Pulse**: Active step animation uses green (success) color instead of accent blue
- **Inline Code Styling**: Removed heavy box styling from inline code highlights for cleaner appearance
- **Editor Comment Area**: Inline editor comment section has a visible border for better visual separation
- **Smaller Line Actions**: Reduced add-button size for less visual clutter

### Documentation

- Updated architecture docs, how-it-works guide, and CLAUDE.md to reflect current codebase (#63)

## [0.9.3] - 2026-04-02

### New Features

- **Unified Permission Mode**: New `speckit.permissionMode` setting replaces per-provider settings (`claudePermissionMode`, `copilotPermissionMode`, `qwenYoloMode`). Values: `"interactive"` (default, recommended) and `"auto-approve"` (YOLO). Applies to Claude, Copilot, and Qwen. (#7)

### Improvements

- **Spec Viewer Lifecycle Buttons (BETA)**: Overhauled lifecycle buttons and simplified status system in the spec viewer. Status-based sidebar grouping with colored step indicators.
- **Safe Default**: Extension no longer defaults to bypass-permissions mode. New installs start in interactive mode.
- **Removed Permission Gate**: Removed the PermissionManager/PermissionWebview startup dialog — no permission prompt on extension activation.
- **Specs View Always Visible**: Specs sidebar view is no longer gated behind a visibility setting — always shows when a workspace is open.

### Breaking Changes

- Per-provider permission settings removed: `speckit.claudePermissionMode`, `speckit.copilotPermissionMode`, `speckit.qwenYoloMode`. Use `speckit.permissionMode` instead.
- Setting `speckit.views.specs.visible` removed — Specs view is always visible.

## [0.9.2] - 2026-04-01

### New Features

- **Active/Earlier Grouping**: Specs in the explorer tree are now grouped into "Active" (modified today, expanded) and "Earlier" (older, collapsed), with active specs sorted newest-first (#48)
- **Spinning Indicator**: Spec node shows a spinning icon when a workflow step command is running
- **Missing File Indicator**: Steps with no file show "not created" in dim text for clear visibility

### Improvements

- **Cleaner Tree View**: Removed static circle status indicators and step-specific icons for a less cluttered appearance
- **Label Rename**: Default workflow step "Specify"/"Specs" renamed to "Specification" for clarity

### Bug Fixes

- **Dimmed Tree Items**: Fixed git-ignored spec files appearing grayed out by removing `resourceUri` from tree items (#47)

## [0.9.1] - 2026-03-31

### New Features

- **Workflow Commands**: Workflows can now define `commands` — extra action buttons that appear next to the primary action for a given step (e.g., an "Auto Mode" button next to Submit in the spec editor) (#45)
- **Action Toast & Auto-Navigate**: Spec viewer now shows a toast notification after running an action and automatically navigates to the next workflow phase (#44)

### Bug Fixes

- **Terminal Timing**: Replaced fixed 800ms `setTimeout` with VS Code's shell integration API (`onDidChangeTerminalShellIntegration`) for detecting terminal readiness before sending commands — prevents commands from being lost on slow shell startup (#46)
- **Extension Host Cleanup**: Audited all disposables in `activate()` to ensure clean shutdown without "closing extension host" warnings

### Improvements

- **Shell Integration Fallback**: Terminals on VS Code versions below 1.93 (lacking shell integration events) gracefully fall back to a 5-second timeout
- **Shared Utility**: New `waitForShellReady` utility used consistently across all 5 AI providers and steering manager

## [0.8.0] - 2026-03-26

### New Features

- **Scoped Related Docs**: Related documents in the spec viewer are now scoped to their parent workflow step (#38)
- **Welcome Buttons**: Conditional welcome buttons for init and constitution setup in sidebar views (#37)

## [0.7.0] - 2026-03-26

### New Features

- **Optional SpecKit CLI**: Extension now works without SpecKit CLI initialization (#35)
- **Copilot permission mode**: New `speckit.copilotPermissionMode` setting to control auto-approval (`yolo`/`default`)

### Bug Fixes

- **Copilot CLI command**: Replaced `ghcs` (shell suggestion tool) with `copilot` CLI — the correct coding assistant executable (#36)
- **Copilot non-interactive mode**: Added `-p` flag for prompt mode and `--yolo` for auto-approving shell actions
- **Copilot slash commands**: Strip leading `/` from prompts since Copilot CLI doesn't use slash commands

### Improvements

- **Steering sidebar consolidation**: Merged agents, skills, and hooks into the steering view (#34)
- **CLI defaults constant**: Added `CLIDefaults` constant for centralized provider executable names

## [0.6.0] - 2026-03-22

### New Features

- **Configurable Spec Directories**: New `speckit.specDirectories` setting with glob pattern support for flexible project layouts (e.g., `openspec/changes/*/specs/*`). Empty directories auto-hidden from sidebar (#31)
- **Action-Only Workflow Steps**: Workflow steps now support an `actionOnly` flag for commands that don't produce output files (#31)
- **Flexible Workflow Steps**: Added `includeRelatedDocs` support for surfacing related documents in the workflow viewer (#30)
- **Feedback Entry Points**: Settings panel now shows Report a Bug, Request a Feature, and Rate on Marketplace items with dedicated icons (#29)
- **Inline Spec Delete**: Trash icon appears on hover for spec rows in the sidebar (#29)

### Bug Fixes

- **Status Bar Messages**: Replaced noisy info popup notifications with unobtrusive status bar messages (#27, #28)

### Improvements

- **README Overhaul**: Updated documentation with blog screenshots and refreshed configuration guide (#32)
- **Spec Viewer Overhaul**: Document scanner, phase calculation, and navigation rebuilt for custom workflow steps and configurable directories
- **Explorer Deduplication**: Spec explorer now deduplicates spec names across multiple directories

## [0.5.0] - 2026-03-01

### New Features

- **File Reference Buttons**: Smaller, more compact pill buttons using VS Code's native codicon font instead of custom SVG icons
- **Short File Names**: File-ref buttons now show basename only for paths with directories, with full path in tooltip
- **Source File Button**: Always-visible source file button and new sidebar "Open Source" action (#25)
- **Custom Workflows UX**: Dynamic sub-commands and output channel logging for custom workflows (#24)
- **Spec Editor CTA**: Simplified create spec footer call-to-action (#23)
- **Clickable File References**: Code spans referencing files are now clickable buttons in the spec viewer (#22)
- **Qwen Code CLI**: Added Qwen Code as a new AI provider (#21)

### Bug Fixes

- **MCP Panel**: Resolved infinite spinner when Claude CLI is unavailable
- **Spec Viewer**: Brighter text, tighter layout, and cleaner navigation

### Improvements

- **SDD Worktree**: Strengthened worktree entry instructions with `pwd` verification and branch rename checks
- **SDD Commands**: Added AskUserQuestion to checkpoints and fixed minimal mode state
- **Project Structure**: Updated CLAUDE.md to reflect current codebase layout

## [0.4.0] - 2026-02-13

### Bug Fixes

- **Markdown Rendering**: Fixed underscore (`_`) in code and identifiers being rendered as italic in spec viewer (#14)
- **CLI Pre-flight Checks**: Added install checks for Copilot and Gemini CLI providers — users now see a helpful error with install instructions instead of a cryptic shell error (#19)
- **Provider-Aware Init**: Built-in agents (`.claude/agents/kfc/`) and system prompts are no longer created when using non-Claude providers (#19)
- **Permissions**: Simplified permission system and silenced agent init errors

## [0.3.5] - 2026-01-27

### Bug Fixes

- **Settings**: Fixed `speckit.defaultWorkflow` setting placement - was incorrectly defined outside `configuration.properties`, causing VS Code to report "Unknown Configuration Setting"

### New Features

- **Light Tasks Command**: Added `/speckit.light-tasks` command for simple flat task list generation without phases or dependency analysis

## [0.3.4] - 2026-01-27

### New Features

- **Default Workflow Setting**: New `speckit.defaultWorkflow` setting to auto-select a workflow for new features without prompting
- **Step-Tasks Support**: Added `step-tasks` as a workflow-configurable step alongside specify, plan, and implement
- **Dynamic Footer Buttons**: Approve button in spec viewer now dynamically updates based on document type and workflow progress

### Improvements

- Footer button text contextually shows "Generate Plan", "Generate Tasks", or "Implement Tasks" based on current phase
- Validates `defaultWorkflow` setting on extension activation with warning if configured workflow doesn't exist

## [0.3.1] - 2026-01-27

### New Features

- **Custom Workflows**: Define alternative workflows with custom commands for each step via `speckit.customWorkflows` setting
- **Workflow Selector**: Dropdown in spec editor to choose between default and custom workflows
- **Light Workflow Commands**: New streamlined commands (`light-specify`, `light-plan`, `light-implement`) for rapid development
- **Git Commands**: New `/speckit.commit` and `/speckit.pr` commands for workflow automation

### Improvements

- **Custom Commands**: Added `step` property to show commands in specific phases (spec, plan, tasks)
- **Custom Commands**: Added `tooltip` property for hover descriptions
- Simplified `customWorkflows` schema by removing `checkpoints` (handled by AI CLI)

## [0.3.0] - 2026-01-25

### New Features

- **Claude Permission Mode Setting**: New `speckit.claudePermissionMode` setting to choose between YOLO mode (bypass all permissions) or interactive permission prompts
- **Codex CLI Support**: Added OpenAI Codex CLI as a new AI provider with prompt template support

### Improvements

- **Spec Viewer**: Improved UX with inline line actions (refine, remove) on hover
- **Spec Viewer**: Refined typography and visual polish
- **Spec Viewer**: Modularized codebase for better maintainability
- **Steering**: Recursive document scanning for nested steering files
- **Steering**: Fixed refine button functionality

### Housekeeping

- Internal code refactoring and modularization

## [0.2.28] - 2026-01-02

### Improvements

- **Spec Editor**: Replace drag-and-drop with clipboard paste (Ctrl+V / Cmd+V) for image attachments
- **Spec Editor**: More reliable image thumbnail display
- **Workflow Editor**: Research tab now correctly appears under Plan phase
- **Workflow Editor**: Related docs sorted alphabetically for consistency
- Updated screenshots with higher quality images

### Housekeeping

- Removed unused legacy assets

## [0.2.26] - 2025-01-02

### New Features

- **Spec Editor**: New rich webview for creating specifications
  - Multi-line text editor with formatting preservation
  - Image attachments via file picker or drag-and-drop
  - Load existing specs as templates
  - Keyboard shortcuts (Ctrl+Enter to submit, Esc to cancel)
- Plus button in Specs view now opens the Spec Editor

### Improvements

- Automatic temp file cleanup for submitted specs
- VS Code theme integration for Spec Editor

## [0.2.21] - 2025-01-02

### Improvements

- Internal refactoring for better code maintainability
- Add architecture documentation (`docs/HOW_THIS_WORKS.md`)
- Add `/install-local` command for developers

## [0.2.11] - 2025-01-02

### New Features

- Add configurable Gemini CLI initialization delay setting (`speckit.geminiInitDelay`)
- Add setting to disable phase completion notifications (`speckit.notifications.phaseCompletion`)

### Improvements

- Increase default Gemini CLI init delay from 5s to 8s for better reliability

## [0.2.10] - 2025-01-02

### New Features

- Add SpecKit Files section to Steering view showing `.specify/` directory contents
- Display constitution, scripts, and templates from SpecKit project configuration
- File watcher for `.specify/` directory with automatic refresh

### Improvements

- Fixed contextual initialization message - only shows when valid workspace is open
- SpecKit files organized into collapsible categories with appropriate icons

## [0.2.9] - 2024-12-30

### New Features

- VS Code theme integration for workflow editor
- All hardcoded colors replaced with CSS custom properties mapped to VS Code theme variables
- Theme-specific fallbacks for light, dark, and high-contrast modes

### Improvements

- Compact layout with reduced header margins (~30% vertical space reduction)
- Typography uses VS Code font settings

## [0.2.0] - 2025-12-09

### New Features

- Improved Gemini CLI support with proper interactive mode handling

### Fixed

- Fix extension reload prompt when changing AI provider

## [0.1.7] - 2025-12-08

### New Features

- Add Skills view with YAML frontmatter support for Claude Code skills

### Fixed

- Remove Claude Code as automatic reviewer in PRs

## [0.1.3] - 2025-12-03

### New Features

- Add `autoExecute` parameter to `executeSlashCommand` for flexible CLI control

### Improvements

- Simplify permission setup flow (terminal only, no WebView popup)
- Make "Don't Ask Again" for init popup global across all projects
- Implement command now triggers when approving tasks phase

### Fixed

- Fix remove button only showing on removable lines (checkbox, bullet, numbered, user-story)

## [0.1.2] - 2025-12-02

### Fixed

- Fixed OpenVSX namespace to match publisher ID (alfredoperez)

## [0.1.1] - 2025-12-02

### Improvements

- Added OpenVSX publishing support for Cursor IDE users
- Updated acknowledgment section with project source

## [0.1.0] - 2025-12-02

### Initial Release

SpecKit Companion - VS Code companion for GitHub SpecKit, enabling spec-driven development with AI assistants.

### Features

- **Spec Explorer**: Visual tree view for managing feature specifications
- **Workflow Editor**: Custom markdown editor with action buttons for spec workflow
- **SpecKit CLI Integration**: Full support for SpecKit CLI commands (specify, plan, tasks, implement, clarify, analyze, checklist, constitution)
- **Steering Documents**: Manage user and project rules for AI context
- **Agents View**: Display and manage Claude Code agents
- **Hooks View**: View configured Claude Code hooks
- **MCP Servers View**: Monitor MCP server connections and status
- **Multi-AI Support**: Foundation for Claude Code, Gemini CLI, and GitHub Copilot CLI
- **Auto-detection**: Automatic detection of SpecKit CLI installation and workspace initialization
- **Install Guidance**: Welcome views guiding users through CLI installation and workspace setup
