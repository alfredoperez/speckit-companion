# Spec: IDE Chat Provider

**Slug**: 100-ide-chat-provider | **Date**: 2026-05-21

## Summary

Today every speckit command is dispatched to an AI **CLI** by spawning a terminal (Claude Code, Gemini, Copilot CLI, Codex, Qwen, OpenCode). Since SpecKit Companion already runs inside an AI-native IDE, this feature adds an **"IDE Chat"** option to the existing `speckit.aiProvider` setting that routes the assembled prompt straight to the host editor's built-in AI chat instead of a terminal. The extension detects which editor it's hosted in — VS Code (GitHub Copilot), Cursor, or Windsurf — and targets the right chat surface automatically.

## Requirements

- **R001** (MUST): Add `ide-chat` as a selectable value of `speckit.aiProvider`, registered alongside the existing CLI providers — a new entry in the `AIProviders` constant, the `package.json` enum/`enumDescriptions`, `PROVIDER_PATHS`, and the factory's `PROVIDER_CONSTRUCTORS` — so it appears in the provider QuickPick like any other provider.
- **R002** (MUST): The IDE Chat provider implements the full `IAIProvider` interface (`executeInTerminal`, `executeSlashCommand`, `executeHeadless`, `isInstalled`, `getPermissionFlag`) so every existing dispatch call site (`getAIProvider().executeInTerminal(...)` / `executeSlashCommand(...)`) routes through it unchanged.
- **R003** (MUST): Detect the host IDE at runtime (VS Code → Copilot, Cursor, Windsurf) using a stable VS Code API signal (e.g. `vscode.env.appName` / `vscode.env.uriScheme`) and resolve the correct chat-dispatch target for the detected editor.
- **R004** (MUST): When IDE Chat is the active provider, dispatch the assembled prompt text to the detected IDE's built-in chat (via the editor's chat command) instead of calling the terminal path — reusing the existing prompt the extension already builds, not a separate prompt.
- **R005** (MUST): Handle the unsupported or undetectable case gracefully — when the running editor exposes no addressable chat target, surface a clear, actionable message (and/or fall back) rather than failing silently or throwing an unhandled error.
- **R006** (SHOULD): Log the detected IDE and the chosen chat target to the extension output channel for diagnosability.
- **R007** (MUST): Dispatch auto-submits the prompt only when spec-kit is initialized in the workspace (so the host chat recognizes `/speckit.*`). When spec-kit is not initialized, surface an actionable warning pointing to SpecKit workspace init and prefill the prompt **without** auto-submitting, so an unrecognized command is never fired.
- **R008** (MUST): Dispatch reduces the built prompt to what the host chat can use: strip the `buildPrompt` context-update preamble (bookkeeping is meaningless to a host chat and buries the command); shorten a spec-dir path argument to just the spec name (e.g. `/speckit.tasks 100-ide-chat-provider`); leave free-text/multi-token arguments alone (e.g. a typed `specify` description); and for `specify <temp.md>` (create-new-spec passes the description inside a temp markdown file a chat can't read), inline the file's description text, dropping the appended spec-context block.

## Open Questions

<!-- Resolve during /sdd:plan — these gate the design. -->

- **Q1 — chat command IDs**: VS Code + Copilot exposes a documented chat command (`workbench.action.chat.open` with a `query`). Cursor (Composer/chat) and Windsurf (Cascade) are VS Code forks whose chat command IDs are proprietary and not officially documented. Plan must confirm the exact command + argument shape for each, and how to verify a command exists before dispatching (so R005's graceful path triggers when it doesn't).
- **Q2 — auto-submit vs. prefill**: Some chat-open commands prefill the input box but do not auto-send. Decide whether IDE Chat dispatch should auto-submit the prompt or leave it staged for the user to press Enter, per IDE. **Resolved (R007)**: auto-submit when spec-kit is initialized; otherwise prefill + warn.
- **Q3 — headless behavior**: `executeHeadless` has no terminal analog for chat. Decide whether headless degrades to the interactive chat path or is unsupported for IDE Chat.

## Scenarios

### Dispatch in VS Code (Copilot)

**When** the user has `speckit.aiProvider` set to `ide-chat`, is running in VS Code, and triggers a speckit command (e.g. from the spec viewer or sidebar)
**Then** the assembled prompt is opened in the Copilot Chat panel instead of a terminal, ready to run

### Dispatch in Cursor or Windsurf

**When** the active provider is `ide-chat` and the host editor is Cursor or Windsurf
**Then** the prompt is routed to that editor's native chat (Composer / Cascade) using the editor-specific chat target

### Spec-kit not initialized for the host

**When** the active provider is `ide-chat` but the workspace has not been initialized with spec-kit (no `.specify/` or host command files)
**Then** the extension prefills the prompt in the host chat without sending it, and shows a warning explaining the chat won't recognize `/speckit.*` until spec-kit is initialized — with an action to initialize the workspace

### Undetectable or unsupported editor

**When** the active provider is `ide-chat` but the running editor exposes no addressable chat target
**Then** the extension surfaces a clear message explaining IDE Chat isn't available here (and points the user back to a CLI provider) instead of throwing or silently doing nothing

### Existing CLI providers unaffected

**When** the user keeps any CLI provider selected (claude, gemini, copilot, codex, qwen, opencode)
**Then** dispatch behaves exactly as before — IDE Chat adds an option, it does not change the terminal path

## Non-Functional Requirements

- **NFR001** (MUST): Reliability — provider detection and dispatch never throw an unhandled error; an unsupported editor yields the R005 graceful message.

## Out of Scope

- Replacing or removing the existing terminal CLI providers.
- Per-IDE manual override beyond auto-detection.
- IDEs other than VS Code, Cursor, and Windsurf.
- Deep two-way integration with the chat (reading responses back, status sync) — this is one-way dispatch only.
