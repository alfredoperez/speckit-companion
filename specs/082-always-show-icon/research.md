# Phase 0 — Research: Always Show SpecKit Icon

## Open questions identified from Technical Context

The spec had no `[NEEDS CLARIFICATION]` markers. The only research questions are mechanical: how does VS Code decide to render an activity-bar container, and what's the idiomatic way to show an "open a folder" empty state?

---

## Decision 1 — How to keep the activity-bar icon visible with no workspace

**Decision**: Relax the `when` clause on `speckit.views.explorer` so it no longer requires a workspace folder. Keep `speckit.views.steering` and `speckit.views.settings` as-is (they remain workspace-gated).

**Rationale**: VS Code shows an activity-bar container if **any** of its contributed views is currently eligible per its `when` clause. Today all three SpecKit views require `!(workbenchState == empty || workspaceFolderCount == 0)`, which is why the icon disappears when no folder is open. Removing that gate from a single view (`explorer`) is enough to keep the container visible without exposing the steering/settings trees in a state where they have nothing to show.

**Alternatives considered**:
- *Add a fourth always-visible "placeholder" view* — extra surface area, extra registration, and shows up later as a stray empty group when a workspace is open. Rejected.
- *Drop the `when` from all three views* — would render empty Steering and Settings trees with no useful content when no folder is open. Rejected.
- *Change `viewsContainers` somehow to force visibility* — VS Code does not expose container-level visibility control independent of view eligibility; this is the wrong layer. Rejected.

---

## Decision 2 — How to render the empty-state content

**Decision**: Add a `viewsWelcome` entry targeting `speckit.views.explorer` with `when: workbenchState == empty || workspaceFolderCount == 0`, containing a short explanation and a `[$(folder-opened) Open Folder](command:vscode.openFolder)` button.

**Rationale**: `viewsWelcome` is VS Code's built-in mechanism for "view body when there's nothing to show." It already powers the existing welcome states ("SpecKit CLI detected", "Configure your project principles", etc.). Reusing it keeps the voice and visual treatment consistent (FR-008) and means the empty state automatically swaps out the moment the `when` clause flips — satisfying SC-004 and FR-004 with zero custom code.

**Alternatives considered**:
- *Custom WebviewView for the empty state* — heavyweight; introduces a webview lifecycle for what is essentially one paragraph and one button. Rejected.
- *TreeDataProvider that returns a synthetic node* — clutters the tree with a fake item; doesn't render call-to-action buttons natively. Rejected.

---

## Decision 3 — How to wire the "Open Folder" action

**Decision**: Use the built-in `vscode.openFolder` command directly from the welcome-view markdown link. No extension-side command needed.

**Rationale**: `vscode.openFolder` is a stable VS Code API command that opens the platform folder picker and reloads the workbench with the selected folder. Linking to it directly avoids adding a custom `speckit.openFolder` shim that would do nothing but call through. The command is identical to what `File → Open Folder…` runs.

**Alternatives considered**:
- *`workbench.action.files.openFolder`* — older alias; `vscode.openFolder` is the documented one. Equivalent but less idiomatic. Rejected.
- *Custom wrapper command* — only worth it if we wanted telemetry or extra prompts; out of scope here. Rejected.

---

## Decision 4 — Coexistence with existing welcome views

**Decision**: Order the new welcome entry first (or scope it tightly with the empty-workspace `when`), and verify no existing entry's `when` clause overlaps. The current entries all require `speckit.detected` or `speckit.cliInstalled && !speckit.detected`, both of which are false when there's no workspace folder (`detector.ts:78-80` sets `speckit.detected = false` when no folder is present). So there is no overlap to resolve.

**Rationale**: FR-006 forbids the new empty state from suppressing the existing welcome flows. Because `speckit.detected` always flips false in the no-workspace case, the new entry's gate (`workbenchState == empty || workspaceFolderCount == 0`) cannot be true at the same time as the existing entries. Verified by reading `src/speckit/detector.ts:75-110`.

**Alternatives considered**:
- *Make the new entry mutually exclusive via explicit negation of every other `when`* — redundant given the natural disjointness above, and brittle if new welcome entries are added. Rejected.

---

## Decision 5 — Activation timing

**Decision**: Keep the existing `onStartupFinished` activation event. No change.

**Rationale**: The activity-bar container is contributed declaratively and renders before extension activation; we only need activation for setting context keys (`speckit.detected`, `speckit.cliInstalled`). The icon will appear at workbench paint time regardless of activation timing, which is what SC-001 requires (≤5s after startup). Confirmed by reading `package.json:40-43` (activation events) and `src/extension.ts:35-50` (activation flow).

**Alternatives considered**:
- *Add `onView:speckit.views.explorer`* — unnecessary; `onStartupFinished` already covers the case and adding more events delays nothing. Rejected.

---

## Findings summary

All resolutions are declarative or use existing APIs; no new dependencies, no new modules, no new context keys. The change surface is:

1. `package.json` — one `when` clause relaxed, one `viewsWelcome` entry added.
2. (Optional) `src/extension.ts` — confirm no regression in the no-workspace activation branch (`extension.ts:54-68` already guards manager initialization on `hasWorkspace`).

No `[NEEDS CLARIFICATION]` markers remain.
