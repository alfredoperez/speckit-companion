# Research: Living Spec Components

The unknowns this plan had to settle are all *how to attach* — the codebase already fixes the stack, the storage, and the test setup. What follows is why the design is shaped the way it is.

## Decision: Render through the existing string preprocessor pipeline, not Preact

- **Decision**: Build each component as a `preprocess*`-style function that transforms living-spec markdown into recognized HTML strings inside `renderer.ts`'s existing render loop. Do **not** render the living-spec body as a Preact component tree.
- **Rationale**: Three of the spec's hard requirements are properties of the current string loop, not of any component. Line-comment identity (FR-005) is `data-line` stamped by the main loop as it walks source lines; per-region fallback (FR-003) is natural when a preprocessor can simply return its input unchanged; feature-spec byte parity (SC-001) is free when the new code is a gated branch the base path never enters. A Preact body would fork the comment/anchor system (`editor/`, `restoreComments`) and the fallback contract at once.
- **Alternatives considered**: A Preact component tree for the living body — rejected: it would re-implement `data-line` anchoring and re-home the line-comment affordances, turning a rendering change into a rewrite of the annotation system.

## Decision: Gate on a module-level `livingMode` flag set before render

- **Decision**: Add `setLivingMode(value: boolean)` to `renderer.ts` mirroring the existing `setHasSpecContext`, call it from `index.tsx` from `navState.livingMode` on every `contentUpdated` / `viewerStateUpdated`, and run the living preprocessors only when the flag is true.
- **Rationale**: FR-001 and SC-001 require feature specs to render identically to today. A single gate keeps every new preprocessor out of the feature-spec path entirely. The extension already owns living-ness (`livingMode` is on `NavState`), so the webview must not re-derive it — the viewer-ui living spec is explicit that the webview "never decides the run's state, it renders the state it is given."
- **Alternatives considered**: Detecting living-ness from document content in the webview — rejected: it duplicates a fact the extension owns and risks the two disagreeing.

## Decision: Per-component fallback via a `safe()` wrapper

- **Decision**: Wrap each living preprocessor so any thrown error is caught and the **input region is returned unchanged**, letting the base renderer format that region as plain markdown. The wrapper is per-preprocessor, not one document-wide try/catch.
- **Rationale**: FR-002/FR-003 want a *region* to fall back, not the whole document. Returning the untouched input means the base loop still stamps `data-line` and still renders every source line — no dropped lines (FR-018, SC-006), and one bad component can't take the page down (SC-007).
- **Alternatives considered**: A single try/catch around the whole living pass — rejected: one failing component would strip component treatment from the entire document, over-degrading.

## Decision: Requirement card wraps still-individual commentable lines, keyed on exact heading text

- **Decision**: The requirement card is a CSS-styled container opened at the requirement's `###` heading (carrying the card's identity, the exact heading text, un-normalized), with its scenario lines rendered as the pipeline's normal per-line `.line` units inside it — the same shape `preprocessTaskPhases` and `user-story-header` already use.
- **Rationale**: FR-008 keys the card on the exact heading text that fold-back matches on, so no trimming/re-casing. FR-005 needs each inner line to keep its own `data-line` for comment add/restore/edit/delete parity. A card that collapsed the whole requirement into one component-line would key correctly but lose per-line comments.
- **Alternatives considered**: Collapse each requirement into a single `wrapComponentLine` block — rejected: one comment anchor per requirement is a comment-parity regression against plain markdown.

## Decision: A separate scenario-steps preprocessor for living WHEN/THEN/AND

- **Decision**: Add a living scenario preprocessor for the `#### Scenario:` + bold-keyword-bullet format (`- **WHEN** …`, `- **THEN** …`, `- **AND** …`), distinct from the existing `parseAcceptanceScenarios` which handles the feature-spec `**Acceptance Scenarios**:` numbered Given/When/Then.
- **Rationale**: The authored shape and the verbatim keywords differ (`WHEN`/`THEN`/`AND` vs `Given`/`When`/`Then`). Gating the new one on living mode keeps the two from cross-processing each other's format (FR-012 without reorder/reword).
- **Alternatives considered**: Extend `parseAcceptanceScenarios` to handle both — rejected: coupling two different authored formats in one regex invites the feature-spec path changing, breaking SC-001.

## Decision: Coverage per requirement is best-effort, omitted rather than zeroed

- **Decision**: Render a requirement's coverage badge only when a coverage value is available for that requirement (surfaced from `viewerState` when the plumbing provides it); when it is not determinable, render no coverage at all — never `0`.
- **Rationale**: The spec's Assumption notes per-requirement coverage may land as separate plumbing; FR-011/FR-019/SC-004 forbid rendering an undeterminable value as zero. Ship coverage-less when the number is absent.
- **Alternatives considered**: Block the feature on the coverage plumbing — rejected: the reading improvement stands on its own, and the spec explicitly allows shipping cards coverage-less.

## Decision: Uncovered section — sentinel first, then reason-grouped disclosures, defensively parsed

- **Decision**: Parse the `## Uncovered` section. If it is empty or contains the read-everything sentinel `_None — every file in the area was read._`, render a plain "read everything" statement (no empty banner). Otherwise open with a count + scope statement, then group files by their omission reason into `<details>` disclosures that are closed by default and keyboard-operable. Any sub-structure the parser does not recognize falls back to plain markdown rather than dropping a line.
- **Rationale**: FR-014–FR-019 and SC-006 — count-and-scope first, grouped-by-reason, keyboard-accessible, no zeros, no dropped lines.
- **Alternatives considered**: A single flat file list — rejected by FR-015; a strict parser that skips unrecognized lines — rejected by FR-018 (must fall back, never drop).

## Decision: Draft notice keys on the `[DRAFT]` marker and leaves the in-document banner intact

- **Decision**: Render the draft notice from the `[DRAFT]` marker present in the top window of the body, matching the marker the extension's `isLivingDraft` already detects, and leave the authored banner line intact in the flow (do not consume it).
- **Rationale**: FR-006 requires the draft notice without breaking the existing draft-marker detection other features rely on. Matching the same `[DRAFT]` token keeps the two in agreement.
- **Alternatives considered**: Consume/rewrite the banner line — rejected: other features read the raw marker; the viewer-ui spec says the in-document banner is left intact.

## Security & accessibility constraints carried into design

- **No document content into HTML attributes via string concatenation** (FR-020): any attribute carrying authored text is built attribute-safe (DOM-built or an attribute-safe escape), never through `escapeHtml` (which does not escape attribute quotes). This is a standing webview invariant in this repo.
- **Accessibility-description targets use a visually-hidden class** (FR-021), not `hidden`/`display:none`, so the description stays in the accessibility tree.
- **All themes/modes via existing viewer tokens** (FR-022): dark, light, high-contrast, narrow, and reduced-motion — including a still equivalent for the disclosure transition.
