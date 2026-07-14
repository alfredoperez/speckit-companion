# Phase 0 Research: Open a spec from its name in the Specs tree

## Decision — a spec-level command that takes the spec directory, not a file

**Decision**: Add `speckit.openSpec`, taking the spec's directory, and route it to a new `SpecViewerProvider.showSpec(specDirectory)`.

**Rationale**: `speckit.viewSpecDocument` takes a *file* and cannot express "open this spec, whatever it should land on". Passing it a synthetic path to a document that may not exist would work by accident (the viewer's fallback cascade would rescue it), but it encodes a lie in the tree. A directory-taking entry point says what it means and keeps the viewer as the only thing that resolves documents. The existing command keeps its exact signature, so document rows are untouched.

**Alternatives considered**: Reusing `viewSpecDocument` with a resolved anchor file — rejected because resolving the anchor in the tree would be a second copy of the "first available document" rule. Adding an explicit `view: 'overview'` argument — rejected because it would make the tree assert a landing the spec may not have (a spec with no run has no Overview), which is exactly the duplicated derivation the issue calls out.

## Decision — reuse the existing landing rule; add no new signal, message, or flag

**Decision**: `showSpec` renders the panel through the same `updateContent` path every other extension-driven open uses, and lets the webview decide the landing view.

**Rationale**: `updateContent` reassigns `panel.webview.html`, which reloads the webview. The reload resets `viewerMode` to unset, and `showingOverview` then falls back to `hasDurableContext(...)` — Overview when the spec has one, document when it does not. So the correct landing is already the guaranteed outcome of an extension-side open; adding a "show the Overview" message would introduce a second authority over the same fact and could contradict the webview when the spec has no Overview. In-webview navigation is unaffected: a document pick from the rail goes through `sendContentUpdateMessage`, which posts rather than reloads, and so keeps the reader on their document.

**Alternatives considered**: A `resetView` / `showOverview` message the extension posts on a spec-level open — rejected as a duplicate authority (and unnecessary, since the reload already resets the shell state).

## Decision — the name click both opens the viewer and toggles the row

**Decision**: Keep the row collapsible. The click on the name opens the spec *and* toggles expansion; the chevron remains a toggle-only affordance.

**Rationale**: The tree API fires a row's `command` and toggles its expansion on the same click, and the two cannot be separated without removing the row's children — which would cost the sidebar its document rows, its main navigation. The editor's own Testing view sets the same precedent: a suite row with children and a file both opens and expands on click. Opening the Overview *is* the answer to "what is this spec", which is the same question a browsing user is asking when they expand it, so the two actions agree rather than fight. And the chevron stays as the cheap browse-without-opening path for the case where they disagree.

**Alternatives considered**: Making the spec row non-collapsible so the click only opens — rejected: the documents would become unreachable from the tree. Leaving the row inert and adding an "Open Spec" context-menu item only — rejected: it leaves the most obvious click target doing nothing, which is the issue.

## Decision — an already-open panel is revealed on its current document, and re-rendered

**Decision**: When a panel already exists for the spec, `showSpec` re-renders it (on whatever document it was showing) and reveals it, rather than forcing a document choice.

**Rationale**: The re-render is what returns the panel to the Overview, so the click behaves identically whether or not the panel was already open. Keeping the underlying document as-is means the reader's last document stays behind the Overview — and stays visible for a spec that has no Overview at all.
