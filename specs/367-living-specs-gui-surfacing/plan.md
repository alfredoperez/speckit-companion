# Plan — Living Specs GUI surfacing (LS·7)

## Approach

Mirror the existing Activity-card pattern (`DecisionsCard`, `FilesCard`). The data already lands in `.spec-context.json` under `livingSpecs.{loaded,synced}` (written by LS·2/LS·3). The work is a read-only pipe: type → derive → serialize → render → test.

## Technical context

- **Language**: TypeScript 5.3+ (ES2022, strict). Preact for the webview.
- **Data source**: `.spec-context.json` `livingSpecs: { loaded: string[]; synced?: string[] }`.
- **Render env**: jsdom render tests (per-file `@jest-environment jsdom`), as used by `StepTab.test.tsx` / `FooterActions.test.tsx`.

## Data flow

1. `SpecContext` (extension type) already tolerates unknown fields via its index signature, so `livingSpecs` parses today. Add a typed optional `livingSpecs?: { loaded?: string[]; synced?: string[] }`.
2. `deriveViewerState` (`src/features/spec-viewer/stateDerivation.ts`) picks `livingSpecs` into `ViewerState.livingSpecs` as `{ loaded: string[]; synced: string[] }`, coercing each via the existing string-array helper (drops non-strings, trims, treats "None"/empty as none). Absent when both lists empty.
3. `ViewerState` (extension `src/core/types/specContext.ts` and webview mirror `webview/src/spec-viewer/types.ts`) gains the optional `livingSpecs` field.
4. New `LivingSpecsCard` (`webview/src/spec-viewer/components/cards/LivingSpecsCard.tsx`) renders the loaded list, marking synced entries as folded back; returns `null` when empty.
5. `ActivityPanel` mounts `<LivingSpecsCard>`; `hasAnyData` recognizes `livingSpecs` so the panel isn't "No activity" when only living-specs data exists.

## Design notes

- **No user data in attributes.** Capability names go in as element text (`{name}` children), never into `title="…"`/`alt="…"` via `innerHTML`. Matches `DecisionsCard`.
- **Coercion.** Reuse the `toStringArray`-style normalization at the derive boundary so a malformed `livingSpecs` shape can't crash the card (FR-004). The pure normalizer is the unit boundary the node test environment can exercise even without jsdom.
- **Hide when empty.** Card returns `null` if `loaded` is empty (FR-003).
- **Synced ⊆ display.** A capability in `synced` but not `loaded` is still shown (folded back even if it wasn't loaded this run) — union of the two lists, each annotated.

## Files to change

- `src/core/types/specContext.ts` — add `LivingSpecsContext` + `SpecContext.livingSpecs` + `ViewerState.livingSpecs`.
- `src/features/spec-viewer/stateDerivation.ts` — `pickLivingSpecs(ctx)`; wire into `deriveViewerState`.
- `webview/src/spec-viewer/types.ts` — mirror `livingSpecs` on the webview `ViewerState`.
- `webview/src/spec-viewer/components/cards/LivingSpecsCard.tsx` — new card.
- `webview/src/spec-viewer/components/ActivityPanel.tsx` — mount card + extend `hasAnyData`.
- `webview/styles/spec-viewer/*` — minimal card styling (reuse `activity-card` classes; add a folded-back chip class).

## Tests

- `src/features/spec-viewer/__tests__/stateDerivation.test.ts` — `pickLivingSpecs` coercion: arrays pass through, non-strings dropped, malformed → safe, absent → undefined.
- `webview/src/spec-viewer/components/cards/__tests__/LivingSpecsCard.test.tsx` — jsdom render: loaded-only shows loaded names; loaded+synced annotates folded-back; none → renders nothing.

## Docs

- README "Activity Panel" — add the *Living specs* card to the card list.
- `docs/viewer-states.md` — add a *Living specs (Activity panel)* subsection next to *Review comments*.
- New `.stories.tsx` for the card (loaded-only / loaded+synced / none states) — Storybook is the visual baseline.

## Verification

`npm run compile && npm test` green; jsdom render test asserts data→DOM. Visual look is manual-verify (NFR-004).
