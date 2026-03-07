# Spec: Reduce Noisy Notifications

**Branch**: 017-reduce-popups | **Date**: 2026-03-06

## Summary

The extension currently shows ~50 notification popups across 20 files. Most are appropriate, but several fire on frequent low-stakes actions and interrupt the user's flow unnecessarily. This spec audits all notifications and replaces noisy ones with status bar messages or inline feedback.

## Findings

### Notification inventory (~50 calls across 20 files)

| Category | Count | Assessment |
|----------|-------|------------|
| `showErrorMessage` | ~22 | Mostly keep — genuine failures |
| `showInformationMessage` | ~18 | 4-5 are noisy |
| `showWarningMessage` | ~8 | Keep — all require user confirmation |
| `showQuickPick` | ~4 | Keep — intentional user input |
| `showInputBox` | ~2 | Keep — intentional user input |

### Identified noisy notifications

| Location | Message | Problem |
|----------|---------|---------|
| `messageHandlers.ts:257` | `"Refining line N..."` | Fires on every inline refine click — high frequency |
| `copilotCliProvider.ts:90` | `"Install command copied to clipboard"` | Transient success, not an error |
| `codexCliProvider.ts:115` | `"Install command copied to clipboard"` | Same — 4 provider files repeat this |
| `geminiCliProvider.ts:90` | `"Install command copied to clipboard"` | Same |
| `qwenCliProvider.ts:97` | `"Install command copied to clipboard"` | Same |
| `specCommands.ts:278` | `"No custom commands configured..."` | Informational, could be inline |

### Notifications to keep (do not change)

- All `showErrorMessage` calls (legitimate failure states)
- All `showWarningMessage` with action buttons (destructive confirmation)
- All `showQuickPick` / `showInputBox` (intentional user flows)
- `updateChecker.ts:94` (once per 24h, user-relevant)
- `extension.ts:189` (first-run onboarding)
- `notificationUtils.ts` `showPhaseCompleteNotification` (milestone event with action)

## Requirements

- **R001** (MUST): Replace `"Refining line N..."` info popup in `messageHandlers.ts:257` with a status bar message using the existing `StatusBarItem` or `withProgress` in the notification area
- **R002** (MUST): Replace the 4 "Install command copied to clipboard" info popups across AI provider files with a shared status bar message helper
- **R003** (MUST): Replace `"No custom commands configured..."` in `specCommands.ts:278` with an inline empty-state message in the quick pick itself (use `placeHolder` text)
- **R004** (SHOULD): Ensure all transient success messages use auto-dismiss via the existing `NotificationUtils.showAutoDismissNotification` rather than persistent popups
- **R005** (SHOULD): Add a shared `showStatusBarMessage(text, timeout)` helper to `notificationUtils.ts` to avoid duplicating `vscode.window.setStatusBarMessage` calls

## Scenarios

### Inline refinement no longer shows popup

**When** the user clicks the inline refine button on a spec line
**Then** a status bar message shows `"Refining line N..."` briefly instead of a modal notification

### Copying install command shows transient status bar feedback

**When** the user copies an AI provider install command
**Then** the status bar shows `"Install command copied to clipboard"` for 3 seconds instead of a popup

### No custom commands shows inline empty state

**When** the user triggers custom commands and none are configured
**Then** the quick pick shows an empty state with a descriptive placeholder instead of dismissing with an error popup

## Out of Scope

- Changing any `showErrorMessage` calls (errors should remain visible)
- Changing any `showWarningMessage` confirmation dialogs
- Redesigning the notification system architecture
- Adding new notification preferences/settings
