# Implementation Plan: The bug page shows the whole folder and real times

## Summary

`reportDocuments` in `reportSet.ts` appends `extraReports`: the other `.md` files in a bug folder that stay inside it, evidence first. `buildBugStory` takes `writtenAt` (file mtimes, read by the bugs reader in `reportPanels.ts`) and, when a header has no time, uses it for the step's clock and the gap from the previous step. `BugStoryPage` turns an http(s) Source into a Tracker link through `safeUrl`.

## Key Decisions

- **Extra tabs for bugs only.** Idea folders have a fixed stage list.
- **Machine times are labelled.** Git drops file times on clone, so the label says where the time came from.
