# Tasks: Readable Spec Names

Dependency-ordered. `[P]` marks tasks that can run in parallel.

- [x] **T001** Add a shared pure resolver `resolveSpecDisplayName(specName, specDir)` that returns recorded name (trimmed, non-empty) → living-spec heading (where applicable) → humanized slug via `deriveSpecName()` + `src/core/utils/specDisplayName.ts` (or beside `deriveSpecName` in `src/features/specs/specContextManager.ts`)
- [x] **T002** [P] Unit-test the resolver: recorded name wins, whitespace/empty name falls through, humanized-slug fallback, number-only slug stays unchanged, stable/idempotent output + `src/core/utils/__tests__/specDisplayName.test.ts`
- [x] **T003** Use the resolver for each spec row label in the Specs tree (replace raw `spec.name`; reuse the already-read `specContext.specName`) + `src/features/specs/specExplorerProvider.ts`
- [x] **T004** Route the viewer header derivation (`featureCtx?.specName ?? deriveSpecName(...)`) through the same resolver so sidebar and header cannot drift + `src/features/spec-viewer/specViewerProvider.ts`
- [x] **T005** Confirm slug-keyed affordances stay on the slug — fuzzy filter, sort comparators, duplicate-name description, `speckit.openSpec` argument — only the visible label changes + `src/features/specs/specExplorerProvider.ts`
- [x] **T006** [P] Update the sidebar-provider test to assert rows render the readable name while slug-based behavior is unchanged + `src/features/specs/__tests__/specExplorerProvider.test.ts`
- [x] **T007** Update `docs/sidebar.md` to note rows show the readable name with the slug as the stable identifier + `docs/sidebar.md`
