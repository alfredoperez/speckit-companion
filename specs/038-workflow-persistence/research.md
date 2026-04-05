# Research: Workflow Persistence Across Spec Lifecycle

## Decision 1: How to persist workflow selection from spec editor

**Problem**: The spec editor sends a command to the AI terminal (e.g., `/sdd:specify <content>`). The AI CLI creates the spec directory externally. At submit time, the extension doesn't know the spec directory path, so it can't write `.spec-context.json` immediately.

**Decision**: Use a filesystem watcher to detect the newly created spec directory, then persist the workflow selection.

**Rationale**: 
- The spec editor calls `provider.executeInTerminal()` which sends text to a terminal — the spec directory is created asynchronously by the external AI tool
- A `vscode.workspace.createFileSystemWatcher()` can watch for new `spec.md` files appearing under the specs directory
- When detected, call `saveFeatureWorkflow()` on the parent directory with the workflow name from the submission
- Dispose the watcher after detection or after a timeout (5 minutes) to avoid resource leaks

**Alternatives considered**:
- **workspaceState storage**: Store "last selected workflow" in `ExtensionContext.workspaceState`, then read it in `getOrSelectWorkflow()`. Simpler, but fragile — if user creates two specs quickly, the second overwrites the first's pending workflow. Also requires modifying `workflowSelector.ts` which is used by all providers.
- **Pass workflow name in the terminal command**: Would require changing the SDD slash command protocol to accept a `--workflow` flag. Invasive change across multiple systems.
- **Polling**: Check for new directories on a timer. Wasteful and inelegant when VS Code provides native file watchers.

## Decision 2: Default workflow fallback chain

**Problem**: When no workflow is selected or persisted, the system needs a consistent fallback.

**Decision**: Maintain the existing fallback chain: `.spec-context.json` → `speckit.defaultWorkflow` setting → built-in DEFAULT_WORKFLOW. No changes needed — this already works correctly in `getOrSelectWorkflow()` and `resolveWorkflowSteps()`.

**Rationale**: 
- `getOrSelectWorkflow()` (workflowSelector.ts:139-169) already checks existing context, falls back to config, falls back to `workflows[0]` (which is DEFAULT_WORKFLOW), and persists the result
- `resolveWorkflowSteps()` (specViewerProvider.ts:78-112) follows the same chain for the viewer
- Both functions already save the resolved workflow, so the default is only applied once

**Alternatives considered**:
- **Always prompt user**: Add an interactive picker when no workflow is set. Rejected — user explicitly said "use default" when none is selected.

## Decision 3: Handling stale/removed workflows

**Problem**: A persisted workflow name might reference a workflow the user has since removed from their settings.

**Decision**: Fall back to the default workflow when a persisted name doesn't resolve. Both `getOrSelectWorkflow()` (line 143-148) and `resolveWorkflowSteps()` (line 86-93) already handle this — if `getWorkflow(name)` returns undefined, they fall through to the default. No changes needed.

**Rationale**: Existing code already handles this gracefully. The only gap was that `getOrSelectWorkflow()` doesn't re-persist the fallback when the original workflow is gone, but since it auto-selects and saves, this is handled on next step execution.

## Decision 4: Where to place the file watcher logic

**Problem**: The watcher needs access to the `workflowName` from submission and must be scoped to the spec editor's lifecycle.

**Decision**: Add the watcher inside `handleSubmit()` in `specEditorProvider.ts`, after `executeInTerminal()`. Store it as a disposable on the provider class and dispose in the panel's `onDidDispose` handler and after successful detection.

**Rationale**: 
- The provider already manages disposables via the panel lifecycle
- The watcher is specific to the editor's submission flow
- Keeps the change scoped to a single file

**Alternatives considered**:
- **Global watcher in extension.ts**: Would work but adds coupling between the editor and a global concern. Harder to pass the workflow name.
- **Separate service class**: Over-engineered for a single watcher with one consumer.
