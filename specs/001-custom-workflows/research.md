# Research: Custom Workflows

**Feature**: 001-custom-workflows
**Date**: 2026-01-26

## Research Questions

### 1. VS Code Configuration Array Schema Best Practices

**Question**: What is the best approach for defining complex configuration arrays in VS Code extensions?

**Research Findings**:
- VS Code supports `anyOf` schema for mixed array types (string or object)
- The existing `speckit.customCommands` setting already demonstrates this pattern
- Schema should include `additionalProperties: false` for strict validation
- VS Code validates configuration on load and provides IntelliSense support

**Decision**: Use `speckit.customWorkflows` configuration array with JSON schema validation
**Rationale**: Follows established pattern from `customCommands`, provides IDE support, validates at load time
**Alternatives Considered**:
- Separate settings file: Rejected - adds complexity, no IDE integration
- JSON file in workspace: Rejected - not portable, no schema support

### 2. Workflow Selection UI Pattern

**Question**: How should the workflow selection be presented when multiple workflows exist?

**Research Findings**:
- VS Code QuickPick is standard for selection UI in extensions
- Current phase commands (specify, plan, etc.) do not prompt for workflow
- QuickPick supports description text and detail for each option
- Can be skipped when only default workflow exists (FR-006)

**Decision**: Use VS Code QuickPick with workflow name as label, description showing step mappings
**Rationale**: Consistent with VS Code patterns, non-blocking, informative
**Alternatives Considered**:
- TreeView selection: Rejected - too heavy for simple selection
- Command palette nested menu: Rejected - more clicks, less informative

### 3. Feature Context Persistence

**Question**: How should the selected workflow be persisted with a feature?

**Research Findings**:
- Features are stored in `specs/{feature-name}/` directories
- Current approach uses individual markdown files (spec.md, plan.md, tasks.md)
- Other extensions use hidden metadata files (e.g., `.vscode/settings.json`)
- The `speckit-settings.json` file exists in constants but is not yet used

**Decision**: Store workflow selection in `specs/{feature-name}/.speckit.json` metadata file
**Rationale**: Keeps workflow context with feature, doesn't pollute markdown, easy to parse
**Alternatives Considered**:
- Frontmatter in spec.md: Rejected - modifies user content, parsing complexity
- Global workspace state: Rejected - not tied to specific feature

### 4. Checkpoint Git Operations

**Question**: How should checkpoints handle commit and PR generation?

**Research Findings**:
- VS Code has built-in Git extension with programmatic API
- `vscode.commands.executeCommand` can invoke Git commands
- Current extension uses terminal for AI commands
- Git operations need error handling for uncommitted changes, conflicts, etc.

**Decision**: Use VS Code Git extension API (`vscode.git`) for commit, `gh` CLI via terminal for PR
**Rationale**: Git API is reliable and integrated; `gh` CLI is standard for GitHub PR creation
**Alternatives Considered**:
- All terminal-based: Rejected - less reliable, harder error handling
- All API-based: Rejected - no native PR API, would need GitHub API token management

### 5. Custom Command/Template Resolution

**Question**: How should custom step commands be resolved and validated?

**Research Findings**:
- Current slash commands follow `/speckit.{name}` pattern
- Commands are defined in `.claude/skills/` or `.specify/templates/commands/`
- Missing commands should gracefully fallback to default with warning (edge case in spec)
- Validation can happen at load time or execution time

**Decision**: Validate command existence at execution time, warn on missing, offer to use default
**Rationale**: Templates may be added after workflow configuration, execution-time check is more flexible
**Alternatives Considered**:
- Load-time validation only: Rejected - fails if templates added later
- Silent fallback: Rejected - user should be aware of missing templates

### 6. Commit Attribution Handling

**Question**: How should the "no co-author" checkpoint behavior be implemented?

**Research Findings**:
- Current commits include `Co-Authored-By: Claude` trailer
- Git commits support arbitrary message formats
- VS Code Git API allows specifying commit message programmatically

**Decision**: Checkpoint config includes `excludeCoAuthor: boolean`, default false
**Rationale**: Explicit opt-in per checkpoint, maintains backwards compatibility
**Alternatives Considered**:
- Global setting: Rejected - should be per-workflow/checkpoint specific
- Always exclude: Rejected - some users want attribution

## Integration Points Analysis

### Existing Code to Modify

1. **`src/features/specs/specCommands.ts`**
   - `registerPhaseCommands()`: Add workflow selection before command execution
   - Inject selected workflow's step mapping into command resolution

2. **`src/core/types/config.ts`**
   - Add `WorkflowConfig` and `CheckpointConfig` interfaces

3. **`src/core/constants.ts`**
   - Add `ConfigKeys.customWorkflows` constant
   - Add workflow-related file names

4. **`package.json`**
   - Add `speckit.customWorkflows` configuration schema
   - Add checkpoint-related settings (optional)

### New Files to Create

1. **`src/features/workflows/`** - New feature module
   - `workflowManager.ts` - Load, validate, and manage workflows
   - `workflowSelector.ts` - QuickPick UI for workflow selection
   - `checkpointHandler.ts` - Handle checkpoint prompts and git operations
   - `types.ts` - Workflow-specific type definitions
   - `index.ts` - Module exports

## Unresolved Items

None - all research questions have been addressed with clear decisions.
