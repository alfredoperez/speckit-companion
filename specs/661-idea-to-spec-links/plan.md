# Implementation Plan: A spec made from an idea keeps it

## Summary

`ideaSpecDescription` in `processActions.ts` builds the Create Spec text from the idea's title, its lead and rationale, every go handoff field, and `Source: <folder>`; the `idea.createSpec` handler uses it. The specify `draft-spec` node accepts a `Source:` assessment folder as the ticket, so `finalize` records it as `source`. On the host, `specsFromIdea` in `reportPanels.ts` lists specs whose record `source` matches the idea folder, and `updateReportContent` passes them on `ReportNav.specs`; `IdeaDecisionPage` lists them and posts `openFile`. The Overview's `SourceValue` turns a folder path into a button that posts a new `openIdea` message; `handleOpenIdea` resolves it under the project root and opens the idea page only when it is an idea folder.

## Key Decisions

- **Reuse `source`, not a new record field.** w29 already shows it; the folder is the ticket.
- **A new `openIdea` message.** `openFile` would open the report as raw markdown.
- **The host decides what a folder is.** The webview only offers the click; the handler checks the root and the idea set.
