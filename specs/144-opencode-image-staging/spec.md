# OpenCode image staging in a self-gitignored workspace dir

## Overview

When a spec authored in the spec-editor carries attached images and is dispatched to the OpenCode CLI, the images currently can't be read: they live in the extension's `globalStorage`, which is outside OpenCode's project sandbox, so OpenCode auto-rejects the read and the editor only warns the user. This delivers in-sandbox image access for OpenCode by staging the attached images into a self-gitignored cache directory inside the workspace and rewriting the inlined image references to point there, reusing the existing temp-file manifest for expiry cleanup so nothing is deleted before the agent reads it.

## Functional Requirements

- **FR-001** When a spec with attached images is dispatched to the OpenCode provider, the extension MUST copy each attached image into `<workspace-root>/.speckit-companion/spec-editor/<id>/images/` before dispatch.
- **FR-002** On first use, the extension MUST create a `.gitignore` containing a single `*` line inside `<workspace-root>/.speckit-companion/` (the cache root) so the entire cache tree is ignored and never appears in `git status`.
- **FR-003** The extension MUST rewrite the inlined image references (the `![name](globalStorage…/images/<file>)` links carried in the inlined spec body) to point at the corresponding in-workspace staged path, so the OpenCode agent reads a path inside its project root.
- **FR-004** The staged image directory MUST be registered with the existing `TempFileManager` manifest and reaped on the existing expiry schedule (`COMPLETED_FILES_MS` / `ORPHANED_FILES_MS`). The extension MUST NOT delete the staged images immediately after dispatch, because dispatch is fire-and-forget and an immediate delete races the agent's asynchronous read.
- **FR-005** The behavior MUST be scoped to the OpenCode provider. Providers that already read `globalStorage` images (Claude, Qwen, Gemini, Codex) and the existing Copilot limited-image caveat MUST be unaffected — their dispatch path and image references are unchanged.
- **FR-006** The OpenCode image warning added in #207 ("OpenCode blocks reads outside the project directory, so attached images cannot be read…") MUST be removed once OpenCode resolves staged images.
- **FR-007** When there is no workspace folder open, or staging fails, the extension MUST fall back to the existing inlined-reference behavior (no crash, no broken dispatch) rather than aborting the submission.

## Success Criteria

- **SC-001** Submitting a spec with one or more images to OpenCode resolves every image with no `external_directory` rejection and with no manual OpenCode configuration.
- **SC-002** After a submission with images under OpenCode, the cache directory does not appear in `git status` (0 untracked entries from the cache path).
- **SC-003** No regression: a submission with images under any of Claude, Qwen, Gemini, Codex, or Copilot produces the same image references it produced before this change.
- **SC-004** Staged image files persist past dispatch and are removed only by the manifest expiry sweep, never by an immediate post-dispatch delete (verifiable by a unit test asserting no delete call on the dispatch path).
- **SC-005** `npm run compile` is clean and `npm test` is green, including new tests covering the workspace staging path, the `.gitignore` `*` creation, the reference rewrite, and manifest-driven cleanup.

## Assumptions

- The workspace root used for staging is `vscode.workspace.workspaceFolders?.[0]`; with no workspace folder open, staging is skipped and the prior inlined-reference behavior is kept (FR-007).
- A single `.gitignore` containing `*` at the `.speckit-companion/` root is sufficient; finer-grained ignores are unnecessary because the whole tree is ephemeral cache.
- Image-reference rewriting operates on the already-inlined spec body produced by `inlineSpecifyTempPath`, matching the `![…](…/images/<file>)` markdown links the temp-file manager emits.
- Staging-in-workspace is gated to OpenCode deliberately rather than applied universally: non-sandboxed providers already read `globalStorage` fine, so adding workspace writes for them would be churn with no benefit and a small regression surface. The staging helper itself is provider-agnostic, but it is only invoked from the OpenCode dispatch path.
- Reusing the existing `TempFileManager` manifest entry shape (an `images`-only staged set with an `expiresAt`) is acceptable; the cleanup sweep already deletes the registered directory recursively.
