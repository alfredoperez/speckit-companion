# Research: Clarify AI Provider Dropdown Labels

**Feature**: 108-clarify-provider-labels  
**Date**: 2026-05-26

## Decision 1 — VS Code Settings UI: Use `enumItemLabels`

**Decision**: Add `enumItemLabels` to the `speckit.aiProvider` setting in `package.json`.

**Rationale**: The VS Code settings contribution schema supports `enumItemLabels` (available since VS Code 1.56) to display friendly labels in the settings editor while storing the raw enum value. This is the canonical solution for friendly settings dropdowns without any runtime code.

**Alternatives considered**:

- Replace enum values with friendly keys (e.g., `"github-copilot"` instead of `"copilot"`) — rejected because it breaks existing user `settings.json` files.
- Show descriptions only (already done via `enumDescriptions`) — rejected because the raw key still appears as the primary label.

---

## Decision 2 — Dynamic `ide-chat` Label: Standalone Helper Function

**Decision**: Extract the host-IDE detection logic into a standalone exported function `getIdeChatDisplayName(): string` in `ideChatProvider.ts` (or `aiProvider.ts`). Returns `"GitHub Copilot"`, `"Cursor Chat"`, `"Windsurf Chat"`, or `"IDE Chat"` (fallback).

**Rationale**: `IdeChatProvider.detectHostIde()` already does this detection reliably via `vscode.env.uriScheme` and `vscode.env.appName`. Extracting it to a module-level function (no class instantiation needed) lets the QuickPick, steering tree, and any other surface call it without constructing a full provider instance.

**Alternatives considered**:

- Make `PROVIDER_PATHS[IDE_CHAT].displayName` a function — rejected because all other `displayName` values are strings and changing the type breaks the interface.
- Add a `getDisplayName()` method to `IAIProvider` — rejected as over-engineering; the display name doesn't require a full provider instance.
- Hard-code separate label per surface — rejected; FR-006 requires a single source of truth.

**IDE → label mapping** (from existing `detectHostIde()` detection logic):

| `vscode.env.uriScheme` / `appName` | Display label                      |
| ---------------------------------- | ---------------------------------- |
| `cursor` / contains "cursor"       | Cursor Chat                        |
| `windsurf` / contains "windsurf"   | Windsurf Chat                      |
| `vscode`, `vscode-insiders`        | GitHub Copilot                     |
| `antigravity`                      | IDE Chat (antigravity fork, niche) |
| anything else / `unknown`          | IDE Chat                           |

---

## Decision 3 — Improved `displayName` Strings for All Providers

**Decision**: Update `PROVIDER_PATHS.displayName` values to use public brand names that include the tool type:

| Provider key    | Old `displayName`   | New `displayName`            |
| --------------- | ------------------- | ---------------------------- |
| `claude`        | `Claude`            | `Claude Code`                |
| `claude-vscode` | `Claude in VS Code` | `Claude Code (VS Code)`      |
| `gemini`        | `Gemini`            | `Gemini CLI`                 |
| `copilot`       | `Copilot`           | `GitHub Copilot CLI`         |
| `codex`         | `Codex`             | `Codex CLI`                  |
| `qwen`          | `Qwen`              | `Qwen Code`                  |
| `opencode`      | `OpenCode`          | `OpenCode`                   |
| `ide-chat`      | `IDE Chat`          | _(dynamic — see Decision 2)_ |

**Rationale**: Users who search for "GitHub Copilot" or "Claude" won't recognize "Copilot" or just "Claude" as the correct CLI tool. Including the tool type ("CLI", "Code") anchors the label to the product they have installed.

**Note on `copilot` vs `ide-chat`**: `copilot` key refers to the **GitHub Copilot CLI** (a terminal-based agent), while `ide-chat` routes to the **GitHub Copilot chat panel** inside VS Code. Renaming `copilot` → `GitHub Copilot CLI` makes this distinction clear.

---

## Decision 4 — `enumItemLabels` Static Values for `ide-chat`

**Decision**: The static `enumItemLabels` entry for `ide-chat` in `package.json` is `"IDE Chat (Copilot · Cursor · Windsurf)"`. The dynamic IDE-specific label only appears in the custom QuickPick and sidebar tree (runtime surfaces), not in the settings editor (compile-time).

**Rationale**: `package.json` contributions are static JSON — there is no way to inject a runtime `vscode.env` call there. The `enumDescriptions` entry already explains the mapping; the label just needs to be more recognizable than the raw key.

---

## Files to Change

| File                                                | Change                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| `package.json`                                      | Add `enumItemLabels` to `speckit.aiProvider`                                |
| `src/ai-providers/aiProvider.ts`                    | Update all `displayName` strings; add `getProviderDisplayName(type)` export |
| `src/ai-providers/ideChatProvider.ts`               | Extract `detectHostIde` into an exported module-level function              |
| `src/features/steering/steeringExplorerProvider.ts` | Call `getProviderDisplayName()` for provider tree header label              |
