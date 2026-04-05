# Feature Specification: Update Architecture & Documentation

**Feature Branch**: `045-update-docs`  
**Created**: 2026-04-05  
**Status**: Draft  
**Input**: User description: "update architecture docs and all docs to match current implementation"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Onboarding via Architecture Docs (Priority: P1)

A new contributor opens `docs/architecture.md` to understand the project structure before making changes. The document accurately reflects the current directory layout, key classes, and module boundaries so the developer can navigate the codebase confidently.

**Why this priority**: Architecture docs are the first thing contributors read; stale docs cause confusion and wasted time exploring the wrong paths.

**Independent Test**: A developer unfamiliar with the project can read `docs/architecture.md` and correctly identify where to find any feature module, provider, or manager class without needing to search the filesystem.

**Acceptance Scenarios**:

1. **Given** a developer reads `docs/architecture.md`, **When** they look for the project directory tree, **Then** every directory and key file listed matches what actually exists on disk (no phantom directories like `commands/`, `services/`, `shared/`, `watchers/` at top-level; no missing directories like `spec-viewer/`, `spec-editor/`)
2. **Given** the architecture doc lists key components, **When** a developer looks for a specific provider or manager, **Then** the listed class names and file paths are accurate (e.g., no references to `agentsExplorerProvider.ts`, `hooksExplorerProvider.ts`, or `mcpExplorerProvider.ts` which do not exist)

---

### User Story 2 - Developer Understanding Feature Docs (Priority: P2)

A developer opens `docs/how-it-works.md` to understand the extension's data flow, provider system, and feature modules. The document accurately reflects the current AI providers (including Codex and Qwen), the actual tree views (3 views, not 7), and the correct project structure.

**Why this priority**: The how-it-works doc is the deep-dive reference; inaccuracies here lead to incorrect assumptions about capabilities and integration points.

**Independent Test**: A developer reading `docs/how-it-works.md` can correctly enumerate all supported AI providers, all tree views, and the activation flow without encountering references to non-existent components.

**Acceptance Scenarios**:

1. **Given** `docs/how-it-works.md` lists AI providers, **When** a developer reads the provider section, **Then** all 5 providers are listed (Claude, Copilot, Gemini, Codex, Qwen) and no phantom views (MCP, Hooks, Agents as separate sidebar views) are referenced
2. **Given** `docs/how-it-works.md` describes the project structure, **When** a developer compares it to the actual filesystem, **Then** the structure matches reality including `spec-viewer/`, `spec-editor/`, `workflows/`, and the full webview structure
3. **Given** `docs/how-it-works.md` describes the provider capabilities matrix, **When** a developer checks it, **Then** it includes all 5 providers with accurate capability flags

---

### User Story 3 - Contributor Updating CLAUDE.md (Priority: P3)

A contributor reads `CLAUDE.md` to understand the project structure section and follows its guidance for where to place new code. The listed structure matches the actual codebase.

**Why this priority**: CLAUDE.md is referenced by AI tools during development; inaccurate structure info leads to misplaced code suggestions.

**Independent Test**: The project structure in `CLAUDE.md` matches the actual filesystem layout when compared directory-by-directory.

**Acceptance Scenarios**:

1. **Given** `CLAUDE.md` contains a project structure section, **When** compared to the actual `src/` and `webview/` directories, **Then** all listed paths exist and no significant directories are missing

---

### Edge Cases

- What happens when a document references a file that was renamed? All references must use current file paths.
- How does the spec-viewer modular CSS structure get documented? List the partials directory under `webview/styles/spec-viewer/`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `docs/architecture.md` MUST reflect the current `src/` directory structure with accurate paths for `core/`, `features/`, `ai-providers/`, and `speckit/` directories
- **FR-002**: `docs/architecture.md` MUST NOT reference directories that do not exist (`commands/`, `constants/`, `services/`, `shared/`, `watchers/`, `providers/` at top-level)
- **FR-003**: `docs/architecture.md` MUST list the correct key components: SpecExplorerProvider, SteeringExplorerProvider, OverviewProvider, SpecViewerProvider, SpecEditorProvider, WorkflowEditorProvider
- **FR-004**: `docs/how-it-works.md` MUST list all 5 AI providers (Claude, Copilot, Gemini, Codex, Qwen) with accurate capability flags
- **FR-005**: `docs/how-it-works.md` MUST show 3 tree views (explorer, steering, settings) instead of the incorrect 7 views
- **FR-006**: `docs/how-it-works.md` MUST include the spec-viewer and spec-editor feature modules in the project structure
- **FR-007**: `docs/how-it-works.md` MUST accurately describe the webview structure including spec-viewer, spec-editor, and workflow editor webviews
- **FR-008**: `CLAUDE.md` project structure MUST match the actual `src/` and `webview/` directory layouts
- **FR-009**: All configuration keys listed in docs MUST include current settings (e.g., `speckit.specDirectories`, `speckit.customWorkflows`, `speckit.defaultWorkflow`, `speckit.customCommands`)
- **FR-010**: Provider capabilities matrix MUST be updated to include Codex and Qwen providers

### Key Entities

- **Documentation Files**: `docs/architecture.md`, `docs/how-it-works.md`, `docs/viewer-states.md`, `CLAUDE.md` - the files being updated to match reality
- **Source Modules**: The actual `src/` and `webview/` directory trees that serve as the source of truth

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every directory path listed in documentation exists in the actual filesystem (0 phantom paths)
- **SC-002**: Every class/provider name referenced in documentation exists in the codebase (0 phantom references)
- **SC-003**: All 5 supported AI providers are documented with accurate capability information
- **SC-004**: The number of tree views documented matches the actual registered views (3 views)
- **SC-005**: A new contributor can locate any feature module within 30 seconds using only the documentation
