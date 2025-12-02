<!--
SYNC IMPACT REPORT
==================
Version change: 0.0.0 → 1.0.0 (MAJOR - initial constitution creation)
Modified principles: N/A (initial creation)
Added sections:
  - Core Principles (5 principles)
  - Development Workflow
  - Quality Gates
  - Governance
Removed sections: N/A
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ updated (Constitution Check table added)
  - .specify/templates/spec-template.md ✅ aligned (no changes needed)
  - .specify/templates/tasks-template.md ✅ aligned (no changes needed)
Follow-up TODOs: None
-->

# SpecKit Companion Constitution

## Core Principles

### I. Code Quality First

All code contributions MUST meet the following quality standards:

- **TypeScript Strict Mode**: All source files MUST compile with strict TypeScript configuration. No `any` types unless explicitly justified.
- **Linting Compliance**: Code MUST pass ESLint checks with zero errors before merge.
- **Error Handling**: All async operations MUST have try-catch blocks. All file operations MUST handle missing files gracefully.
- **No Dead Code**: Unused imports, variables, and functions MUST be removed. No commented-out code in production.

**Rationale**: A VSCode extension runs in users' development environments. Quality issues directly impact developer productivity and trust.

### II. Provider-Agnostic Architecture

The extension MUST support multiple AI coding assistants without provider-specific coupling:

- **Abstraction Layer**: Provider-specific logic MUST be isolated behind interfaces. Core features MUST NOT directly reference Claude, Gemini, or Copilot implementations.
- **Configuration-Driven**: Provider selection MUST be user-configurable via VS Code settings (`speckit.aiProvider`).
- **Feature Parity**: Features supported by multiple providers MUST work consistently across all supported providers.
- **Graceful Degradation**: When a provider lacks a feature (e.g., hooks for Copilot), the UI MUST hide or disable that feature cleanly.

**Rationale**: Users should not be locked into a single AI provider. The extension's value is in the spec-driven workflow, not the provider.

### III. TreeView-First UX

All extension features MUST prioritize the sidebar tree view experience:

- **Discoverability**: All primary actions MUST be accessible from tree view context menus or inline icons.
- **Visual Feedback**: State changes (spec phases, file changes) MUST be reflected in tree item icons/descriptions within 1 second.
- **Minimal Modals**: Prefer inline editing and quick picks over modal dialogs. Use input boxes only when necessary.
- **Consistent Icons**: Use VS Code's built-in Codicon icons. Custom icons MUST follow the same visual style.

**Rationale**: Developers live in their editors. The extension must feel native to VS Code's UX patterns.

### IV. SpecKit Protocol Compliance

The extension MUST faithfully implement the SpecKit workflow:

- **File Structure**: Specs MUST follow the directory structure: `specs/{name}/spec.md`, `plan.md`, `tasks.md`.
- **Phase Integrity**: Workflow phases (Spec → Plan → Tasks → Implementation) MUST be enforced. Users MUST NOT skip phases without explicit override.
- **CLI Delegation**: Heavy processing (spec generation, task creation) MUST be delegated to the SpecKit CLI. The extension provides UI, not AI logic.
- **Template Respect**: Generated files MUST follow the templates in `.specify/templates/`.

**Rationale**: The extension is a companion to SpecKit, not a replacement. Consistent behavior with the CLI ensures users can switch between UI and CLI seamlessly.

### V. Defensive File Operations

All file system operations MUST protect user data:

- **Read Before Write**: NEVER overwrite a file without reading its current state first.
- **Workspace Boundaries**: All file operations MUST be scoped to the current workspace. NEVER access files outside the workspace root.
- **Confirmation for Destructive Actions**: Deleting specs, overwriting files, or bulk operations MUST require user confirmation.
- **Atomic Updates**: Multi-file operations SHOULD use transactions where possible. Partial failures MUST NOT leave the workspace in an inconsistent state.

**Rationale**: Users trust extensions with their code. Data loss is unacceptable.

## Development Workflow

### Code Organization

- **Feature Modules**: New features MUST be added to `src/features/` following the Manager pattern.
- **Providers**: New tree views MUST be added to `src/providers/` extending `TreeDataProvider`.
- **Commands**: All commands MUST be registered in `extension.ts` following the pattern `speckit.{feature}.{action}`.
- **Prompts**: AI prompt templates MUST be stored in `src/prompts/` and MUST NOT contain hardcoded provider names.

### Testing Requirements

- **Manual Testing**: All features MUST be tested in the Extension Development Host (F5) before submission.
- **Provider Coverage**: Features supporting multiple providers MUST be tested with at least 2 providers.
- **Error Paths**: Test both happy paths and error scenarios (missing files, invalid config, CLI not installed).

## Quality Gates

Before any feature is considered complete:

1. **Compilation**: `npm run compile` MUST succeed with zero errors.
2. **Packaging**: `npm run package` MUST produce a valid `.vsix` file.
3. **Extension Host**: Feature MUST work correctly in the Extension Development Host.
4. **Provider Agnostic**: If feature touches providers, it MUST be tested with Claude and at least one other provider.
5. **Documentation**: `package.json` contributions and README MUST be updated if commands/views change.

## Governance

- This constitution supersedes all other development practices for the SpecKit Companion project.
- Amendments require:
  1. Written proposal with rationale
  2. Review of impact on existing templates and code
  3. Version bump following semantic versioning
  4. Update to all dependent templates
- All code reviews MUST verify compliance with these principles.
- Complexity beyond these guidelines MUST be justified in the PR description.

**Version**: 1.0.0 | **Ratified**: 2025-12-02 | **Last Amended**: 2025-12-02
