# Feature Specification: Wibey VSCode and Wibey CLI Provider Support

**Feature Branch**: `393-wibey-provider-support`

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "Add support for Wibey VSCode and Wibey CLI as AI providers in the Companion VS Code extension. When a user clicks Refine or executes a speckit workflow from the Companion plugin buttons (wibey.wibey-vscode-extension), the extension should detect and invoke the correct provider: Wibey VSCode (via its VS Code extension API) and Wibey CLI (via its CLI invocation pattern). Need to understand how Wibey CLI identifies itself and how it is invoked."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Wibey VSCode as the Active Provider (Priority: P1)

A Walmart developer who uses Wibey as their primary AI coding assistant selects "Wibey (VS Code)" from the AI Provider dropdown in the SpecKit sidebar. From that point on, every SpecKit action that dispatches a prompt — clicking **Refine**, running a workflow step (Specify / Plan / Tasks / Implement), or triggering inline comment resolution — opens the Wibey chat panel inside VS Code with the assembled prompt pre-filled, ready to execute on Enter.

**Why this priority**: Wibey is Walmart's first-party AI coding assistant and the primary tool for most Walmart developers using SpecKit Companion. Without native recognition, Wibey users must fall back to generic terminal providers that don't leverage the integrated VS Code panel experience. This story covers the highest-traffic workflow path.

**Independent Test**: Set `speckit.aiProvider` to `wibey-vscode`. Open any spec in the viewer and click **Refine** on a section. Verify the Wibey VS Code chat panel opens and the SpecKit prompt is visible in the input without requiring manual copy-paste.

**Acceptance Scenarios**:

1. **Given** `wibey-vscode` is selected as the AI provider, **When** the user clicks any workflow step button (Specify, Plan, Tasks, Implement), **Then** the Wibey VS Code chat panel opens with the corresponding SpecKit command pre-filled
2. **Given** `wibey-vscode` is selected, **When** the user clicks **Refine** on a spec section or line, **Then** the Wibey panel opens with the refinement prompt pre-filled
3. **Given** `wibey-vscode` is selected, **When** an inline comment is resolved, **Then** the resolution prompt is dispatched to the Wibey panel, not to a terminal
4. **Given** the Wibey VS Code extension is not installed, **When** any SpecKit action fires, **Then** the user receives a clear warning message with installation guidance, and no silent failure occurs
5. **Given** `wibey-vscode` is set and the user views the AI Provider dropdown again, **Then** the option shows the label "Wibey (VS Code)" — not the raw enum key

---

### User Story 2 — Wibey CLI as the Active Provider (Priority: P2)

A Walmart developer who prefers terminal-based workflows selects "Wibey CLI" from the AI Provider dropdown. SpecKit dispatches all commands to the Wibey CLI in a dedicated VS Code terminal, exactly as it does for Claude Code or Gemini CLI. Workflow step buttons, Refine, and inline comment actions all execute through the terminal provider lifecycle (install check → terminal reuse → command dispatch → cleanup).

**Why this priority**: Some developers or CI/automated contexts require a headless/terminal-based workflow. Wibey CLI covers that path and ensures feature parity with the Wibey VSCode panel option.

**Independent Test**: Set `speckit.aiProvider` to `wibey`. Open any spec and click **Run** on the Specify step. Verify a terminal titled "SpecKit - Wibey" opens (or is reused) and the `wibey` CLI receives the SpecKit command.

**Acceptance Scenarios**:

1. **Given** `wibey` is selected as the AI provider, **When** the user clicks a workflow step button, **Then** a VS Code terminal opens (or is reused) with the Wibey CLI executing the corresponding SpecKit command
2. **Given** `wibey` is selected, **When** the user clicks **Refine**, **Then** the terminal Wibey CLI receives the refinement prompt and executes it
3. **Given** `wibey` is selected and the Wibey CLI is not installed or not found on `PATH`, **When** any SpecKit action fires, **Then** the user sees an install-guidance message and the terminal does not hang
4. **Given** `wibey` is selected with permission mode set to auto-approve, **When** a command is dispatched, **Then** the appropriate auto-approve flag is prepended to the CLI invocation

---

### User Story 3 — Steering and Configuration for Wibey Providers (Priority: P3)

A developer using either Wibey provider can view and edit their Wibey-specific steering files, agents, and skills from the SpecKit sidebar's steering explorer, the same way Claude Code or Gemini CLI users do. The sidebar correctly resolves Wibey's config directory (`.wibey`), its steering file, and its skill/agent directories.

**Why this priority**: Provider registration is incomplete without surface parity in the steering explorer. Developers need to manage context for Wibey the same way they do for other providers.

**Independent Test**: Set `speckit.aiProvider` to `wibey` or `wibey-vscode`. Open the SpecKit sidebar and navigate to the steering explorer. Verify that it shows a "Wibey" section with the correct steering file path and that clicking "Open steering file" opens `.wibey/WIBEY.md` (or the Wibey-equivalent) from the project root.

**Acceptance Scenarios**:

1. **Given** either Wibey provider is active, **When** the user opens the steering explorer in the SpecKit sidebar, **Then** the steering section header shows "Wibey" (not a raw key) and lists the project-level steering file
2. **Given** a Wibey provider is active, **When** the user views the AI Provider config tree node, **Then** the display name reads "Wibey (VS Code)" or "Wibey CLI" — matching the friendly label from the dropdown — not the raw enum key `wibey-vscode` or `wibey`
3. **Given** a Wibey provider is active, **When** the user tries to sync steering to a Wibey-unsupported directory, **Then** the extension does not copy files to the wrong location

---

### Edge Cases

- What if a developer has both `wibey` (CLI) and `wibey.wibey-vscode-extension` installed — is there a clear recommendation in the QuickPick description about which to choose?
- What if the Wibey VS Code extension's URI handler changes between Wibey versions — does dispatch fail silently or surface an actionable error?
- What if `wibey-vscode` is selected but VS Code is running in a context where `openExternal` is unavailable (e.g., SSH remote, web) — does it degrade gracefully?
- What if the Wibey CLI binary name or invocation flags differ between Walmart-internal distribution channels (npm global, direct binary, brew)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST expose two new selectable AI provider options: one for the Wibey VS Code chat panel (`wibey-vscode`) and one for the Wibey CLI terminal (`wibey`)
- **FR-002**: When `wibey-vscode` is active, all SpecKit prompt dispatches (workflow steps, Refine, inline comment resolution) MUST open the Wibey VS Code extension's chat panel with the prompt pre-filled, without spawning a terminal
- **FR-003**: When `wibey` is active, all SpecKit prompt dispatches MUST route to the Wibey CLI in a VS Code terminal, following the same lifecycle used by Claude Code and Gemini CLI (install check, terminal reuse, command dispatch, temp-file cleanup)
- **FR-004**: Both providers MUST appear in the AI Provider selection dropdown with friendly display labels ("Wibey (VS Code)" and "Wibey CLI") — the raw enum keys MUST NOT be shown to users
- **FR-005**: The steering explorer in the SpecKit sidebar MUST correctly resolve and display Wibey's config directory, steering file, and (where supported) agents and skills directories when either Wibey provider is active
- **FR-006**: When `wibey-vscode` is active and the Wibey VS Code extension is not installed, the extension MUST surface a user-facing warning with actionable install guidance — it MUST NOT silently dispatch to the wrong provider or throw an uncaught error
- **FR-007**: When `wibey` is active and the CLI binary is not found, the extension MUST surface a user-facing install-guidance message — it MUST NOT leave the user with a hanging or broken terminal state
- **FR-008**: Both providers MUST participate in the permission-mode control introduced in spec 033 — `wibey-vscode` uses no auto-approve flag (panel-managed), while `wibey` applies the Wibey CLI's auto-approve flag (to be confirmed during planning; assumed to follow the Claude Agent SDK pattern)
- **FR-009**: The command format (dot vs dash for SpecKit slash commands) MUST be set correctly for each provider — `wibey` is assumed to use dash-form (e.g. `/speckit-specify`) since it is built on the Claude Agent SDK; to be verified during planning against the installed CLI
- **FR-010**: No existing provider's behavior, configuration, or stored setting value MUST be affected by the addition of the two new providers

### Key Entities

- **Wibey VSCode Provider** (`wibey-vscode`): A panel-dispatch provider that routes SpecKit prompts to the Wibey VS Code chat extension (`wibey.wibey-vscode-extension`) via its URI handler or extension API, without spawning a terminal. Config dir: `.wibey`. Mirrors the structure of the `claude-vscode` provider.
- **Wibey CLI Provider** (`wibey`): A terminal-based CLI provider that invokes the `wibey` binary in a VS Code terminal. Config dir: `.wibey`. Steering, agents, and skills are read from the `.wibey/` directory. Mirrors the structure of the `claude` provider.
- **Provider Registry Entry**: Each provider requires an entry in `AIProviders` (constants), `PROVIDER_PATHS` (config metadata), `PROVIDER_CONSTRUCTORS` (factory wiring), and the `speckit.aiProvider` enum in `package.json`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Walmart developer can select "Wibey (VS Code)" or "Wibey CLI" from the AI Provider dropdown and immediately use every SpecKit workflow action — zero manual workarounds required
- **SC-002**: Zero raw enum keys (`wibey-vscode`, `wibey`) are visible anywhere in the SpecKit UI when either provider is active; all surfaces show friendly labels
- **SC-003**: Switching between any existing provider and a Wibey provider leaves stored `settings.json` values intact for all providers — no data migration or user-side reconfiguration needed
- **SC-004**: All existing provider behaviors are unaffected — the test suite for existing providers passes without modification
- **SC-005**: A developer switching from "Wibey (VS Code)" to "Wibey CLI" (or vice versa) completes the switch in under 5 seconds via the existing AI Provider selector, with no restart required

## Assumptions

- The Wibey VS Code extension ID is `wibey.wibey-vscode-extension` and it exposes a URI handler at `vscode://wibey.wibey-vscode-extension/...` that accepts a `prompt` query parameter for pre-filling the chat input (same pattern as `anthropic.claude-code`)
- The Wibey CLI binary name is `wibey` and it is available on the developer's `PATH` when installed via Walmart-standard distribution
- The `.wibey/` directory is the canonical config root for both Wibey providers; steering files follow a pattern analogous to `CLAUDE.md` / `GEMINI.md` (specific filename to be confirmed in planning)
- Wibey VSCode panel dispatch does not require an auto-approve flag (panel UX manages user consent)
- SpecKit command format (dot vs dash) for Wibey CLI must be confirmed before plan phase — interim assumption is `dash` (matching Claude Code) since Wibey's CLI is built on the Claude Agent SDK
- Both providers share the `.wibey/` config directory — a developer switching between `wibey` and `wibey-vscode` sees the same steering, agents, and skills
- The `speckit.aiProvider` stored setting values (`wibey` and `wibey-vscode`) are new enum entries and do not conflict with any existing value
