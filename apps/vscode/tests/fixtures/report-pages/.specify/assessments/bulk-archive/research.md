# Idea Research: Bulk archive for old orders

- **Slug**: bulk-archive
- **Created**: 2026-10-03
- **Evidence confidence (overall)**: low (repo evidence is high; the cause of the slowness and the demand are both unverified)

Scope: repo and `.specify/` only. No web fetches (headless, time-boxed). External claims are marked ASSUMPTION.

## Users & Demand

- No requester is on record. The intake has a trigger ("the list is getting slow") but no name. — [source: `.specify/assessments/bulk-archive/intake.md`] (confidence: high that the signal is missing)
- One backlog note mentions the orders page taking "a few seconds" to load, with no numbers. — [source: `docs/backlog.md`] (confidence: medium)
- No analytics or timing data exist for the orders list. — [source: repo scan: `src/orders/*`, `package.json`] (confidence: high)

## Prior Art

- **Internal:** single-order archive exists. It sets `archived_at` on the order, and the list query filters on `archived_at IS NULL`. — [source: `src/orders/detail.js`, `src/orders/query.js`] (confidence: high)
- **The list is not paginated.** `listOrders` returns every unarchived order and the page renders all of them. — [source: `src/orders/query.js:14`, `src/orders/list.js`] (confidence: high)
- **External:** bulk actions on a selection are common in admin tools. — [source: ASSUMPTION] (confidence: low)

## Market & Context

- **Today's workaround:** open each old order and archive it, one page load per order. — [source: `src/orders/detail.js`] (confidence: high)
- **Cost of doing nothing:** the list keeps growing by every order ever placed, so the load time keeps rising. — [source: `src/orders/query.js`; ASSUMPTION on the rate of growth] (confidence: medium)

## Data & Constraints

- **Archived orders leave the CSV export.** The export reuses `listOrders`, so a bulk archive would silently shrink the monthly export. — [source: `src/export.js:4`] (confidence: high)
- **No restore path.** Nothing in the app clears `archived_at`. — [source: repo scan for `archived_at`] (confidence: high)
- **No retention rule is written down.** — [source: `docs/`, `.specify/memory/constitution.md`] (confidence: high that none exists in the repo)

## Evidence Against the Idea

- **The slowness has a simpler likely cause.** An unpaginated list that renders every row is slow regardless of archiving, and pagination would fix it without removing anything. — [source: `src/orders/query.js`, `src/orders/list.js`]
- **A bulk action with no restore is risky.** One wrong date archives thousands of orders with no way back. — [source: repo scan]
- **It changes the export.** Archived orders drop out of the monthly CSV. — [source: `src/export.js`]

## Gaps & Open Questions

- [NEEDS CLARIFICATION: Is the list slow because of row count in the page, or the query? Nothing was measured.]
- [NEEDS CLARIFICATION: Who asked, and do they want old orders gone from view or just a faster page?]
- [NEEDS CLARIFICATION: Must archived orders stay in the monthly export?]
- [NEEDS CLARIFICATION: Is there a retention requirement for orders?]

## Sources

- `.specify/assessments/bulk-archive/intake.md` (local file)
- `src/orders/query.js`, `src/orders/list.js`, `src/orders/detail.js`, `src/export.js`, `docs/backlog.md` (local files)
- No URLs fetched. No hosts contacted (policy: none needed).
