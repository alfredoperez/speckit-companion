# Phase 0 Research: Reveal Spec Folder in OS File Browser

**Feature**: 069-reveal-spec-folder
**Date**: 2026-04-20

## Unknowns extracted from Technical Context

None. Every field in the plan's Technical Context resolves to a concrete value
from existing project conventions (CLAUDE.md, constitution, existing specs
feature code). No `NEEDS CLARIFICATION` markers.

## Research Items

### R1 — Cross-platform "reveal folder in OS" primitive

**Decision**: Use VS Code's built-in command `revealFileInOS`.

**Rationale**:
- Ships with VS Code core on all three OSes — no native dependency, no child
  process, no platform branching in our code.
- Accepts a `vscode.Uri` argument; opens Finder on macOS, Explorer on Windows,
  the default file manager on Linux.
- Handles folder targets as well as file targets (a directory URI causes the
  folder itself to be opened/focused).
- Matches the default VS Code UX users already know from the File Explorer
  ("Reveal in Finder" / "Reveal in File Explorer" / "Open Containing Folder").

**Alternatives considered**:
- **`child_process.exec` with `open` / `explorer` / `xdg-open`**: Requires
  per-platform branching, pulls in shell-escaping concerns, and duplicates what
  `revealFileInOS` already does. Rejected.
- **`vscode.env.openExternal(Uri.file(...))`**: Opens the URI in the system
  handler — for folders this behavior is inconsistent across OSes (on macOS it
  may open in Finder, on Linux it may open a terminal or nothing). Rejected —
  `revealFileInOS` is the purpose-built primitive.
- **`workbench.action.files.revealActiveFileInWindows`**: VS Code-internal
  workbench command scoped to the active editor — not usable for an arbitrary
  tree item. Rejected.

### R2 — Command title per platform

**Decision**: Use a single static title, "Reveal in File Explorer".

**Rationale**:
- VS Code itself uses platform-specific titles for its own "Reveal in ..."
  entry, but those are implemented via localization, not runtime branching.
- Our `package.json` command contribution is static; adding `osx`/`linux`/
  `windows` key overrides is possible but adds surface area for a cosmetic
  difference.
- "Reveal in File Explorer" is the Windows phrasing and is understandable on
  all platforms; it matches what several popular VS Code extensions do.

**Alternatives considered**:
- **Per-OS title overrides via `osx` / `linux` / `windows` in `contributes.commands`**:
  Possible (`osx: "Reveal in Finder"`, etc.) and more polished. Kept as a
  future improvement — not required by the spec's Acceptance Scenarios, which
  only assert that the correct OS tool opens, not what the menu label says.

### R3 — Error handling for missing / inaccessible folders (FR-005, SC-004)

**Decision**: Stat the resolved absolute path before delegating. If the folder
does not exist, show `vscode.window.showErrorMessage(...)` with the path and
abort. For permission or other I/O errors from the reveal itself, wrap the
`executeCommand` call in a try/catch and surface `err.message`.

**Rationale**:
- `revealFileInOS` on a nonexistent path can silently no-op on some Linux
  desktops — a pre-stat gives us a deterministic, user-visible failure path
  (meets SC-004: error within 1s, no silent failures).
- Matches the defensive style already used in `speckit.delete` and
  `speckit.openSpecSource` in `specCommands.ts`.

**Alternatives considered**:
- **Rely solely on `revealFileInOS` errors**: Rejected — Linux silent-no-op
  edge case would violate SC-004.
- **Refresh the tree on failure to auto-heal**: Out of scope; a missing
  folder is rare and best surfaced to the user rather than hidden.

### R4 — Selecting the correct `viewItem` gate

**Decision**: `view == speckit.views.explorer && viewItem == spec`.

**Rationale**:
- `SpecExplorerProvider` already sets `contextValue = 'spec'` on spec nodes
  (seen via existing menu gates in `package.json` for `speckit.delete`,
  `speckit.archive`, etc., all using the same `viewItem == spec` condition).
- Sub-documents use `viewItem =~ /spec-document-/` and are correctly excluded
  by the strict `== spec` match.
- Steering docs live on a different view (`speckit.views.steering`) and are
  excluded by the `view ==` part of the gate.
- Satisfies FR-004 and SC-003 (100% of spec items show the action, 0% of
  non-spec items do).

**Alternatives considered**: none — this is the established pattern in the
codebase.

### R5 — Accepting an argument from a single-click vs. multi-select

**Decision**: Accept only the single `SpecTreeItem` passed by VS Code as the
first argument; do not support multi-select reveal.

**Rationale**:
- Revealing many folders simultaneously spawns multiple OS file-browser
  windows — noisy and rarely intended.
- The spec's Acceptance Scenarios and SC-001 describe a single right-click →
  single reveal interaction.
- Existing bulk commands (`markCompleted`, `archive`, `reactivate`) accept a
  second `items?: SpecTreeItem[]` argument; reveal intentionally does not.

**Alternatives considered**: Multi-reveal via `items?: SpecTreeItem[]` —
rejected as out of scope and likely annoying.

## Outcome

All open questions resolved. Ready for Phase 1 design.
