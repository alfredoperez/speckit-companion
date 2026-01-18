# Implementation Plan: Spec Editor Webview

**Branch**: `004-spec-editor-webview` | **Date**: 2026-01-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-spec-editor-webview/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add a webview-based spec editor with multi-line text input, image attachments, and temporary markdown file storage for cross-CLI compatibility. The editor will use VS Code's webview API (extending existing workflow editor infrastructure) and leverage the existing `context.globalStorageUri` mechanism for temp file management.

## Technical Context

**Language/Version**: TypeScript 5.3+ (ES2022 target, strict mode enabled)
**Primary Dependencies**: VS Code Extension API (`@types/vscode ^1.84.0`), Webpack 5
**Storage**: Local filesystem (context.globalStorageUri for temp files), VS Code workspaceState for drafts
**Testing**: Jest 29 (`npm run test`)
**Target Platform**: VS Code ^1.84.0 (cross-platform: Windows, macOS, Linux)
**Project Type**: VS Code Extension (single project with webview component)
**Performance Goals**: <100ms webview render, <200ms image attachment, instant draft save
**Constraints**: 2MB per image, 10MB total attachments (per spec requirements), offline-capable
**Scale/Scope**: Single workspace, 1-5 concurrent spec editor instances

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Compliance Notes |
|-----------|--------|------------------|
| **I. Extensibility and Configuration** | ✅ PASS | The spec editor will work with all AI providers (Claude, Gemini, Copilot) via the existing `IAIProvider` interface. Temp file mechanism already exists in all providers. No provider-specific logic in the editor itself. |
| **II. Spec-Driven Workflow** | ✅ PASS | This feature directly enhances the spec creation workflow by providing a richer input mechanism. It supports the Spec → Plan → Tasks flow by improving the initial Spec authoring experience. |
| **III. Visual and Interactive** | ✅ PASS | Core requirement is a visual webview with multi-line editing, image attachments, preview, and interactive submit/cancel buttons. Fully aligned with the GUI-first principle. |
| **AI Provider Integration** | ✅ PASS | Uses existing `IAIProvider` abstraction. Temp files stored in `globalStorageUri` work with all providers. Image support gracefully degrades for providers without image capability. |
| **User Interface** | ✅ PASS | Follows existing patterns: contributes a new webview panel (similar to WorkflowEditorProvider). Reuses existing webview infrastructure from `webview/` directory. |

**Gate Result**: ✅ All constitution principles satisfied. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/004-spec-editor-webview/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command) - N/A for this feature
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── features/
│   └── spec-editor/                    # NEW: Feature module for spec editor
│       ├── index.ts                    # Exports for the feature
│       ├── specEditorProvider.ts       # WebviewPanel provider (similar to WorkflowEditorProvider)
│       ├── specEditorCommands.ts       # Command registration
│       ├── specDraftManager.ts         # Draft save/restore using workspaceState
│       ├── tempFileManager.ts          # Temp markdown file generation/cleanup
│       └── types.ts                    # SpecDraft, TempSpecFile, AttachedImage types
├── extension.ts                        # MODIFY: Register new commands and provider
└── core/
    └── types.ts                        # MODIFY: Add message types for spec editor

webview/
├── src/
│   ├── spec-editor/                    # NEW: Webview UI for spec editor
│   │   ├── index.ts                    # Entry point for spec editor webview
│   │   ├── editor.ts                   # Multi-line text editor component
│   │   ├── imageAttachment.ts          # Image drag-drop and file picker
│   │   ├── preview.ts                  # Preview mode rendering
│   │   └── templateLoader.ts           # Load previous spec as template (US4)
│   └── types.ts                        # MODIFY: Add spec editor message types
└── styles/
    └── spec-editor.css                 # NEW: Styles for spec editor webview
```

**Structure Decision**: VS Code Extension (single project) with Node.js extension code in `src/` and browser-based webview code in `webview/`. This follows the existing architecture where `WorkflowEditorProvider` handles the extension side and `webview/src/workflow.ts` handles the browser side. Webpack bundles the webview code separately.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. All principles satisfied.

---

## Post-Design Constitution Re-check

*Re-evaluation after Phase 1 design completion.*

| Principle | Status | Design Validation |
|-----------|--------|-------------------|
| **I. Extensibility and Configuration** | ✅ PASS | Design confirms: TempFileManager uses existing globalStorageUri pattern from all AI providers. No provider-specific code in spec editor. New command registered via existing pattern. |
| **II. Spec-Driven Workflow** | ✅ PASS | Design confirms: SpecEditorProvider submits specs via IAIProvider.executeInTerminal(), integrating with the existing workflow. Draft persistence ensures users don't lose work. |
| **III. Visual and Interactive** | ✅ PASS | Design confirms: WebviewPanel with multi-line textarea, image thumbnails, preview mode, and action buttons. All interactions are visual and GUI-based. |
| **AI Provider Integration** | ✅ PASS | Design confirms: Generates markdown with image file paths. All providers can read temp files. Image support gracefully degraded (warning message) for providers without image capability. |
| **User Interface** | ✅ PASS | Design confirms: New feature module follows existing patterns (specEditorProvider.ts mirrors WorkflowEditorProvider). Webview code in webview/src/spec-editor/ follows existing structure. |

**Post-Design Gate Result**: ✅ All constitution principles remain satisfied after detailed design.

---

## Generated Artifacts

| Artifact | Path | Status |
|----------|------|--------|
| Plan | `specs/004-spec-editor-webview/plan.md` | ✅ Complete |
| Research | `specs/004-spec-editor-webview/research.md` | ✅ Complete |
| Data Model | `specs/004-spec-editor-webview/data-model.md` | ✅ Complete |
| Quickstart | `specs/004-spec-editor-webview/quickstart.md` | ✅ Complete |
| Contracts | N/A (no external APIs) | ⏭️ Skipped |
| Agent Context | `CLAUDE.md` | ✅ Updated |

## Next Steps

Run `/speckit.tasks` to generate the implementation tasks based on this plan.
