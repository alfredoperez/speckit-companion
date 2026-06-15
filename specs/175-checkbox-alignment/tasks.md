# Tasks: Tasks checkbox alignment

- [x] **T001** Center the task checkbox on the first label line by replacing the fixed `margin: 2px 0 0 0` with `margin: calc((1.4em - 16px) / 2) 0 0 0` in the `#markdown-content li.task-item input[type="checkbox"]` rule + webview/styles/spec-viewer/_tasks.css
- [x] **T002** Mirror the corrected checkbox margin in the story baseline so it matches the shipped CSS + webview/src/spec-viewer/components/TaskLine.stories.tsx
- [x] **T003** Update the task-row checkbox style only if it hardcodes a now-mismatched margin + webview/src/spec-viewer/components/InlineComment.stories.tsx
- [x] **T004** Verify the build and tests pass (`npm run compile && npm test`)
