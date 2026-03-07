# Plan: Reduce Noisy Notifications

**Spec**: [spec.md](./spec.md) | **Date**: 2026-03-06

## Approach

Replace 6 noisy `showInformationMessage` calls with `vscode.window.setStatusBarMessage` (auto-dismisses, no modal). Add a single `showStatusBarMessage` helper to `NotificationUtils` so all 5 "copied to clipboard" + "Refining..." calls share one implementation. The `specCommands.ts` case is handled by removing the popup entirely and letting the quick pick open with an empty items array and a descriptive placeholder.

## Files

### Modify

| File | Change |
|------|--------|
| `src/core/utils/notificationUtils.ts` | Add `static showStatusBarMessage(text: string, timeoutMs = 3000)` wrapping `vscode.window.setStatusBarMessage` |
| `src/features/spec-viewer/messageHandlers.ts:257` | Replace `showInformationMessage("Refining line N...")` with `NotificationUtils.showStatusBarMessage(...)` |
| `src/ai-providers/copilotCliProvider.ts:90` | Replace `showInformationMessage("Install command copied...")` with `NotificationUtils.showStatusBarMessage(...)` |
| `src/ai-providers/codexCliProvider.ts:115` | Same as above |
| `src/ai-providers/geminiCliProvider.ts:90` | Same as above |
| `src/ai-providers/qwenCliProvider.ts:97` | Same as above |
| `src/features/specs/specCommands.ts:277-280` | Remove the info popup + early return; instead open the quick pick with `placeHolder: "No custom commands configured — add speckit.customCommands in settings"` and an empty items array |
