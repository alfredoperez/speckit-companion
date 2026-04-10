# Spec: Floating Toast Notification

**Slug**: 058-floating-toast | **Date**: 2026-04-10

## Summary

Upgrade the spec viewer's inline toast component from a simple inline `<span>` in the footer to a proper floating toast notification that appears positioned above the footer with auto-dismiss behavior. Also remove the "Opening terminal…" toast message, which is redundant since the terminal opening is immediately visible.

## Requirements

- **R001** (MUST): The Toast component must render as a floating element positioned above the footer bar, not inline within it
- **R002** (MUST): Toast notifications must auto-dismiss after a configurable duration (default 2 seconds)
- **R003** (MUST): Toast must animate in (slide up + fade in) and animate out (fade out)
- **R004** (MUST): The "Opening terminal…" toast message must be removed — no toast should appear when executing a workflow action that opens a terminal
- **R005** (SHOULD): Toast should be horizontally centered above the footer
- **R006** (SHOULD): Toast should have a subtle background, border, and shadow consistent with VS Code theme variables

## Scenarios

### Toast appears on action

**When** the extension sends an `actionToast` message to the webview
**Then** a floating toast appears centered above the footer with the message text, then auto-dismisses after the configured duration

### Toast animation lifecycle

**When** a toast is triggered
**Then** it slides up and fades in over ~200ms, remains visible for the duration, then fades out over ~200ms before being removed from view

### Terminal execution no longer shows toast

**When** a user triggers a workflow action that opens a terminal (e.g., clicking Approve on a spec step)
**Then** no "Opening terminal…" toast appears; the terminal opens directly

### Multiple toasts

**When** a new toast is triggered while one is already visible
**Then** the previous toast is immediately replaced by the new one

## Out of Scope

- Toast variants (success, error, warning) — single neutral style for now
- Toast queue or stacking multiple toasts
- Click-to-dismiss behavior
- Toast actions (buttons inside the toast)
