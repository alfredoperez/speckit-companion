# Feature Specification: Add Antigravity as an AI Provider

**Feature branch**: `534-antigravity-provider`
**Created**: 2026-07-23
**Source**: GitHub issue #546 — "[FEATURE] Add Antigravity cli into provider"

## User Scenarios & Testing

### User Story 1 - Select Antigravity as the AI provider (Priority: P1)

A developer who uses Google's Antigravity agentic coding tool opens **Settings > speckit.aiProvider**, sees **Antigravity** in the list of AI assistants, and selects it. From then on, when they trigger a SpecKit action (Plan, Tasks, Implement, or any `/speckit.*` command) from the sidebar or the spec viewer, the extension dispatches the command to Antigravity instead of Claude Code.

**Why this priority**: This is the entire ask in the issue — the provider is simply not selectable today, so there is no way to route SpecKit commands to Antigravity. Nothing else in the feature matters until the option exists and dispatches.

**Independent Test**: Set `speckit.aiProvider` to `antigravity`, trigger a spec command, and confirm the extension opens a terminal that invokes the Antigravity CLI carrying the assembled prompt — rather than falling back to Claude Code.

**Acceptance Scenarios**:

1. **Given** the extension is installed, **When** the user opens the `speckit.aiProvider` setting, **Then** `Antigravity` appears as a selectable option alongside the existing providers.
2. **Given** `speckit.aiProvider` is set to `antigravity`, **When** the user triggers a SpecKit command, **Then** the extension dispatches the prompt to the Antigravity CLI in an integrated terminal.
3. **Given** `speckit.aiProvider` is set to `antigravity`, **When** the extension resolves the provider, **Then** it constructs the Antigravity provider (not the Claude Code fallback).

### User Story 2 - No crash on an unknown or renamed provider value (Priority: P2)

A user (or a future rename) leaves an unrecognized value in `speckit.aiProvider`. The extension must not crash on activation or at dispatch; it falls back to the default provider.

**Why this priority**: Adding an enum value is safe, but the change must not weaken the existing guard that keeps a stale/typo'd provider value from throwing at every call site (the documented `feedback_provider_rename_breaks_settings` failure mode).

**Independent Test**: Set `speckit.aiProvider` to a nonexistent value and confirm the extension activates and dispatches via the Claude Code fallback without throwing.

**Acceptance Scenarios**:

1. **Given** `speckit.aiProvider` holds an unknown value, **When** the provider is resolved, **Then** the extension falls back to Claude Code and logs the fallback (existing behavior, unchanged).

## Edge Cases

- The Antigravity CLI is not installed on the user's machine — dispatch surfaces the standard "CLI not found" install hint, exactly as other terminal-CLI providers do.
- The exact Antigravity CLI binary name / prompt-input flag is not verifiable from inside this repo (see Assumptions) — the integration mirrors the default terminal-CLI dispatch shape so the invocation is a single, easily-corrected constant.

## Requirements

### Functional Requirements

- **FR-001**: The `speckit.aiProvider` setting MUST offer `antigravity` as a selectable enum value, with a matching label and description in the manifest.
- **FR-002**: Selecting `antigravity` MUST dispatch assembled SpecKit prompts and `/speckit.*` commands to the Antigravity CLI in an integrated terminal, following the existing terminal-CLI provider pattern.
- **FR-003**: The provider registry MUST include an `antigravity` entry (display name, command format, QuickPick icon and description, permission fields) that passes the module-load validation.
- **FR-004**: An unknown or renamed `speckit.aiProvider` value MUST continue to fall back to the default provider without crashing activation or dispatch.
- **FR-005**: The provider count and matrix documentation (README "Supported AI Providers" matrix, prose provider counts, and `docs/architecture.md` / `docs/how-it-works.md`) MUST stay consistent with the manifest enum, as enforced by the docs-consistency test.

### Key Entities

- **AI Provider** — an entry mapping a `speckit.aiProvider` enum value to a dispatch implementation, a display name, and a `ProviderPaths` config (steering/agents/skills/MCP locations, command format, permission behavior).

## Success Criteria

### Measurable Outcomes

- **SC-001**: `antigravity` is a valid `speckit.aiProvider` value and resolves to a dedicated provider implementation (not the fallback), verified by an automated test.
- **SC-002**: The provider-count consistency test passes with the new provider (manifest enum length, README matrix columns, and architecture prose all agree at 11).
- **SC-003**: `npm run compile`, `npm test`, and `npm run package` all succeed.

## Assumptions

- **Dispatch shape**: Antigravity is a VS Code-based agentic tool with a CLI. The integration is modeled as a **terminal-CLI provider** (the same family as Codex, Gemini, Qwen, OpenCode), which runs the agent CLI in an integrated terminal carrying the assembled prompt. This fits the repo's abstraction better than the IDE-chat path, which is reserved for the host editor's own built-in chat (Copilot/Cursor/Windsurf).
- **CLI invocation**: The binary is assumed to be `antigravity`, invoked in the default `CliTerminalProvider` shape — `antigravity -p "<prompt>"` (prompt streamed via a temp file). This is the one detail that cannot be verified from inside this repo; it is isolated to a single `cliBinary` constant (plus the default `-p` prompt flag) so a maintainer can correct it in one place if the real command differs.
- **Config paths**: Antigravity's steering/agents/skills/MCP layout is not documented from inside this repo, so the `ProviderPaths` entry uses conservative, minimal values (project-root `AGENTS.md` steering, dot command format, no agents/skills/hooks claimed). These only affect secondary sync features, never the core dispatch, and can be tightened when the layout is confirmed.

## Approach

- Add an `ANTIGRAVITY` constant to `AIProviders` in `src/core/constants.ts`.
- Add a `PROVIDER_PATHS[ANTIGRAVITY]` entry in `src/ai-providers/aiProvider.ts` (mirrors the minimal terminal-CLI shape).
- Add `src/ai-providers/antigravityCliProvider.ts` extending `CliTerminalProvider` (like `qwenCliProvider.ts`).
- Register it in `PROVIDER_CONSTRUCTORS` (`src/ai-providers/aiProviderFactory.ts`) and export it from `src/ai-providers/index.ts`.
- Add the enum value, label, and description in `package.json`.
- Update the README matrix column + provider counts, `docs/architecture.md` (count + provider-file mention), and `docs/how-it-works.md` (count).
- Add a root `CHANGELOG.md` Unreleased entry.
- Extend `tests/integration/docs-consistency.test.ts` (`idToFile` map + count word) and add a provider-resolution test.
