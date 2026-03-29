# Spec: Console Panel

**Slug**: 025-console-panel | **Date**: 2026-03-26

## Summary

Embed AI CLI output directly inside the spec viewer webview so users never leave the workflow. Currently, clicking "Regenerate" or "Next Step" opens a VS Code terminal in a split view, forcing three context switches. The console panel streams command output inline, reducing context switches to zero.

## Requirements

- **R001** (MUST): A collapsible console panel renders inside the spec viewer webview, between the content area and the footer bar
- **R002** (MUST): When a workflow step command executes (regenerate, approve, clarify), the process spawns as a child process instead of opening a VS Code terminal, and output streams into the console panel in real-time
- **R003** (MUST): Console panel has three visual states — hidden (default), running (with pulse animation indicator), and finished (showing "done" green badge or "error" red badge with exit code)
- **R004** (MUST): A ">_ Console" toggle button in the footer allows manual show/hide of the console panel
- **R005** (MUST): Console auto-opens when a command starts and auto-scrolls output unless the user has scrolled up
- **R006** (MUST): Only one active child process per spec viewer panel; starting a new command while one is running shows a confirmation dialog
- **R007** (MUST): The child process is killed when the webview panel is disposed
- **R008** (SHOULD): ANSI escape codes in output are stripped (regex removal) before rendering
- **R009** (SHOULD): Output buffer is capped at ~10,000 lines, trimming from the top when exceeded
- **R010** (SHOULD): Content area and console panel respect minimum heights (~100px each) during resize

## Scenarios

### Running a workflow step

**When** the user clicks "Regenerate", "Next Step", or an enhancement button
**Then** the console panel opens automatically, displays the command being run, and streams stdout/stderr output in real-time with a monospace font

### Process completes successfully

**When** the child process exits with code 0
**Then** the console header shows a green "done" badge, the file watcher updates the content area above, and the output is preserved for review

### Process fails

**When** the child process exits with a non-zero exit code
**Then** the console header shows a red "error" badge with the exit code, and error output remains visible for debugging

### Manual console toggle

**When** the user clicks the ">_ Console" button in the footer
**Then** the console panel toggles between visible and hidden, and the content area resizes accordingly

### Smart auto-scroll

**When** new output arrives and the user is scrolled to the bottom
**Then** the console auto-scrolls to show new content
**When** the user has manually scrolled up to review earlier output
**Then** auto-scroll is disabled until they scroll back to the bottom

### Concurrent command attempt

**When** a user triggers a new command while a process is already running
**Then** a confirmation dialog appears asking whether to kill the running process

### Panel disposal

**When** the spec viewer webview panel is closed or disposed
**Then** any running child process is killed and resources are cleaned up

## Out of Scope

- ANSI-to-HTML color conversion (strip only for v1)
- Persisting console output across webview hide/restore cycles
- stdin/interactive input support (quick-reply feature deferred)
- Resizable drag handle between content and console (fixed proportions for v1)
