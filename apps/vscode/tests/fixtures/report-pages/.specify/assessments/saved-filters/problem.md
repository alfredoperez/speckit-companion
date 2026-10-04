# Problem Definition: Saved filters for the orders list

- **Slug**: saved-filters
- **Created**: 2026-10-03
- **Inputs used**: intake.md, research.md

## Problem Statement

People who work the orders list every shift rebuild the same filter by hand each time they open it, because filters reset on page load and the bookmark workaround freezes the date range on the day it was made.

## Affected Users & Stakeholders

- **Users**: the four-person support team, who open the orders list at the start of every shift and filter it to unshipped orders older than three days.
- **Stakeholders**: the support lead, who raised it, and the app owner, who decides what gets stored per user.

## Goals

- A person reapplies a filter they use often in one click.
- A saved filter with a date rule shows the right orders on any day it is opened.
- The orders list works exactly as before for someone who never saves a filter.

## Non-Goals

- Sharing a saved filter with the team.
- A default filter applied automatically on page load.
- Saved filters on any list other than orders.
- Scheduled exports or alerts driven by a saved filter.

## Success Metrics

- Reapplying the daily filter takes one click instead of three clicks and a typed date (baseline: self-reported, once per person per shift).
- A filter saved with "older than 3 days" returns the correct orders a week later (baseline: the bookmark workaround returns a stale range).
- No change in behaviour for a person with no saved filters (qualitative; baseline: current behaviour).

## Cost of Inaction

The team keeps rebuilding the filter every shift. The two people using bookmarks keep seeing a frozen date range, which has already hidden late orders at least once according to the support lead.

## Open Questions

- [NEEDS CLARIFICATION: Which relative date forms are needed beyond "older than N days"?]
- [NEEDS CLARIFICATION: Is there a limit on how many filters one person can save?]
