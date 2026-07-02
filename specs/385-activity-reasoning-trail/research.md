# Research: Activity panel reasoning trail

**Feature**: 385-activity-reasoning-trail · Decisions behind [plan.md](./plan.md).

## D1 — Normalize in the derivation, not the webview

- **Decision**: `stateDerivation.ts` converts every raw shape into one normalized form per field (`DecisionEntry`-like objects, `VerificationEntry`-like, coverage rows); the webview renders what it's given.
- **Rationale**: the derivation already owns shape-tolerance (`pickConcerns` normalizes concerns the same way); the webview staying dumb keeps injection-safety trivial (JSX text nodes) and testability on the extension side where the jest harness lives.
- **Alternatives considered**: per-card defensive parsing in the webview — rejected: duplicates tolerance logic across cards and splits the tests.

## D2 — Replace `pickStringArray` for decisions with a both-shapes normalizer

- **Decision**: a `pickDecisions` that maps strings → `{decision}` and keeps valid objects (identity key present), skipping malformed entries; `ViewerState.decisions` becomes the normalized object array.
- **Rationale**: fixes the regression at its root (the string-only filter) while keeping legacy contexts rendering unchanged.
- **Alternatives considered**: stringifying objects into display lines in the derivation — rejected: loses structure the card wants (why/rejected sub-lines).

## D3 — Card layout choices

- **Decision**: Intent card at the top of the panel (it answers "what is this?"), then the existing order; Verified after Decisions; Coverage after Verified; classification as one compact line inside the Approach card (`normal · 8 files / 12 tasks projected`).
- **Rationale**: reading order mirrors the questions a reviewer asks (what → how → why → proven → covered); classification is one datum, not a card.
- **Alternatives considered**: a separate Classification card — rejected: an entire card for one line reads as clutter.

## D4 — Coverage rollup definition

- **Decision**: covered = the requirement has ≥1 test ref; header shows `covered/total`. Requirements render as `FR-001 — tasks: T002, T003 · tests: …`, tests truncated with the full list in the title attribute set via JSX (safe).
- **Rationale**: matches the CLI coverage command's semantics (test-mapped = covered), so the GUI and CLI never disagree.

## D5 — Stories reuse the LivingSpecsCard harness pattern

- **Decision**: each new/changed card gets a `.stories.tsx` cloned from `LivingSpecsCard.stories.tsx`'s `baseState` helper, with stories per state (empty→absent, structured, legacy-string, mixed, long-text wrap).
- **Rationale**: house rule — stories are the visual baseline; the harness pattern already exists.
