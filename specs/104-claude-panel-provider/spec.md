# Spec: Claude Code Panel Provider

**Slug**: 104-claude-panel-provider | **Date**: 2026-05-22

## Summary

Add a new `speckit.aiProvider` value, `claude-panel`, that dispatches SpecKit steps to the **Claude Code GUI panel** (the native, non-terminal experience) instead of spawning the `claude` CLI in a terminal. The panel is opened via the Claude Code extension's documented URI handler (`vscode://anthropic.claude-code/open?prompt=…`), which **prefills but cannot auto-submit** — so the user presses Enter, prompted by an obvious notification. Shipped alongside is a provider-agnostic fix: `getAIProvider()` resolves the current provider on every call instead of returning a singleton frozen at activation, so switching providers no longer requires a window reload.

## Requirements

- **R001** (MUST): A new `claude-panel` provider is wired end to end — `AIProviders` constant, `PROVIDER_PATHS` entry mirroring `claude` (same `.claude/` config, dash command format), factory constructor, `index.ts` export, and `package.json` `speckit.aiProvider` `enum` + `enumDescriptions`. Selecting it via `speckit.aiProvider` routes every SpecKit dispatch (create, specify, plan, tasks, implement, slash commands) to the panel.
- **R002** (MUST): `ClaudePanelProvider` opens the Claude Code panel through the URI handler (using `vscode.env.uriScheme` so it works in Insiders/forks) with the command prefilled into the input box. `isInstalled()` returns true only when `vscode.extensions.getExtension('anthropic.claude-code')` is present.
- **R003** (MUST): After dispatch, an obvious notification states the command was **prefilled and needs a manual Enter** (the panel cannot auto-submit) and names the command verb so the pending action is clear.
- **R004** (MUST): The prefilled command text is cleaned up before dispatch — the new-spec description is inlined from the temp `spec.md` (reusing the `ideChatProvider.readSpecDescription` pattern) rather than passing an absolute temp path, and spec-directory arguments are shortened to just the spec name instead of absolute paths like `…/globalStorage/…/spec.md`.
- **R005** (MUST): The `.spec-context.json` bookkeeping preamble is handled deliberately — either dropped (as `ide-chat` does) or carried via an `@`-mention of a workspace prompt file. The choice is made only **after** confirming whether an `@`-mention inside a prefilled prompt actually attaches the file as context versus landing as literal text.
- **R006** (MUST): `getAIProvider()` resolves through the factory on every call (no singleton frozen at activation), so changing `speckit.aiProvider` takes effect without a window reload and every call site (spec editor, spec viewer, steering, workflow editor) resolves the same provider. This is shippable independently of the panel feature.
- **R007** (SHOULD): When the Claude Code extension is absent or the panel can't be opened, the provider warns the user (suggesting they switch `speckit.aiProvider` to terminal `claude`) and never throws — every dispatch path degrades gracefully.
- **R008** (MUST): README "Supported AI Providers" matrix gains a `claude-panel` column and the provider count is updated everywhere it's stated (Seven → Eight providers), per the CLAUDE.md Feature → README map.
- **R009** (MUST): Unit tests cover `ClaudePanelProvider`, mirroring `src/ai-providers/__tests__/ideChatProvider.test.ts` (install detection, prompt cleanup, graceful fallback when uninstalled).
- **R010** (SHOULD): The terminal `claude` provider's behavior is unchanged — the two providers coexist.

## Scenarios

### Dispatch to an installed panel

**When** `speckit.aiProvider` is `claude-panel`, the Claude Code extension is installed, and the user triggers a SpecKit step (e.g. Tasks)
**Then** the Claude Code panel opens with the `/speckit-tasks <spec-name>` command prefilled, and a notification tells the user to press Enter to run it.

### Panel not installed

**When** `speckit.aiProvider` is `claude-panel` but the Claude Code extension is not installed
**Then** the provider shows a warning suggesting the terminal `claude` provider and does not throw or open anything.

### New-spec description inlining

**When** a "create spec" dispatch carries the feature description inside a temp `spec.md`
**Then** the prefilled command is `/speckit-specify <description>` with the description inlined, not an absolute temp-file path.

### Spec-directory argument shortening

**When** a SpecKit step is dispatched with a spec-directory path argument
**Then** the prefilled command shows just the spec name, not the absolute path.

### Provider switch without reload

**When** the user changes `speckit.aiProvider` (e.g. from `copilot` to `claude-panel`) and triggers actions from different surfaces (spec viewer Tasks button, spec editor create)
**Then** all surfaces dispatch through the newly selected provider in the same window, with no reload required.

## Non-Functional Requirements

- **NFR001** (MUST): Reliability — every dispatch path is wrapped so a missing extension, no workspace folder, or a failed `openExternal` surfaces a user-facing warning and returns a non-failure result rather than throwing.

## Out of Scope

- Auto-submit of the prefilled prompt — not exposed by the Claude Code extension (only an OS-level keystroke hack could force it, which is not shippable).
- Routing through VS Code's native chat view / the Copilot-hosted Claude session.
- Any change to the terminal `claude` provider.
