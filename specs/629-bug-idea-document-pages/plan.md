# Implementation Plan: Document pages for bugs and ideas

**Branch**: `629-bug-idea-document-pages` | **Date**: 2026-10-04 | **Spec**: [bug-idea-document-pages.spec.md](./bug-idea-document-pages.spec.md)

**Scale note**: About 25 files across four areas: a new pure parsing and model layer, the viewer's host side, the viewer's webview, and Storybook with fixtures and docs. Watch the seam between host and webview: the page model is built on the host and travels in the initial nav state, because a report panel re-renders its whole HTML on every tab switch and file change.

## Summary

A bug opens on a Story tab and a decided idea's Decision stage opens as a decision page. Both are Preact pages rendered inside the viewer's existing content element, so the reading column, the outline and the footer keep working. The page content comes from a new model built on the host from the report files by pure functions that take text and return typed data, which lets Storybook build the same pages from fixture files. The prototype's Document look is ported as one new stylesheet partial on existing tokens.

## Project Structure

```text
apps/vscode/src/features/reports/
├── reportValues.ts        new: knownValue and parseReportHeader, free of fs
├── reportSet.ts           re-exports them; reportDocuments gains the Story entry
├── reportDoc.ts           new: fence-aware section, table, list and field reader
├── bugStory.ts            new: buildBugStory(texts, nextAction) -> BugStory | undefined
├── ideaDecision.ts        new: buildIdeaDecision(text) -> IdeaDecision | undefined
└── __tests__/             reportDoc, bugStory, ideaDecision tests

apps/vscode/src/features/bugs/bugValues.ts      new: the four bug allow-lists, free of fs
apps/vscode/src/features/ideas/ideaValues.ts    new: idea verdicts, stages, ratings, free of fs
apps/vscode/src/features/bugs/bugReports.ts     imports the lists from bugValues
apps/vscode/src/features/ideas/ideaReports.ts   imports the lists from ideaValues

apps/vscode/src/protocol/viewer.ts              NavState.report
apps/vscode/src/features/spec-viewer/
├── reportPanels.ts        readReportPanel returns the page model and the default document
├── specViewerProvider.ts  showReport landing, updateReportContent passes the model
├── html/generator.ts      one more argument, folded into the initial nav state
└── __tests__/bugPanel.test.ts, ideaPanel.test.ts

apps/vscode/webview/src/spec-viewer/
├── App.tsx                renders the page inside #markdown-content when there is one
├── report-pages/
│   ├── BugStoryPage.tsx
│   ├── IdeaDecisionPage.tsx
│   ├── fragments.tsx      Prose and Inline: markdown fragments without ids or comment buttons
│   └── __tests__/
├── components/StepTab.tsx, NavigationBar.tsx   report rail: label and disabled rule
└── __stories__/ReportPages.stories.tsx         nine states; BugReport.stories.tsx trimmed

apps/vscode/webview/styles/spec-viewer/_report-pages.css   new partial, registered in index.css
apps/copilot-canvas/vendor/viewer.css                      rebuilt
apps/vscode/tests/fixtures/bug-reports/.specify/bugs/      two new bugs: test failed, invalid
apps/vscode/tests/fixtures/idea-reports/.specify/assessments/  two new ideas: go and needs-clarification with scorecards
apps/website/src/content/docs/docs/processes/fix-a-bug.mdx, assess-an-idea.mdx, navigate/inside-the-viewer.mdx
CHANGELOG.md
```

**Structure Decision**: Parsing and models live in `features/reports/` as pure functions; the host calls them from `readReportPanel` and stories call them directly; the webview only lays a model out.

## Constitution Check

| Principle | Assessment |
| --- | --- |
| I. Extensibility and Configuration | PASS. No new setting. The pages read Spec Kit's own report files and add nothing to them. |
| II. Spec-Driven Workflow | PASS. Spec, plan and tasks for this change live in `specs/629-bug-idea-document-pages/`. |
| III. Visual and Interactive | PASS. This is the visual layer for two processes, reviewed in Storybook before it ships. |
