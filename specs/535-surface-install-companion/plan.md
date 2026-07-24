# Implementation Plan: Surface "Install Companion" prominently

**Branch**: `535-surface-install-companion` | **Spec**: `spec.md`

## Technical Context

**Language**: TypeScript 5.3+ (ES2022, strict) | **Runtime**: VS Code Extension API (`@types/vscode ^1.84.0`), Preact webview.
**Storage**: file-based — install signal is `.specify/extensions/companion/` on disk, mirrored into the `speckit.companion.installed` context key.
**Testing**: Jest + `ts-jest`, VS Code mock at `tests/__mocks__/vscode.ts`.

## Approach

Reuse every existing hook — the `speckit.companion.installed` context key (`extension.ts`), the `speckit.companion.installSpecKitExtension` command, and the `#506` `companion.installPrompt` telemetry funnel. No new plumbing for install itself.

### Surface 1 — Create Spec picker (`specEditorProvider.ts`)
- `getWorkflows()` always pushes the Companion `WorkflowDefinition`, with a new `installed: boolean` flag; when not installed the description carries an "Install to enable" hint.
- `handleSubmit`, when Companion is picked and not installed (non-auto, non-custom), shows a benefits modal via `showInformationMessage` (extension-side, testable) offering "Install SpecKit Companion" / "Use SpecKit instead" / dismiss. Install fires `installPrompt clicked(createSpec)` + runs the install command, then proceeds; "Use SpecKit instead" proceeds via the existing graceful downgrade; dismiss aborts.

### Surface 2 — Activity-bar badge (`extension.ts`)
- After creating `specsTreeView`, set `specsTreeView.badge` from the install signal; recompute in the existing `.specify/extensions/companion/**` watcher `refresh` closure so it flips without a reload. Fire `installPrompt shown(sidebarBadge)` when set.

### Surface 3 — Pinned CTA row (`specExplorerProvider.ts`)
- When not installed and specs exist, prepend a `companion-install-cta` `SpecItem` with `ThemeIcon('rocket', ThemeColor('charts.yellow'))` whose command runs the surface-tagged install nudge (`pinnedRow`). Fire `installPrompt shown(pinnedRow)` on build.

### Surface 4 — Empty-state welcome button (`package.json` `viewsWelcome`)
- New `viewsWelcome` block on `speckit.views.explorer`, gated `speckit.detected && !speckit.companion.installed && !speckit.companion.installNudgeDismissed`, linking to the surface-tagged install nudge (`welcome`) plus a Dismiss link.
- New context key `speckit.companion.installNudgeDismissed` mirrored from a new `installNudgeDismissed` globalState value at activation and on dismiss.

### Surface 5 — Retire the Steering badge (`steeringExplorerProvider.ts`)
- `buildCompanionHeaderNode()` returns `undefined` when not installed, removing the buried "Not installed" warning node.

### Shared plumbing
- New command `speckit.companion.installNudge` — accepts an optional surface arg, coerces it against the known-surface allow-list, fires `installPrompt clicked(surface)`, then executes `speckit.companion.installSpecKitExtension`.
- New command `speckit.companion.dismissInstallNudge` — sets the dismiss globalState + context key and refreshes the Specs view.
- Extend `InstallPromptSurface` to `'createSpec' | 'activity' | 'sidebarBadge' | 'pinnedRow' | 'welcome'`.

## Constitution / conventions
- Design token: CTA uses `charts.yellow`, never `--text-muted`/`--text-secondary`.
- Guard the command family by prefix, never an enumerated subset.
- Coerce the telemetry `surface` value at the emit boundary (enum-by-type ≠ enum-by-data).
- Single-line inline comments only.
- Docs updated in the same change: README (Sidebar at a Glance), `docs/sidebar.md`, root `CHANGELOG.md` Unreleased.

## Testing strategy
- `specEditorProvider`: Companion offered when not installed; the install-first branch fires on a not-installed pick.
- `specExplorerProvider`: pinned CTA row present only when not installed.
- Telemetry: `installNudge` fires clicked per surface with coercion of unknown surfaces.
- Dismiss: `dismissInstallNudge` persists globalState + sets the context key.
- Steering: header node absent when not installed.
- Manifest lock: new commands + viewsWelcome block registered.
