# Tasks: OpenCode image staging in a self-gitignored workspace dir

Dependency-ordered. `[P]` = parallelizable with siblings.

- [x] **T001** Add `stageImagesInWorkspace(stageId, images)` to `TempFileManager`: compute `<workspace-root>/.speckit-companion/` cache root, ensure `spec-editor/<stageId>/images/`, write `.gitignore` (`*`) at the cache root on first use (idempotent), copy each image from its globalStorage `filePath` into the staged dir, register an `images`-only manifest entry with `expiresAt = now + ORPHANED_FILES_MS`, and return a `Record<originalFsPath, stagedFsPath>`. No-op (return empty) when no workspace folder or on copy failure. + `src/features/spec-editor/tempFileManager.ts`
- [x] **T002** Add pure `rewriteImageRefsToStaged(body, mapping)` to `promptBuilder.ts` that replaces `](<originalPath>)` → `](<stagedPath>)` for each mapping entry and leaves non-matching bodies unchanged. + `src/ai-providers/promptBuilder.ts`
- [x] **T003** In `specEditorProvider.handleSubmit`, remove the OpenCode image warning block (keep the Copilot warning); when provider is OpenCode and images are present, stage via T001 and rewrite the temp markdown's image refs (T002) in place before dispatch, with fallback to unchanged refs on no-workspace/failure. + `src/features/spec-editor/specEditorProvider.ts`
- [x] **T004** [P] Unit tests: `stageImagesInWorkspace` writes images, creates `.gitignore` with `*`, registers a manifest entry with `expiresAt`, and performs no immediate delete on the dispatch path. + `src/features/spec-editor/__tests__/tempFileManager.staging.test.ts`
- [x] **T005** [P] Unit tests: `rewriteImageRefsToStaged` swaps matching paths, leaves non-matching/empty mappings untouched. + `src/ai-providers/__tests__/promptBuilder.test.ts`
- [x] **T006** Regression test: a non-OpenCode submit path keeps the original globalStorage image refs (no staging, no rewrite). + `src/features/spec-editor/__tests__/tempFileManager.staging.test.ts`
- [x] **T007** `npm run compile` clean + `npm test` green; fix any breakage. + (verification)
