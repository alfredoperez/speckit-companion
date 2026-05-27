# Implementation Plan: Footer "Generating…" as status, "Mark step complete" as secondary

**Branch**: `115-footer-generating-status` | **Date**: 2026-05-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/115-footer-generating-status/spec.md`

## Summary

While a pipeline step is in flight, the spec viewer footer currently renders two button-shaped affordances side by side on the right — a disabled primary-styled "Generating <Step>…" button and a secondary "Mark step complete" button. Demote the override and remove button shape from the live indicator:

- Render "Generating <Step>…" as a non-clickable status chip (pill + spinner + label) on the **right**, reusing the existing `.activity-status-pill` visual idiom rather than the primary-button shell.
- Move "Mark step complete" to the **left** region of the footer and style it visibly lighter than a primary button (existing `secondary` Button variant is already ghost/outline — that's the target).
- Apply uniformly to all four pipeline steps (specify, plan, tasks, implement). No behavior change to the manual-override click handler.
- Post-completion / approve / inline-comment footer modes are unchanged.

The change is local to one early-return branch in `webview/src/spec-viewer/components/FooterActions.tsx` plus one CSS class for the chip.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022, strict mode)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), Preact (webview)
**Storage**: N/A (rendering-only change — no persisted state)
**Testing**: Jest + ts-jest (extension); Storybook for footer visual states (`FooterActions.stories.tsx`)
**Target Platform**: VS Code webview (browser context, Preact runtime)
**Project Type**: VS Code extension with webview UI (single project)
**Performance Goals**: N/A — purely visual; no new state, no new render path
**Constraints**: Must not regress click handler for "Mark step complete"; must not affect any non-in-flight footer mode (approve, inline-comment, post-completion)
**Scale/Scope**: 1 component branch (`isGenerating && runningStep` early-return in `FooterActions.tsx`), 1 new CSS class, 4 new Storybook stories (one per step) updated to reflect the new layout

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Extensibility and Configuration** — PASS. Footer state machine already discriminates modes (generating / post-completion / approve / inline-comment). This change refines the visual rendering of one existing mode; no new configuration surface required.
- **II. Spec-Driven Workflow** — PASS. The change applies uniformly to all four canonical pipeline steps (specify → plan → tasks → implement). It does not weaken or fragment the pipeline; it improves the visual cue for "step is running."
- **III. Visual and Interactive** — PASS. The whole point of the change is to honor visual hierarchy: one live action, one quiet fallback. Reuses the existing `activity-status-pill` idiom rather than introducing a new pattern.
- **IV. Modular Architecture for Complex Features** — PASS. Confined to the existing modular footer component (`FooterActions.tsx`) and CSS partial (`_footer.css`); no new modules, no cross-cutting refactor.

No violations. No entries in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/115-footer-generating-status/
├── plan.md              # This file
├── spec.md              # Already authored
└── checklists/          # (existing, untouched by this plan)
```

No `research.md`, `data-model.md`, `contracts/`, or `quickstart.md` are
generated for this feature. Rationale:

- **No NEEDS CLARIFICATION** in Technical Context — every choice is grounded
  in code that already exists (`activity-status-pill`, `secondary` Button
  variant, `actions-left` / `actions-right` regions).
- **No entities** — this is rendering-only; no new persisted shape, no new
  message type, no new viewer state field.
- **No external contracts** — the manual-override click handler
  (`postMessage({ type: 'markStepComplete' })`) is preserved verbatim. No
  new webview ↔ extension messages are added.
- **No quickstart** — the visual change is exercised via existing Storybook
  stories (`GeneratingPlan`, `GeneratingTasks`, etc.) and by triggering any
  `/speckit.*` command from the viewer in the Extension Development Host.

### Source Code (repository root)

Files this feature touches:

```text
webview/src/spec-viewer/components/
└── FooterActions.tsx                  # The `if (isGenerating && runningStep)` branch (lines ~94–115)

webview/src/spec-viewer/components/
└── FooterActions.stories.tsx          # Refresh GeneratingPlan / GeneratingTasks / GeneratingArtifactReady stories to reflect new layout

webview/styles/spec-viewer/
└── _footer.css                        # Add `.actions .footer-generating-chip` rule (chip + spinner; reuses existing `spin` keyframe and `activity-status-pill` aesthetic, scoped to the footer)
```

Files explicitly **not** touched:

- `src/features/spec-viewer/specViewerProvider.ts`, `stateDerivation.ts`,
  `stepArtifact.ts`, `types.ts` — the extension-side computation of
  `runningStepArtifactReady`, `runningStepLabel`, `runningStepStartedAt`
  is reused unchanged.
- The non-generating branches of `FooterActions.tsx` (catalog path with
  `vs.footer`, legacy fallback path) — they handle the post-completion /
  approve / archive / reactivate modes that are explicitly out of scope.
- `Button.tsx` — the existing `secondary` variant is already the target
  ghost/outline style; no new variant needed.

**Structure Decision**: Single-project VS Code extension layout
(`src/` extension host, `webview/` browser context). The change lives
entirely inside `webview/`.

## Phase 0: Research

No open questions. Implementation choices below are pinned to existing
code rather than discovered through research:

- **Why a chip, not a disabled button?** The viewer already renders
  non-clickable status indicators as `.activity-status-pill` (see
  `webview/styles/spec-viewer/_activity.css:100`). Reusing that idiom
  satisfies FR-001 ("does not visually invite a click") and Assumption #4
  ("status indicator's spinner / pill rendering follows whatever the
  viewer already uses").
- **Why the `secondary` Button variant for the override?** It's already
  the ghost/outline style (transparent background, 1px border, muted
  text — see `_footer.css:66`), which is the literal definition of
  "visually lighter than primary." No new variant needed. FR-002 is met
  by the move to `actions-left` (region) plus this existing variant.
- **Why is "behaviorally unchanged" trivially satisfied?** The
  `onClick={send({ type: 'markStepComplete' })}` handler is preserved
  verbatim; only the parent region (`actions-left` instead of
  `actions-right`) and visual ordering change. FR-005 is therefore a
  no-op concern.
- **Narrow-viewer collision (Edge Case)** — `actions-left` uses
  `margin-right: auto` (`_footer.css:26`) and the chip / button are
  `flex-shrink: 0`. The existing flex layout already wraps gracefully;
  no new media query needed.

## Phase 1: Design & Contracts

### Component change (FooterActions.tsx)

Inside the existing `if (isGenerating && runningStep)` block (currently
at `webview/src/spec-viewer/components/FooterActions.tsx:94`), restructure
the returned JSX as follows (illustrative — exact wording finalized at
implementation time):

```tsx
return (
    <footer class="actions">
        <Toast id="action-toast" />
        <div class="actions-left">
            <Button
                label="Mark step complete"
                variant="secondary"
                title="Manually mark this step complete if auto-detection doesn't fire"
                onClick={send({ type: 'markStepComplete' })}
            />
        </div>
        <div class="actions-right">
            <span
                class="footer-generating-chip is-running"
                role="status"
                aria-live="polite"
                title="The AI is generating this step — this status updates once the artifact is ready"
            >
                <span class="btn-spinner" aria-hidden="true" />
                Generating {ns.runningStepLabel ?? 'step'}…
            </span>
        </div>
    </footer>
);
```

Key points:

- The status chip is a `<span>` (not `<button>`) — cannot receive focus,
  cannot be clicked. Reuses `.btn-spinner` for the spinning ring.
- `role="status"` + `aria-live="polite"` give screen readers the running
  status without announcing it as an interactive control.
- "Mark step complete" stays a `Button` with `variant="secondary"` —
  identical styling to other ghost/outline footer buttons; nothing new in
  `Button.tsx`.

### CSS change (`_footer.css`)

Add one new selector block near the existing footer button rules:

```css
.actions .footer-generating-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--accent);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    user-select: none;
    pointer-events: none;            /* FR-001: does not respond to clicks */
    flex-shrink: 0;
}

.actions .footer-generating-chip .btn-spinner {
    width: 11px;
    height: 11px;
    border-width: 2px;
}
```

Visual rationale: matches `.activity-status-pill.is-implementing` color
treatment (accent + 12% tint) so the in-flight cue reads consistently with
the running-step pill that already appears in the activity panel.

### Storybook stories (`FooterActions.stories.tsx`)

Existing stories `GeneratingPlan`, `GeneratingTasks`, `GeneratingTasks`
(and the recovery / artifact-ready variants) drive themselves from
navState shape — no story-data changes required. The visual snapshot in
each story will reflect the new layout automatically once the component
is updated.

If we add a snapshot/visual-regression sweep, the four-step matrix
(specify / plan / tasks / implement) gives us SC-001 coverage.

### Agent context update

Update the `<!-- SPECKIT START --> … <!-- SPECKIT END -->` block in
`CLAUDE.md` to point at this plan:
`specs/115-footer-generating-status/plan.md`.

## Complexity Tracking

> No Constitution Check violations. Table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| (none) | — | — |

---

## Plain-English Summary

**Problem:** While a step is running, the viewer footer shows two buttons
side-by-side — a disabled "Generating …" pill and a "Mark step complete"
override. Users can't tell at a glance which one is the live thing and
which one is the fallback.

**Solution:** Stop drawing the live indicator as a button. Render it as a
small accent-tinted status chip on the right (spinner + label, not
clickable). Move "Mark step complete" to the left side of the footer
using the existing quiet/ghost button style. Everything else about the
footer — post-completion, approve, inline-comment modes — is left alone.

**Where it lives:** one early-return branch in `FooterActions.tsx`, one
new CSS class in `_footer.css`, and the existing Storybook stories pick
up the new look automatically.
