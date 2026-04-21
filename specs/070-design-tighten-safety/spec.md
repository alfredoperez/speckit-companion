# Spec: Design Tighten & Safety

**Slug**: 070-design-tighten-safety | **Date**: 2026-04-20

## Summary

Unify the three webviews (spec-viewer, spec-editor, workflow-editor) under a single shared token system and collapse drifted visual patterns, then make destructive actions (Regenerate, Archive, Complete, Reactivate) recoverable. Ships as two sequential PRs: Bundle A (tighten — non-behavioral consolidation) and Bundle B (safety — confirm/undo, focus rings, reduced-motion). Tone stays the same; no redesign.

## Requirements

### Bundle A — Tighten

- **R001** (MUST): `webview/styles/tokens.css` is the single source of truth for all design tokens. `webview/styles/spec-viewer/_variables.css` is deleted, and every webview stylesheet (`index.css`, `workflow.css`, `spec-editor.css`) imports `tokens.css` instead of redeclaring tokens.
- **R002** (MUST): The duplicate token block in `workflow.css` (root vars + light/dark/high-contrast overrides, currently lines ~10–141) is removed. Only the `*` and `body` resets remain.
- **R003** (MUST): Step indicator renders at 16 px in all three webviews (currently 40 px in workflow editor, 16 px in spec-viewer).
- **R004** (MUST): Button border-radius is `var(--radius-sm)` (4 px) everywhere; the 8 px `radius-md` usages in `workflow.css` (lines ~957, ~1053) are removed.
- **R005** (MUST): Button padding is 6 px 14 px for secondary/enhancement buttons and 8 px 24 px for primary buttons across all three webviews.
- **R006** (MUST): `spec-editor.css` uses semantic tokens from `tokens.css` (`--bg-primary`, `--text-primary`, `--border`, `--accent`, etc.) wherever equivalents exist, instead of raw `var(--vscode-*)` references.
- **R007** (MUST): `StepTab` emits exactly one of four canonical states: `current` | `done` | `in-flight` | `locked`, plus an orthogonal `stale` badge. Class count per tab is ≤ 2 (canonical state + optional `stale`).
- **R008** (MUST): `StepTab` visual mapping: `current` = 1 px accent outline + accent-colored label; `done` = green check in circle + secondary label; `in-flight` = accent % pill + single `working-pulse` animation; `locked` = 0.4 opacity, `cursor: not-allowed`, not clickable.
- **R009** (MUST): Legacy CSS dropped — `_navigation.css` `reviewing` dashed-outline variant, `_animations.css` `.step-tab.pulse` rule, `@keyframes step-tab-pulse`, and `.step-tab.completed` duplicate border/shadow rules are all removed.
- **R010** (MUST): The spec-viewer navigation stack is at most 3 layers: `.compact-nav` + optional `.stale-banner` + `.spec-header`. The standalone `.related-bar` component no longer exists in the DOM; related tabs render in a right-aligned slot inside `.nav-primary`.
- **R011** (MUST): The "Overview" related tab is removed (parent step-tab already routes to overview).
- **R012** (MUST): `SpecHeader` renders as a single flex row — `[badge] [title] [branch]` — with the internal `<hr class="spec-header-separator" />` and the `spec-header-row-1` / `spec-header-row-3` wrapper divs deleted.
- **R013** (MUST): No `rgba(59, 130, 246` literals remain under `webview/styles/`. Each is replaced with `color-mix(in srgb, var(--accent) N%, transparent)` at the equivalent opacity.
- **R014** (MUST): Active-step halos collapse to `box-shadow: 0 0 0 2px var(--accent)` (no 3-layer shadows) in both `.step.active .step-indicator` and `.step.active.completed`.
- **R015** (MUST): The infinite `pulse-glow` animation on `.empty-state button` is removed; the `@keyframes pulse-glow` definition is deleted.
- **R016** (MUST): No emoji appear in UI chrome. `🌱` in workflow-editor's "SPEC COMPLETED" badge, `📄` on Load Template button, and `📎` on Attach Image button are each replaced with `<span class="codicon codicon-*"></span>`.
- **R017** (MUST): The spec-editor webview loads codicon CSS (bundled locally per R019). CSP `font-src` and `style-src` are updated accordingly.
- **R018** (MUST): Geist Variable font ships bundled at `webview/fonts/geist-vf.woff2`. The spec-viewer loads the font via `webview.asWebviewUri(...)`, not from `https://cdn.jsdelivr.net`. CSP `font-src` is `${webview.cspSource}` only.
- **R019** (MUST): `@vscode/codicons` ships bundled at `webview/codicons/` (both `codicon.css` and `codicon.ttf`). Spec-viewer and spec-editor load codicons via webview URIs.
- **R020** (MUST): `webpack.config.js` copies `webview/fonts/` and `webview/codicons/` into the `dist/webview/` output so the bundled assets ship in the `.vsix`.
- **R021** (MUST): Markdown horizontal rules (`<hr>` from `---`) render as a thin divider — `{ border: none; border-top: 1px solid var(--border); margin: var(--space-4) 0; }` — replacing the current `display: none`.
- **R022** (MUST): Mermaid diagrams in the workflow editor pick light/dark/high-contrast theme variables by reading `document.body.classList` (`vscode-light` / `vscode-dark` / `vscode-high-contrast`). A `MutationObserver` on `body` class re-initializes mermaid (debounced 200 ms) when the user switches VS Code themes.
- **R023** (MUST): The "Load Existing Spec" button on the Create New Spec page is renamed to "Load Template" (matching the downstream message type `requestTemplateDialog`).

### Bundle B — Safety

- **R024** (MUST): Clicking Regenerate queues the backend message behind a 5-second undo toast ("Regenerating in 5s… [Undo]"). Clicking Undo or pressing Esc within the window cancels the operation; otherwise the backend message fires when the timer elapses.
- **R025** (MUST): A new shared `UndoToast` component lives at `webview/src/shared/components/UndoToast.tsx`. It reuses `.action-toast` styling from `_footer.css`, adds a countdown progress indicator, and exposes an `[Undo]` button.
- **R026** (MUST): Archive, Complete, and Reactivate use an inline two-click confirm — first click swaps the button label to "Confirm?" for 3 seconds; second click within that window fires the action. The label reverts after 3 s with no action taken.
- **R027** (MUST): The thumbnail remove button (`.image-thumbnail .remove-btn`) is visible at rest with `opacity: 0.5`, rises to `opacity: 1` on hover, and also on `:focus-visible` so keyboard users can see and reach it.
- **R028** (MUST): `tokens.css` contains a global `@media (prefers-reduced-motion: reduce)` block that forces `animation-duration: 0.01ms`, `animation-iteration-count: 1`, and `transition-duration: 0.01ms` on all elements (via `*, *::before, *::after`).
- **R029** (MUST): The `.step-tab:focus-visible { outline: none; }` rule in `_navigation.css` is deleted so the global 2 px accent outline from `_base.css` applies. Similar `outline: none` declarations on focusable elements elsewhere in `webview/styles/` are removed unless replaced with an equivalent visible focus indicator.
- **R030** (SHOULD): The Regenerate button remains `disabled` during an active run (existing run-lock). The undo toast should not appear while another step is already running.

## Scenarios

### Shared Tokens Migration (Bundle A1)

**When** a developer opens the extension dev host after Bundle A1 lands
**Then** the spec-viewer, spec-editor, and workflow-editor all resolve design tokens from `tokens.css`; `_variables.css` does not exist; no token names are redeclared in `workflow.css` or `spec-editor.css`.

### Step Indicator Visual Parity (Bundle A1)

**When** a user opens the same spec in both the spec-viewer and the workflow editor
**Then** the step indicator circle measures 16 × 16 px in both webviews and has identical border radius, padding, and typography.

### StepTab Canonical States (Bundle A2)

**When** a spec is in any state (viewing, completed, in-progress, disabled, stale)
**Then** the corresponding `.step-tab` element carries exactly one of `current` / `done` / `in-flight` / `locked` class, optionally plus `stale`, and no legacy class (`viewing`, `reviewing`, `workflow`, `working`, `in-progress`, `tasks-active`, `pulse`, `completed`, `exists`, `disabled`) appears.

### Navigation Bar Merge (Bundle A3)

**When** a user opens a spec in the viewer
**Then** the DOM shows `.compact-nav` containing both step-tabs (left) and doc-tabs (right), optionally a `.stale-banner`, then a single-row `.spec-header`; no `.related-bar` element is present and no "Overview" related tab appears.

### Theme-Aware Mermaid (Bundle A4/A5)

**When** a user toggles VS Code between Dark+, Light+, and a high-contrast theme while a workflow diagram is open
**Then** the mermaid diagram re-renders with theme-appropriate colors within 200 ms; no hard-coded blue leaks through; the diagram remains readable in every theme.

### Offline Asset Loading (Bundle A5)

**When** the user opens a spec webview with no internet connection
**Then** Geist Variable font and codicons load from bundled webview URIs; no network request to `cdn.jsdelivr.net` appears in the webview devtools Network tab; CSP `font-src` contains only `${webview.cspSource}`.

### Regenerate Undo (Bundle B1)

**When** a user clicks Regenerate on an active spec
**Then** a toast appears reading "Regenerating in 5s… [Undo]" with a visible countdown, and no backend message is dispatched during the 5-second window.

### Regenerate Undo — Cancellation (Bundle B1)

**When** the user clicks Undo or presses Esc during the 5-second window
**Then** the queued Regenerate action is cancelled, no backend message fires, and the toast dismisses.

### Regenerate Undo — Elapse (Bundle B1)

**When** the 5-second countdown elapses without user cancellation
**Then** the backend `regenerate` message fires exactly once, the toast dismisses, and the spec regenerates normally.

### Two-Click Confirm (Bundle B1)

**When** a user clicks Archive (or Complete / Reactivate)
**Then** the button label changes to "Confirm?" for 3 seconds; a second click within that window fires the action; if 3 s elapse without a second click, the label reverts and no action is taken.

### Thumbnail Remove Button Visibility (Bundle B2)

**When** a user attaches an image in the spec-editor and tabs through focusable elements
**Then** the `×` remove button on the thumbnail is visible (opacity 0.5) at rest, fully opaque on hover, and fully opaque + keyboard-reachable on `:focus-visible`.

### Reduced Motion (Bundle B3)

**When** the user enables OS-level Reduce Motion and opens a spec with an in-flight step
**Then** no infinite animations play (the `working-pulse` on `in-flight` step-tabs stops); transitions complete effectively instantly (≤ 0.01 ms).

### Focus Ring Recovery (Bundle B4)

**When** the user tabs through every focusable element across all webviews
**Then** each focused element shows the global 2 px accent outline; no focusable element hides its focus indicator via `outline: none`.

## Non-Functional Requirements

- **NFR001** (MUST): `npm run compile` completes with no new TypeScript errors after each bundle merges.
- **NFR002** (MUST): `npm test` passes green after each bundle merges.
- **NFR003** (MUST): `npm run package` produces a `.vsix` that functions fully offline (no runtime CDN requests for fonts or codicons).
- **NFR004** (MUST): Heuristic score (re-run `/impeccable:critique` after Bundle A) moves from 19/40 into at least the high-20s, with Consistency, Aesthetic, and Recognition each improving by at least one full point.
- **NFR005** (MUST): After Bundle B, User Control & Freedom and Error Recovery each reach a score of 3.
- **NFR006** (SHOULD): `.vsix` size after Bundle A stays within an acceptable threshold (codicon.ttf adds ~60 KB; if size crosses a team-accepted limit, subset codicons to the glyphs actually used).
- **NFR007** (MUST): All buttons maintain ≥ 3:1 contrast against their backgrounds in Dark+, Light+, and high-contrast themes.

## Out of Scope

- Tonal redesign, new fonts, or new accent colors — Geist stays (local bundle only); the color system is unchanged.
- Any redesign of spec-viewer information architecture beyond the 4 → 3 navigation-bar merge.
- A keyboard-shortcut layer for step navigation (separate feature).
- Onboarding or help surfaces.
- Automated webview visual regression tests — verification remains manual via F5 into the extension dev host.
- Committing the `/install-local` version bump inside these feature PRs — version bumps ship separately.
- Bundle B changes to the `Reactivate` affordance remain as proposed (two-click) unless the open question below is resolved otherwise during Bundle B planning.
