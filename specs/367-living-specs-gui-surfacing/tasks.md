# Tasks — Living Specs GUI surfacing (LS·7)

## US1 — See which living specs a feature touched

- [x] **T001** Add `LivingSpecsContext` interface + `SpecContext.livingSpecs` (optional) + `ViewerState.livingSpecs` to `src/core/types/specContext.ts`.
- [x] **T002** Add `pickLivingSpecs(ctx)` to `src/features/spec-viewer/stateDerivation.ts` (coerce loaded/synced to safe `string[]`, return undefined when both empty) and wire it into `deriveViewerState`.
- [x] **T003** Mirror the `livingSpecs` field on the webview `ViewerState` in `webview/src/spec-viewer/types.ts`.
- [x] **T004** Create `webview/src/spec-viewer/components/cards/LivingSpecsCard.tsx` — render loaded capabilities, annotate folded-back (synced) ones, return null when empty.
- [x] **T005** Mount `<LivingSpecsCard>` in `ActivityPanel.tsx` and extend `hasAnyData` to recognize `livingSpecs`.
- [x] **T006** Add card styling in `webview/styles/spec-viewer/` (folded-back chip).

## US2 — Read-only + safe

- [x] **T007** Confirm no write path: card and derivation only read; capability names render as element text (no `innerHTML` into attributes).

## Tests + docs (evidence)

- [x] **T008** `stateDerivation.test.ts` — `pickLivingSpecs` coercion cases (pass-through, drop non-strings, malformed safe, absent undefined).
- [x] **T009** jsdom render test `LivingSpecsCard.test.tsx` — loaded-only, loaded+synced, none → renders nothing.
- [x] **T010** `LivingSpecsCard.stories.tsx` — loaded-only / loaded+synced / none stories.
- [x] **T011** README "Activity Panel" + `docs/viewer-states.md` — document the *Living specs* card.
- [x] **T012** Write `examples/todo-claude/bench/living-specs/evidence/LS7.json` (mode=webview-test) + append LS·7 section to vault status.html, flip row to shipped.
