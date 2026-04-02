# Plan: Spec Sorting & Lifecycle Buttons

| Field    | Value                  |
|----------|------------------------|
| Spec     | 032-spec-sorting-lifecycle |
| Created  | 2026-04-02             |

## Approach

Add creation-date sorting to the sidebar's active specs group and add Complete/Archive lifecycle buttons to the spec viewer footer bar alongside the existing Edit Source and Regenerate buttons. Both features reuse the existing `setSpecStatus()` infrastructure and require coordinating state refresh between the webview and the sidebar tree provider.

## Files to Change

### Modify

| File | Change |
|------|--------|
| `src/features/specs/specExplorerProvider.ts` | Sort `activeSpecs` array by directory `birthtime` (newest first) before building tree items. Read `fs.statSync(specFullPath).birthtime` for each active spec in the partition loop. |
| `src/features/spec-viewer/types.ts` | Add `completeSpec` and `archiveSpec` message types to `ViewerToExtensionMessage`. Add `specStatus` field to `FooterState` and `NavState` so the webview knows whether to show lifecycle buttons. |
| `src/features/spec-viewer/html/generator.ts` | Render "Complete" and "Archive" buttons in `<footer class="actions"> .actions-right` next to Edit Source. Conditionally show based on `specStatus`: active shows both, completed shows only Archive, archived shows neither (already shows archived badge). |
| `src/features/spec-viewer/messageHandlers.ts` | Handle `completeSpec` and `archiveSpec` messages. Import `setSpecStatus` from `specContextManager`, call it with the spec directory, then fire `vscode.commands.executeCommand('speckit.refresh')` and call `updateContent()` to refresh the webview. |
| `webview/src/spec-viewer/actions.ts` | Add click handlers for `#completeSpec` and `#archiveSpec` buttons that post `completeSpec` / `archiveSpec` messages to the extension. |
| `webview/src/spec-viewer/elements.ts` | Add `completeSpecButton` and `archiveSpecButton` element references. |
| `webview/src/spec-viewer/navigation.ts` | In `updateNavState()`, toggle visibility of Complete/Archive buttons based on `navState.footerState.specStatus`. |
| `src/features/spec-viewer/specViewerProvider.ts` | Pass `specStatus` through to `NavState` in `sendContentUpdateMessage()` so message-based tab switches also get the lifecycle button state. |

## Flow

```
User clicks "Complete" in viewer footer
  → webview posts { type: 'completeSpec' }
  → messageHandlers.ts receives it
  → calls setSpecStatus(specDir, 'completed')
  → calls vscode.commands.executeCommand('speckit.refresh') to update sidebar
  → calls updateContent() to re-render webview with new status
  → footer now shows "Archive" only (Complete hidden)
  → sidebar moves spec from Active to Completed group
```

## Risks

- **birthtime availability**: On some Linux filesystems `birthtime` may be 0 or equal to `ctime`. Falls back gracefully — specs just won't be sorted by true creation date. Acceptable since macOS (primary platform) supports `birthtime` well.
- **Refresh coordination**: The message handler needs to trigger the sidebar refresh. Using `vscode.commands.executeCommand('speckit.refresh')` avoids direct coupling to the SpecExplorerProvider instance.
