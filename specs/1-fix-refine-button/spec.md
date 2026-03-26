# Spec: Fix Refine Button Not Launching Terminal

**Slug**: 1-fix-refine-button | **Date**: 2026-03-26

## Summary

The "Refine" submit button in the spec-viewer collects inline refinement comments but fails to launch a terminal session to execute the refinement. The root cause is that `handleSubmitRefinements` calls `vscode.commands.executeCommand()` (a VS Code command dispatch) instead of `getAIProvider().executeInTerminal()` (which opens a terminal and sends the prompt to the AI CLI). This means clicking "Refine (N comments)" does nothing visible.

## Requirements

- **R001** (MUST): Clicking the refine submit button must open an AI terminal and send the current step's slash command with refinement context appended
- **R002** (MUST): The refinement context string (line numbers + comments) must be included in the terminal prompt so the AI CLI can act on it
- **R003** (SHOULD): Use the same `executeStepInTerminal` pattern (or equivalent) used by approve/regenerate handlers for consistency

## Scenarios

### Submitting refinements launches terminal

**When** user has added 1+ refinement comments and clicks the "Refine (N comments)" button
**Then** a terminal opens with the current step's command and the refinement text appended as context

### No refinements — button hidden

**When** no refinement comments are pending
**Then** the refine button is not visible and no terminal action occurs

## Out of Scope

- Individual line `refineLine` handler (currently a TODO stub — separate issue)
- Changes to the refinement UI or popover behavior
