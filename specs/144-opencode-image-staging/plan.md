# Implementation Plan: OpenCode image staging in a self-gitignored workspace dir

## Summary

For OpenCode dispatches that carry attached images, stage the images into a self-gitignored workspace cache dir (`<workspace-root>/.speckit-companion/spec-editor/<id>/images/`), rewrite the inlined `![…](…/images/<file>)` references to the in-workspace path, and register the staged dir with the existing `TempFileManager` manifest for expiry cleanup. Scope the new behavior to the OpenCode provider; remove the #207 OpenCode image warning.

## Technical Context

- **Language**: TypeScript (VS Code extension), compiled with `tsc -p ./`.
- **Primary deps**: `vscode` API (`workspace.fs`, `workspace.workspaceFolders`), Node `path`/`Buffer`. Tests: Jest with the repo's `vscode` mock.
- **Storage**: images already on disk under extension `globalStorage`; new staging target is inside the workspace.
- **Testing**: unit tests in `src/.../__tests__/`, using the existing `vscode.workspace.fs` mock harness.
- **Target platform**: macOS/Windows/Linux VS Code; paths may contain spaces.
- **Constraints**: dispatch is fire-and-forget — no immediate post-dispatch delete (race with agent read). No new `src/`/`webview/` runtime dependency on `.claude/**` or `.specify/**`. OpenCode-only; do not change other providers' image refs.

## Approach & Structure

Order of attack, by file:

1. **`src/features/spec-editor/tempFileManager.ts`** — add a `stageImagesInWorkspace(...)` method (provider-agnostic helper):
   - Compute the cache root `<workspace-root>/.speckit-companion/`; ensure it and a `spec-editor/<stageId>/images/` subtree exist.
   - On first use, write `.gitignore` containing `*` at the cache root (idempotent — skip if present).
   - Copy each `AttachedImage` from its `globalStorage` `filePath` into the staged `images/` dir, returning a `Record<imageId, stagedFsPath>` (and the original `globalStorage` path for ref-rewrite matching).
   - Register a manifest entry (an `images`-only `TempSpecFile`: `markdownFilePath: ''`, `imageFilePaths` = staged paths, `expiresAt` = now + `ORPHANED_FILES_MS`, `status: 'submitted'`) so the existing `cleanupOrphanedFiles` sweep reaps it on schedule. Reuse `getWorkspaceCacheDir`-style helpers; do NOT delete after dispatch.
   - Return `undefined`/no-op when there is no workspace folder or a copy fails (FR-007 fallback).

2. **`src/ai-providers/promptBuilder.ts`** — add `rewriteImageRefsToStaged(body, mapping)`:
   - Given the inlined spec body and a map of original-path → staged-path, replace each `](<originalPath>)` occurrence with `](<stagedPath>)`. Match on the exact paths the temp manager emitted; leave the body untouched when a path isn't present.
   - Keep this pure/string-only so it is unit-testable without `vscode`.

3. **`src/ai-providers/openCodeProvider.ts`** — in `prepareDispatch`, after `inlineSpecifyTempPath`:
   - Resolve the active spec-editor images for this dispatch (the temp manager exposes the just-created temp set's `imageFilePaths`), stage them via the new helper, rewrite the inlined body refs, and dispatch the rewritten prompt. If staging is unavailable (no workspace / failure), dispatch the un-rewritten prompt unchanged.
   - Because the OpenCode provider doesn't currently receive the `TempFileManager` or image list, pass the staging through a minimal seam: the spec-editor already builds the prompt; the cleanest seam is to have the spec-editor (which owns `TempFileManager` + the image list) pre-stage for OpenCode and emit a prompt whose refs already point in-workspace. Decide the seam during implement; prefer doing the staging where the data lives (spec-editor) and keeping `promptBuilder` ref-rewrite as the reusable pure function.

4. **`src/features/spec-editor/specEditorProvider.ts`** — remove the OpenCode image warning block from `handleSubmit` (FR-006). When the provider is OpenCode and there are images, call the staging helper and rewrite the temp markdown's image refs before dispatch (or stage + rewrite in the temp file the prompt points at). Leave the Copilot warning intact.

5. **Tests** — extend `src/features/spec-editor/__tests__/` (new file) and/or `src/ai-providers/__tests__/promptBuilder.test.ts`:
   - workspace staging writes images + creates `.gitignore` with `*`;
   - ref rewrite swaps globalStorage paths → staged paths and leaves non-matching bodies alone;
   - cleanup goes through the manifest (staged set registered with an `expiresAt`; no immediate delete on dispatch);
   - regression: non-OpenCode providers' refs unchanged.

**Decision (OpenCode-only vs universal):** gate at the OpenCode dispatch path. The staging helper is provider-agnostic and reusable, but only invoked for OpenCode, because Claude/Qwen/Gemini/Codex already read `globalStorage` images and universal workspace writes would be churn + a small regression surface for no benefit.

## Out of Scope

- Inlining image *bytes* into the prompt (binary; not possible in a text prompt).
- Changing image handling for Claude / Qwen / Gemini / Codex / Copilot.
- Any change to the manifest expiry thresholds or the cleanup scheduler itself.
- Thumbnail/resize behavior.

## Constitution Check

No constitution gates defined for this change. Pass.
