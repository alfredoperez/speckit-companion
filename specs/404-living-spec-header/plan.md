# Implementation Plan: Living Spec Header

**Feature**: 404-living-spec-header | **Spec**: [spec.md](./spec.md) | **Size**: normal

## Summary

Three changes land in the spec viewer's header when it is showing a living spec. The title starts coming from the document's own first heading instead of the folder slug, so an author-written name survives to the screen. The status badge stops carrying hover text when that text would only repeat the badge. And the header gains a facts row for living specs: how many requirements and scenarios the capability declares, how much of it is covered by tests, whether the code has drifted since the spec was written, which file patterns the capability claims, and where its spec file lives.

Coverage and drift are not recomputed. The Living Specs sidebar already derives both in `src/features/specs/livingSpecsModel.ts`, and the header calls the same functions, so the two surfaces can never disagree. Requirement and scenario counts are new but trivially derived from the document text, and follow the identifier convention the coverage check already uses.

Everything about the feature-spec header is untouched.

## Project Structure

```
src/features/spec-viewer/
├── livingDocs.ts                 # + livingSpecTitle(): first H1, suffix stripped
├── livingHeaderMeta.ts           # NEW — counts + reuse of the sidebar's health
├── specViewerProvider.ts         # wire title + meta into panel title and navState
├── types.ts                      # + LivingHeaderMeta
├── html/generator.ts             # carry livingMeta into the initial navState
└── __tests__/
    ├── livingDocs.test.ts        # + title derivation cases
    └── livingHeaderMeta.test.ts  # NEW — counts, reuse, absence-vs-zero

src/features/specs/
└── livingSpecsModel.ts           # unchanged — the shared source of coverage/drift

webview/src/spec-viewer/
├── types.ts                      # + NavState.livingMeta
└── components/
    ├── SpecHeader.tsx            # tooltip fix + living facts row
    └── SpecHeader.stories.tsx    # + living-spec states

webview/styles/spec-viewer/
└── _content.css                  # facts row styles; authored-title casing fix
```

**Structure Decision**: The new derivation lives in its own module beside the other living-spec viewer helpers rather than inside `specViewerProvider.ts`, which is already long and hard to test. It imports from `livingSpecsModel.ts` — the sidebar's module — rather than copying anything out of it.

## Constitution Check

No `.specify/memory/constitution.md` is present in this repository, so the project's standing rules in `CLAUDE.md` and `.claude/review-checklist.md` serve as the gate.

| Principle | Assessment |
|---|---|
| One derivation per fact | PASS — coverage and drift come from `readCapabilityHealth`, the sidebar's own function. Counts are new and have exactly one implementation. |
| Extension isolation | PASS — all behavior ships in `src/` and the bundled webview. Nothing under `.claude/` or `.specify/` is read at runtime. |
| No user data in HTML attributes via `innerHTML` | PASS — the header is Preact; titles, patterns and paths are passed as children/props, never string-concatenated into markup. |
| Design tokens | PASS — fact values use `--text-body`; only separators and the location path use `--text-muted`. |
| Truncation trio | PASS — the title and each pattern chip carry `white-space: nowrap` + `overflow: hidden` + `text-overflow: ellipsis` with `min-width: 0` on the flex child. |
| Stories current | PASS — `SpecHeader.stories.tsx` gains the living states in this change. |
| Docs in the same change | PASS — `README.md`, `docs/viewer-states.md`, `docs/sidebar.md`, `CHANGELOG.md`. |
| Absence is not zero | PASS — every fact field is optional and omitted when it cannot be determined. |

No violations, so no Complexity Tracking table.

## Phase 0 — Research

See [research.md](./research.md).

## Phase 1 — Design

See [data-model.md](./data-model.md) and [contracts/header-fields.md](./contracts/header-fields.md).

Re-checked against the final design: the Constitution Check above still holds. The one item that needed a second look was the drift check, which touches git and could block the panel. The design resolves it by rendering the header from synchronous facts first and posting the health fields in a follow-up navigation-state update, so nothing waits on git.
