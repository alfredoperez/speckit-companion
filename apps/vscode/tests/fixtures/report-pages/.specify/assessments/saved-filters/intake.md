# Idea Intake: Saved filters for the orders list

- **Slug**: saved-filters
- **Created**: 2026-10-03
- **Source**: pasted text (repo: this small orders admin app)
- **Type**: enhancement

## Idea (as captured)

> "let me save the filters I set on the orders list so I don't have to rebuild them every morning."

Run mode: interactive, the support lead answered the intake questions.

## Restated

A person using the orders list would name the current combination of status, date range and customer filters, and reapply it later in one click. Today the filters live only in component state (`src/orders/filters.js`) and reset on every page load.

## Origin & Context

- **Raised by**: support lead, on behalf of a team of four
- **Trigger**: the team rebuilds the same "unshipped, older than 3 days" filter at the start of every shift

## First-Glance Unknowns

- [NEEDS CLARIFICATION: Are saved filters private to one person, or shared across the team?]
- [NEEDS CLARIFICATION: Should a relative date ("older than 3 days") stay relative when it is saved?]
- [NEEDS CLARIFICATION: Is there a limit on how many filters one person can save?]
