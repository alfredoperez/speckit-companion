# Tasks: Hide Implement and Mark Complete from the viewer's side nav

- [x] **T001** Filter action-category steps out of the pipeline rail and compute percent-host / running-lock indices against the rendered list + webview/src/spec-viewer/components/NavigationBar.tsx
- [x] **T002** Verify StepTab props still line up with the filtered rail (index-based locking, percent host); adjust only if the filtered indices change their meaning + webview/src/spec-viewer/components/StepTab.tsx
- [x] **T003** Add/adjust tests: action steps never render, percent lands on the last document tab, no wrong locking while a hidden step runs + webview/src/spec-viewer/components/__tests__/
- [x] **T004** [P] Update NavigationBar stories to the documents-only rail (no Implement / Mark Complete entries; percent on Tasks) + webview/src/spec-viewer/components/NavigationBar.stories.tsx
- [x] **T005** [P] Update docs: rail lists documents only, lifecycle actions live in the footer + docs/viewer-states.md, README.md
