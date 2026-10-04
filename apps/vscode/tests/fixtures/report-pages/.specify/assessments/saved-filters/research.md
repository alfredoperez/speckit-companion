# Idea Research: Saved filters for the orders list

- **Slug**: saved-filters
- **Created**: 2026-10-03
- **Evidence confidence (overall)**: medium (repo and requester evidence is high; usage numbers are self-reported)

Scope: repo, `.specify/` and the intake answers. No web fetches. External claims are marked ASSUMPTION.

## Users & Demand

- A named requester exists: the support lead, speaking for four people who open the orders list every shift. — [source: `.specify/assessments/saved-filters/intake.md`] (confidence: high)
- The team rebuilds the same filter about once per person per shift, three clicks and one typed date each time. — [source: intake answers, self-reported] (confidence: medium)
- Two earlier issues ask for the same thing in different words ("remember my filters", "default view for unshipped"). — [source: `docs/backlog.md`] (confidence: high)

## Prior Art

- **Internal:** the column picker already stores a per-user preference under the `orders.columns` key through `src/prefs.js`. — [source: `src/prefs.js`, `src/orders/columns.js`] (confidence: high)
- **Current filters:** a plain object `{status, from, to, customer}` held in component state and serialized into the query string. — [source: `src/orders/filters.js`] (confidence: high)
- **External:** saved views are standard in admin tools (issue trackers, mail clients). — [source: ASSUMPTION] (confidence: low)

## Market & Context

- **Today's workaround:** two people keep a browser bookmark of the filtered URL. It breaks for date ranges, because the URL stores absolute dates. — [source: intake answers; `src/orders/filters.js`] (confidence: high)
- **Cost of doing nothing:** the rebuild continues every shift, and the bookmark workaround keeps showing stale date ranges. — [source: intake answers] (confidence: medium)

## Data & Constraints

- **Storage is already there.** `src/prefs.js` reads and writes per-user JSON, with a test seam that injects the store. — [source: `src/prefs.js`, `src/prefs.test.js`] (confidence: high)
- **Dates are absolute today.** A saved "older than 3 days" needs a relative form, which the filter object does not have. — [source: `src/orders/filters.js`] (confidence: high)
- **No sharing model exists.** Preferences are per user, with no team scope. — [source: `src/prefs.js`] (confidence: high)

## Evidence Against the Idea

- **A bookmark covers half of it.** Filters with no date range already survive as a URL. — [source: `src/orders/filters.js`]
- **Usage numbers are self-reported.** The app has no analytics on filter use. — [source: repo scan]

## Gaps & Open Questions

- [NEEDS CLARIFICATION: Private or team-shared filters? Private fits `src/prefs.js` as it is.]
- [NEEDS CLARIFICATION: Which relative date forms are needed beyond "older than N days"?]

## Sources

- `.specify/assessments/saved-filters/intake.md` (local file)
- `src/orders/filters.js`, `src/orders/columns.js`, `src/prefs.js`, `src/prefs.test.js`, `docs/backlog.md` (local files)
- No URLs fetched. No hosts contacted (policy: none needed).
