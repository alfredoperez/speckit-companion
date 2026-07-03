# Tasks: Phases as a horizontal step-time strip

- [x] **T001** Rework the Phases card body to the horizontal strip (keep summary row; drop substeps + bars; in-flight distinct; untrusted times omitted) · webview/src/spec-viewer/components/cards/PhasesCard.tsx
- [x] **T002** Strip CSS: nodes, connectors, wrap, in-flight treatment · webview/styles/spec-viewer/_activity.css
- [x] **T003** Stories: completed / in-flight / single-step; verify panel stories · PhasesCard + ActivityPanel stories
- [x] **T004** Gate: jest + both tsc + impeccable on the changed surface; screenshot the strip
- [x] **T005** Coverage list open by default: all rows visible (uncovered first), disclosure stays as a visible collapse control · webview/src/spec-viewer/components/cards/CoverageCard.tsx
- [x] **T006** One surface per tab: the tab panel carries the card chrome; inner cards flatten to sections (single-section tabs drop the redundant title) · webview/styles/spec-viewer/_activity.css
