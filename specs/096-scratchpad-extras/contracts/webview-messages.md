# Contract: Spec-Viewer Message Protocol Changes

**Feature**: 096-scratchpad-extras
**Date**: 2026-05-20

The spec viewer is a WebviewPanel that communicates with the extension via
`postMessage`. This contract defines the protocol delta for scratchpads. Message
unions live in `webview/src/spec-viewer/types.ts` (`ViewerToExtensionMessage`,
`ExtensionToViewerMessage`) and the extension-side mirror in
`src/features/spec-viewer/types.ts`; routing is in
`src/features/spec-viewer/messageHandlers.ts`.

---

## Added — Webview → Extension

### `createScratchpad`

Sent from the empty-state create action (FR-006, FR-007).

```ts
{ type: 'createScratchpad'; documentType: DocumentType }
```

- `documentType`: the scratchpad doc type to create (`'spec-extra' | 'plan-extra' | 'tasks-extra'`).

**Handler behavior** (`handleCreateScratchpad`):
1. Resolve the spec-viewer instance for the spec directory.
2. Map the scratchpad doc type → file name (`<sourceType>-extra.md`) and absolute
   path in the spec directory.
3. If the file does not already exist, create it **empty** via
   `vscode.workspace.fs.writeFile(uri, new Uint8Array())`.
4. Re-scan documents and switch the active document to the new scratchpad
   (content update), so the view lands on the freshly created file.

**Errors**: on write failure, log to the output channel and post an
`actionToast` describing the failure; do not crash the panel.

### `applyScratchpad`

Sent from the repurposed Refine button, visible only on a scratchpad tab
(FR-009, FR-010, FR-011, FR-012).

```ts
{ type: 'applyScratchpad'; documentType: DocumentType }
```

- `documentType`: the active scratchpad doc type.

**Handler behavior** (`handleApplyScratchpad`):
1. Resolve the instance and the active scratchpad `SpecDocument`
   (must be `isScratchpad`); resolve `scratchpadFor` → source file
   `<sourceType>.md` under `changeRoot || specDirectory`.
2. Read the scratchpad file contents.
3. **Empty guard (FR-012)**: if contents are empty/whitespace, do **not**
   dispatch; post `actionToast` "Nothing to apply — scratchpad is empty" and
   return.
4. Otherwise build a direct-edit prompt (reusing the `handleSubmitRefinements`
   shape, `messageHandlers.ts:594-602`) and dispatch via
   `deps.executeInTerminal(prompt)`.

**Prompt shape** (built in extension code — the sanctioned prompt surface):

```
Apply the refinement notes below to <targetPath>/<sourceType>.md.
Edit that file in place.
DO NOT regenerate from any template.
DO NOT run any setup script (e.g. setup-spec.sh, setup-plan.sh, setup-tasks.sh).
DO NOT replace the file — make targeted edits only.
Treat the notes as instructions/questions/concerns about the document; apply the
substantive changes they call for. Do not modify the scratchpad file itself.

Refinement notes (from <sourceType>-extra.md):
---
<full scratchpad contents>
---
```

**Invariant**: never dispatch a `/speckit-*` slash command for apply — those
re-run setup scripts that overwrite the source from a template (issue #153 /
spec 093). 100% of applies must be direct edits (SC-003).

---

## Added — Extension → Webview

### `actionToast` (existing message, new usages)

Already defined: `{ type: 'actionToast'; message: string }`. Reused for:
- The apply empty guard ("Nothing to apply — scratchpad is empty").
- Create/apply failure messages.

No new extension→webview message type is required.

---

## Changed — `SpecDocument` payload

`SpecDocument` (carried inside `NavState.relatedDocs` on `contentUpdated` /
`navStateUpdated`) gains optional `isScratchpad`, `scratchpadFor`, and
`hasContent` (P2). Backward compatible — older payloads simply omit them.

---

## Removed — Webview → Extension (FR-015 / SC-005)

These messages and their handlers are deleted with the inline-comment system:

| Message | Reason |
|---------|--------|
| `submitRefinements` | Batch comment submit — replaced by `applyScratchpad` |
| `refineLine` | Per-line refine (was unimplemented/TODO) |
| `editLine` | Inline-editor context action (line-action menu removed) |
| `removeLine` | Inline-editor context action (line-action menu removed) |

**Retain `toggleCheckbox`** unless implementation proves it is reachable only via
the removed line-action menu. Default: keep (task-checkbox toggling is an
independent feature).

Associated types `Refinement` and `LineType` are removed once no longer
referenced.

---

## Acceptance checks for this contract

- C1: Clicking create on an absent scratchpad creates an empty file and the view
  switches to it (FR-007).
- C2: Clicking Refine on a non-empty scratchpad dispatches exactly one
  direct-edit instruction targeting the matching `<source>.md`, with no slash
  command and no setup-script invocation (FR-010, FR-011, SC-003).
- C3: Clicking Refine on an empty scratchpad dispatches nothing and shows the
  "nothing to apply" toast (FR-012).
- C4: The Refine control is absent from the message flow while a source-document
  tab is active (FR-009, SC-004).
- C5: No removed message type is reachable from the rendered viewer (SC-005).
