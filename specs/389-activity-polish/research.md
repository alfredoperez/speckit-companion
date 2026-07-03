# Research: Activity panel polish

## Decision 1 — Focus treatment: `:focus-visible` ring, suppressed `:focus` outline

**Decision**: Add an explicit `:focus-visible` outline (accent, offset, rounded) on `.activity-tabs__tab` and set `outline: none` for `:focus:not(:focus-visible)`.
**Rationale**: The artifact in the shipped render is the webview's default focus outline colliding with the active tab's `border-bottom` indicator — a three-sided box after mouse click. `:focus-visible` keeps the keyboard affordance (WCAG 2.4.7) while removing the click-time noise.
**Alternatives considered**: `outline: none` unconditionally — rejected, removes the keyboard indicator entirely; restyling the underline to swallow the outline — rejected, fights the UA instead of using the standard pseudo-class.

## Decision 2 — Tab badges: `warning?: boolean` on the existing count field

**Decision**: Keep `ActivityTab.count?: number` and add `warning?: boolean`. Proof sets `count` to the uncovered-requirement count (warning) only when > 0; Notes does the same for open concerns; Decisions/Work keep their plain counts.
**Rationale**: Smallest model change that expresses "attention-only badge"; the renderer stays one conditional class. Tab *presence* rules are untouched (Proof still exists when any proof content exists), so the default-tab logic and empty-tab filtering don't move.
**Alternatives considered**: A `badge: {value, tone}` object — rejected, more shape churn for the same two fields; badging nothing anywhere — rejected, uncovered/concern counts are the panel's most actionable signal.

## Decision 3 — Checks layout: flex-wrap pills sized to content

**Decision**: Replace `.activity-pill-grid`'s `auto-fit minmax(240px, 1fr)` grid with a wrapping flex row; pills keep their tint but size to content (with a max-width so long check text wraps inside the pill).
**Rationale**: Three one-line facts in a 2-column grid produce a ghost cell and mismatched heights — the taste findings. Flex-wrap packs them like tags, which is what one-line facts are.
**Alternatives considered**: Single-column list — rejected, wastes vertical space for short items; keeping the grid with `grid-auto-flow: dense` — rejected, doesn't fix unequal heights or the hole for odd counts.

## Decision 4 — Heading case via markup + CSS together

**Decision**: Remove `text-transform: uppercase` from `.activity-card__title` and `.activity-plan__heading`, bump their size slightly, and set the visible strings to Title Case ("Plan", "Checks", "Coverage"). Inline micro-labels (`.activity-inline-label`, `.activity-detail-label`) keep the small uppercase treatment.
**Rationale**: The all-caps treatment was carrying every heading level, flattening hierarchy; the design-taste rule is Title Case for section headings, uppercase only for tiny metadata prefixes.
**Alternatives considered**: CSS `text-transform: capitalize` on titles — rejected, capitalizes mid-title words wrongly ("The Plan" from "the plan" is fine but "Out of scope" would render "Out Of Scope"); explicit strings are exact.

## Decision 5 — Label color: a derived `--text-label` token

**Decision**: Add `--text-label` to `tokens.css` as an 82% theme-foreground `color-mix` (full foreground in high-contrast) and point the metadata-label classes at it.
**Rationale**: `--text-secondary` already derives from the theme foreground at 70% (spec 148 fixed the old `descriptionForeground` mapping), but at 0.7rem uppercase that 70% mix still reads faint — small type costs apparent contrast. Labels need a stronger mix than secondary while staying subordinate to values; subordination comes from size/weight, not dimness.
**Alternatives considered**: Using `--text-body` — rejected, labels stop receding and compete with values; hardcoding a gray — rejected, breaks light theme and the token rule.

## Decision 6 — Header title casing: CSS `text-transform: capitalize`

**Decision**: `text-transform: capitalize` on `.spec-header-title` only.
**Rationale**: The title is a slug-derived phrase of simple words ("phases strip"); per-word capitalization is exactly what's wanted, presentation-only, and leaves the underlying name untouched everywhere else (tree, files, context).
**Alternatives considered**: Title-casing in TS before render — rejected, would need locale/apostrophe rules for a purely cosmetic fix and risks diverging from the name used elsewhere.
