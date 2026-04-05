# Spec Viewer Header Redesign

**Spec ID**: 046-spec-viewer-header-redesign
**Created**: 2026-04-05
**Status**: Draft

## Summary

Redesign the spec viewer header to be fully driven by `.spec-context.json`, showing a structured header (badge, date, title, file link) before loading markdown content. Also update `spec-context.json` on step tab clicks and add `specName` and `branch` fields.

## Requirements

### R001 — Header layout uses spec-context.json

The header above the markdown content must render in this order:

```
[Badge] [Created Date]
[Title: {Step}: {Spec Name} | First H1 from doc]
[File link: clickable path to current file]
───────────────────────────────────
```

- **Badge**: shows the latest step executed or current step with animated ellipsis (`...`) for in-progress. Derived from `step` + `substep` in spec-context.json.
- **Date**: spec creation date from `stepHistory.specify.startedAt`. Label should read "Created" (not "Last updated").
- **Title**: format is `{currentDocType in white}: {specName}`. Falls back to first `# H1` in the markdown if specName is missing.
- **File link**: clickable link to the current document file so devs can open it in the standard editor.

### R002 — Badge uses primary/h1 color

The badge should use the same color as `h1` headings (the accent/primary color from the theme), not the current subtle accent background. This makes it visually prominent and consistent with the heading hierarchy.

### R003 — Header renders before markdown content

The header (badge, date, title, file link) must render immediately from spec-context.json data. The markdown content loads after. This prevents the raw spec metadata (feature branch, status block) from flashing before the styled header appears.

### R004 — Step tab clicks update spec-context.json

When a user clicks a step tab in the navigation bar:
1. Set `currentStep` to the clicked step
2. Add/update `stepHistory[clickedStep].startedAt` if not already present
3. Write changes to `.spec-context.json`

Currently `handleStepperClick` in `messageHandlers.ts` only sends a content update message. It must also persist the step change.

### R005 — Add `specName` to spec-context.json

When creating `specContextInstruction` (the context object), add `specName` to the persisted `.spec-context.json`. This is the human-readable name derived from the directory slug (e.g., `046-spec-viewer-header-redesign` → `Spec Viewer Header Redesign`).

### R006 — Add `branch` to spec-context.json

Store the feature branch name in spec-context.json. Show it as a secondary badge in the header (e.g., a muted branch icon + branch name next to the file link).

### R007 — Clarify or remove `selectedAt`

The `selectedAt` field's purpose is unclear. Either:
- Document it clearly (it tracks when the workflow was first selected/assigned to this spec), or
- Remove it if it duplicates `stepHistory.specify.startedAt`

### R008 — Strip spec metadata from rendered markdown

Since the header now shows badge, date, title, and status from spec-context.json, the raw YAML-like metadata block at the top of spec files (Feature Branch, Created, Status, Input) should be stripped from the rendered markdown to avoid duplication.

## Scenarios

### Viewing a spec with full context

Given a spec with a populated `.spec-context.json` (step: "plan", specName: "Spec Viewer Header Redesign", branch: "046-spec-viewer-header-redesign"), the header shows:
- Badge: `PLANNING` in primary color
- Date: `Created: 2026-04-05`
- Title: `Plan: Spec Viewer Header Redesign`
- File link: `plan.md` (clickable)

### Viewing an in-progress step

Given `step: "implement"` and `substep: "coding"`, the badge shows `IMPLEMENTING...` with animated ellipsis to indicate active work.

### Clicking a step tab

User clicks the "Tasks" tab. The extension:
1. Updates spec-context.json: `currentStep: "tasks"`, adds `stepHistory.tasks.startedAt`
2. Switches the viewer to show tasks.md content
3. Header title updates to `Tasks: Spec Viewer Header Redesign`

### Spec without spec-context.json

Falls back to current behavior: no badge, date derived from file stats, title from first H1 in markdown.

### Branch badge display

With `branch: "046-spec-viewer-header-redesign"` in context, a muted branch badge appears near the file link showing the branch name.

## Files Likely Affected

- `src/features/spec-viewer/html/generator.ts` — header HTML generation
- `src/features/spec-viewer/phaseCalculation.ts` — badge text, date computation
- `src/features/spec-viewer/messageHandlers.ts` — step click persistence
- `src/features/specs/specContextManager.ts` — add specName/branch fields
- `webview/src/spec-viewer/navigation.ts` — header DOM updates
- `webview/styles/spec-viewer/_content.css` — badge/header styling
- `src/features/spec-viewer/specViewerProvider.ts` — pass new data to HTML generator
- `src/features/workflows/types.ts` — update FeatureWorkflowContext type
