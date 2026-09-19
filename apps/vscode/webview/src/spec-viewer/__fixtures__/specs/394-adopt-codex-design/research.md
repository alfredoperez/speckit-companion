# Research: Adopt the Codex Redesign in the Spec Viewer

**Feature**: 394-adopt-codex-design · **Date**: 2026-07-13

## Decision 1: Adopt the palette through the existing token layer, not a parallel one

**Decision**: Fold the Codex `--cx-*` roles into `webview/styles/tokens.css` by re-valuing the existing token names the partials already consume (`--bg-*`, `--text-*`, `--accent*`, status, `--code-*`), adding new role tokens only where the current set has no equivalent (e.g. `--surface-3`, `--accent-soft` distinctions). The light palette lands in the existing `body.vscode-light` override block; `codex.css` itself is a story-side reference, never imported by the shipped viewer.

**Rationale**: Every CSS partial and component already reads the current token names — re-valuing them restyles the whole viewer coherently without a big-bang rename, and the Codex rationale explicitly frames migration as mapping existing roles onto `--cx-*`. Keeping one token file preserves the constitution's modular-CSS structure and the single source of truth.

**Alternatives considered**: Shipping `codex.css` alongside and porting components onto `.cx-*` classes one by one — rejected: two competing token systems in production during migration guarantees drift and doubled QA; the class-rename churn adds risk with no user value.

## Decision 2: Shell recomposition maps 1:1 onto existing components

**Decision**: Restructure `App.tsx` into the Codex shell regions and keep each region owned by the existing component: `SpecHeader` renders the shell top (title, subtitle, status badge, Overview/Documents view switch); `NavigationBar` becomes the document rail (grouped Pipeline/Artifacts, workflow-map rendering for custom steps); `FooterActions` becomes the shell footer (context line, "Other actions" menu, primary CTA); a small new `RunAside` component renders the contextual run-facts column from `viewerState`. The signals and message handlers are untouched.

**Rationale**: The components already own exactly the right state seams (`navState` for documents/steps, `viewerState` for status/footer, `getApproveLabel()` for the CTA label, `enhancementButtons` for extra commands) — the redesign changes their markup and CSS, not their inputs, which is what keeps FR-015 (protocol unchanged) and FR-009 (state machine intact) safe.

**Alternatives considered**: A fresh shell component tree replacing NavigationBar/SpecHeader/FooterActions — rejected: it would duplicate state derivation currently covered by component tests and the documented state matrix, multiplying regression surface for zero design gain.

## Decision 3: Overview replaces the Activity toggle as a view, defaulting by data presence

**Decision**: Replace the boolean Activity toggle with a two-value view state (`overview | document`) surfaced by the header view switch. Default to `overview` when the spec has recorded activity (`hasAnyData`), and to the current document when it does not. Living-specs mode keeps its existing behavior (no stepper, no footer, tiers as tabs) and never defaults to Overview. The `ActivityPanel` content is rearranged per the Codex Activity story (progress hero, metrics, feed, progressive-disclosure approach) but keeps its cards and error boundary.

**Rationale**: The panel is already a peer region toggled by a signal, so this is a default-state and presentation change, matching the spec's FR-005 while guaranteeing the no-activity fallback and the living-mode edge case.

**Alternatives considered**: Keeping the toggle and merely restyling it — rejected: it preserves the design's biggest complaint (the run's story hidden behind a utility toggle) and fails the accepted proposal.

## Decision 4: Code stays highlight.js-highlighted, on an owned always-dark surface

**Decision**: Keep the existing highlight.js `github-dark` stylesheet and render code blocks on the Codex `--cx-code` owned dark surface in **both** themes, with the language chip and surrounding chrome from the data-display skin.

**Rationale**: This is the Codex proposal's own resolution of the light-theme code bug: dark tokens on a guaranteed-dark surface are readable in every theme, with zero changes to the highlighting pipeline or CDN assets.

**Alternatives considered**: Per-theme syntax palettes overriding hljs classes — rejected for this adoption: more moving parts than the accepted design needs; can be revisited independently later.

## Decision 5: Typography inherits the host editor

**Decision**: Lead `--font-family` with the host's `--vscode-font-family` (and `--vscode-editor-font-family` for mono), dropping the bundled Geist lead; remove the Geist `@font-face` injection from the HTML generator once nothing resolves to it.

**Rationale**: The accepted hybrid explicitly inherits host typography and accessibility so documents feel native to the editor; it also removes a bundled asset and one generator special case.

**Alternatives considered**: Keeping Geist as the lead with host fallback — rejected: contradicts the accepted proposal's core theme stance.

## Decision 6: Radius and geometry follow the Codex system

**Decision**: Move the shared radius tokens from the forced 2px "terminal" value to the Codex 6px, and adopt its geometry (pill badges, 36px min-height buttons, 20px cards, 4/8px rhythm). Update `docs/DESIGN.md` (and the tokens.css comment) which currently document the 2px direction.

**Rationale**: The user-selected design supersedes the earlier squared-corner exploration; leaving the old documented direction in place would make the docs lie about the shipped look.

**Alternatives considered**: Keeping 2px under the new palette — rejected: the Codex components are designed around the softer geometry; mixing produces neither design.

## Decision 7: Inline comments keep their machinery; the queue becomes visible

**Decision**: Keep the entire existing inline-comment path (line hover "+", composer, anchored threads, persisted `reviewComments`, `pendingRefinements`) and restyle it to the Codex treatment, surfacing the pending set as the "refinement queue" presentation from the InlineComments story (queue summary + per-thread cards), with the existing Refine submission flow unchanged.

**Rationale**: The comment UX is an explicitly protected capability (a prior product decision) and the Codex story is designed *around* the persisted-comments path — presentation-only adoption keeps FR-013 honest.

**Alternatives considered**: None seriously — replacing the comment system is out of scope by definition.

## Decision 8: Storybook reconciliation is part of the work, not cleanup

**Decision**: Update every visually-changed component's stories in the same tasks that change the component (NavigationBar, SpecHeader, FooterActions, StepTab, ActivityPanel + cards, Transitions, Full Viewer), keep `__redesign__/codex/` untouched as the reference during adoption, and end with a reconciliation task that retires duplicated codex stories in favor of the updated real-component stories.

**Rationale**: Stories are the repo's visual baseline (stale stories are documented as worse than none); the codex stories remain the acceptance reference until the shipped components match them.

**Alternatives considered**: Deleting `__redesign__/codex/` up front — rejected: it is the only pixel-accurate statement of the accepted design while adoption is in flight.
