# Feature Specification: Clarify AI Provider Dropdown Labels

**Feature Branch**: `108-clarify-provider-labels`  
**Created**: 2026-05-26  
**Status**: Draft  

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recognizable Provider Labels in the Dropdown (Priority: P1)

A developer opens the AI Provider setting dropdown and immediately understands which option maps to the tool they use daily. The raw internal key `ide-chat` is replaced with a friendly name like "GitHub Copilot" or "IDE Chat (VS Code)" — without having to read the description at the bottom to decode what the option means.

**Why this priority**: This is the highest-friction item in the first-run experience. Users unfamiliar with SpecKit's internal provider keys — especially casual users who picked it up via the Marketplace — must guess what `ide-chat`, `claude-vscode`, or `copilot` mean. A clear label removes that ambiguity instantly.

**Independent Test**: Open the AI Provider setting dropdown in the SpecKit sidebar. Verify that every option in the list shows a human-readable display name (e.g., "GitHub Copilot", "Claude Code", "Gemini CLI") rather than its raw enum key. The dropdown can be tested standalone without running any actual AI command.

**Acceptance Scenarios**:

1. **Given** the AI Provider dropdown is open, **When** a user scans the list, **Then** every option has a friendly display name that identifies the tool by its public brand name (not its internal enum key)
2. **Given** the user hovers over or selects any option, **When** a description is shown, **Then** the description references the same brand name used in the display label for consistency
3. **Given** a user whose current setting is `ide-chat`, **When** they open the dropdown, **Then** the selected option visually reads as "GitHub Copilot" (or the most accurate available label) rather than `ide-chat`

---

### User Story 2 - IDE-Aware Label for the `ide-chat` Provider (Priority: P2)

When SpecKit can detect the host IDE, the `ide-chat` option shows the actual IDE's chat product name. Running inside VS Code shows "GitHub Copilot"; running inside Cursor shows "Cursor Chat"; running inside Windsurf shows "Windsurf Chat". If detection is unavailable, it falls back to the generic label "IDE Chat".

**Why this priority**: `ide-chat` is the most confusing option because it changes meaning depending on the editor. Making the label context-aware turns a confused guess into a confident choice.

**Independent Test**: Launch the extension in VS Code, Cursor, and Windsurf separately. In each, open the AI Provider dropdown and verify that the `ide-chat` entry shows the IDE-specific name. If run in an unrecognized host, verify it shows the generic fallback "IDE Chat".

**Acceptance Scenarios**:

1. **Given** the extension is running in VS Code, **When** the dropdown renders, **Then** the `ide-chat` option reads "GitHub Copilot"
2. **Given** the extension is running in Cursor, **When** the dropdown renders, **Then** the `ide-chat` option reads "Cursor Chat"
3. **Given** the extension is running in Windsurf, **When** the dropdown renders, **Then** the `ide-chat` option reads "Windsurf Chat"
4. **Given** the extension cannot determine the host IDE, **When** the dropdown renders, **Then** the `ide-chat` option reads "IDE Chat" as a safe fallback
5. **Given** the label for `ide-chat` changes based on IDE, **When** the user views the saved setting value in `settings.json`, **Then** the stored value is still the stable internal key (`ide-chat`), not the display label

---

### User Story 3 - Consistent Labels Everywhere the Provider Name Appears (Priority: P3)

The friendly provider label used in the dropdown is also shown in all other places where the provider name is displayed: the sidebar tree node, the status bar item, toast notifications, and command palette descriptions. A user never sees the raw internal key exposed in the UI.

**Why this priority**: Label changes in only one surface create an inconsistent experience. This story ensures the improvement is complete and not just a partial fix.

**Independent Test**: Set the provider to `ide-chat` and check the sidebar tree, status bar, and any notification that references the active provider. All should show the same human-readable name as the dropdown.

**Acceptance Scenarios**:

1. **Given** `ide-chat` is selected as the AI provider, **When** the user looks at the SpecKit sidebar tree node that shows the active provider, **Then** it displays the friendly label ("GitHub Copilot" in VS Code, etc.) not `ide-chat`
2. **Given** any provider is selected, **When** the provider name appears in a notification or status update, **Then** it uses the same friendly display name as the dropdown

---

### Edge Cases

- What if VS Code adds a new IDE detection API and the current detection method becomes unreliable — does the label silently fall back to generic?
- What if a user manually edits `settings.json` to set a provider key not in the known list — does the dropdown still render without crashing?
- What if the extension is loaded in a web-based VS Code (vscode.dev) where IDE detection behaves differently?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The AI Provider dropdown MUST display a human-readable display name for each provider option instead of (or in addition to) the raw internal key
- **FR-002**: The display name for the `ide-chat` provider MUST be dynamically resolved at render time based on the detected host IDE (VS Code → "GitHub Copilot", Cursor → "Cursor Chat", Windsurf → "Windsurf Chat")
- **FR-003**: When the host IDE cannot be determined, the `ide-chat` display name MUST fall back to the generic label "IDE Chat"
- **FR-004**: The internal stored value for the provider setting MUST remain the stable enum key (e.g., `ide-chat`) — the display label is presentation-only and never persisted
- **FR-005**: All UI surfaces that display the active provider name (sidebar tree, notifications, status area) MUST use the same friendly display label as the dropdown
- **FR-006**: The provider display name resolution MUST be available as a shared utility so that every surface reads from one source of truth, avoiding label drift

### Key Entities

- **AI Provider**: A configured AI backend identified by a stable internal key (e.g., `ide-chat`, `claude`, `copilot`). Has a display name used in all UI surfaces and an optional IDE-aware override for the `ide-chat` variant.
- **Provider Label Registry**: A mapping from internal provider key → display name, with a special rule for `ide-chat` that checks the host IDE at runtime.
- **Host IDE Detection**: A utility that inspects the VS Code extension host environment (e.g., `vscode.env.appName`) to return one of: `vscode`, `cursor`, `windsurf`, or `unknown`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero raw internal keys visible in the UI — every provider name shown to the user is a friendly label
- **SC-002**: The `ide-chat` option shows an IDE-specific name in VS Code, Cursor, and Windsurf without any manual configuration by the user
- **SC-003**: A single label-resolution function is the sole source of all provider display names across the extension — no hardcoded strings duplicated across files
- **SC-004**: Saved settings are unaffected — the stored key in `settings.json` matches the existing enum, ensuring backward compatibility with existing user configurations

## Assumptions

- VS Code exposes the host editor identity via `vscode.env.appName` (or equivalent), which returns values that can be mapped to Cursor/Windsurf/VS Code without additional dependencies
- The AI Provider setting is rendered via the SpecKit sidebar config tree (introduced in spec 035), not via the native VS Code settings UI, so display label customization is within the extension's control
- The existing provider enum keys (`ide-chat`, `claude`, `claude-vscode`, `gemini`, `copilot`, `codex`, `qwen`, `opencode`) remain stable; this spec only changes how they are displayed
- This feature is scoped to display labels only — no changes to how prompts are routed or commands are dispatched to each provider
