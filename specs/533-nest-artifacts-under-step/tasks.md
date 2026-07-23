# Tasks: Nest a step's artifact files under it in the viewer rail

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

## Phase 1 — Rail nesting (User Story 1, P1)

- [x] **T001** Rewrite the artifact rendering in `NavigationBar.tsx`: for each `railDocs` step, compute its existing related children (`exists && (parentStep || rootPhase) === doc.type`) and render them as an indented `<ul class="step-substeps">` of `<li>` sub-item buttons immediately after that step's `<StepTab>`, wrapped in a `step-tab-group` container. Remove the separate visible-parent `groups` rendering. + webview/src/spec-viewer/components/NavigationBar.tsx
- [x] **T002** Add the orphan fallback: build `railTypes`, keep one trailing `rail-group` only for related docs whose `parentStep` is not a visible rail entry, labeled `<Step> files`, so hidden-action-step artifacts stay reachable. + webview/src/spec-viewer/components/NavigationBar.tsx
- [x] **T003** Add `.step-substeps` styles (nested-list reset + compact indent, reuse `.step-child`) in `_navigation.css`; keep `min-width:0` so labels truncate. + webview/styles/spec-viewer/_navigation.css

## Phase 2 — Reachability & a11y (User Story 2, P2)

- [x] **T004** Confirm nested sub-item click dispatches `switchDocument` and shows active state; parent step click still opens the step doc (covered by tests in T006). + webview/src/spec-viewer/components/NavigationBar.tsx
- [x] **T005** [P] Ensure nested list reads as a nested list (`<ul>`/`<li>`, `aria-label` on the sub-list). + webview/src/spec-viewer/components/NavigationBar.tsx

## Phase 3 — Stories, tests, docs

- [x] **T006** Extend `NavigationBar.test.tsx`: assert related docs render nested under their `parentStep` (not separate groups), Overview stays first, Implement/Mark-Complete stay hidden, nested click dispatches `switchDocument`, and a hidden-parent artifact renders in the fallback group. + webview/src/spec-viewer/components/__tests__/NavigationBar.test.tsx
- [x] **T007** [P] Update `NavigationBar.stories.tsx` to show the nested-under-step layout across multiple steps each with related children. + webview/src/spec-viewer/components/NavigationBar.stories.tsx
- [x] **T008** [P] Update `docs/sidebar.md` for the nested rail shape and add a root `CHANGELOG.md` Unreleased entry (user-facing voice). + docs/sidebar.md + CHANGELOG.md
