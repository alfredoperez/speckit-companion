# Implementation Plan: The Overview names the ticket

## Summary

Carry `source`, `extends` and `supersedes` through `deriveViewerState` into both `ViewerState` types, render them as rows in the Intent card's context column (`OverviewDossier.tsx`), and let the Specs filter match the source on its own. A source links only when it is an http(s) URL that `safeUrl` accepts, since `safeUrl` alone treats colon-free text such as TODO-42 as a relative link.

## Key Decisions

- **Rows in the existing context column, beside Working area and Size.** Rejected: a new header line, which the Overview no longer has.
- **Match the source separately.** Joining it to the name would let a fuzzy query match across the boundary.
- **Clips regenerate in release QA,** as for the earlier Overview changes this cycle; the stories are updated now.
