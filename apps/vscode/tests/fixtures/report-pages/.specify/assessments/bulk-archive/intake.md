# Idea Intake: Bulk archive for old orders

- **Slug**: bulk-archive
- **Created**: 2026-10-03
- **Source**: pasted text (repo: this small orders admin app)
- **Type**: new-capability

## Idea (as captured)

> "add a way to archive a lot of old orders at once, the list is getting slow."

Run mode: headless, no one available to answer questions; defaults chosen.

## Restated

A person would select many orders, or every order older than some date, and move them out of the main orders list in one action. Today an order can only be archived one at a time from its detail page (`src/orders/detail.js`).

## Origin & Context

- **Raised by**: [NEEDS CLARIFICATION: who asked]
- **Trigger**: the orders list "is getting slow", with no measurement attached

## First-Glance Unknowns

- [NEEDS CLARIFICATION: Is the goal a faster list, a tidier list, or both? A slow list may not need archiving at all.]
- [NEEDS CLARIFICATION: How many orders is "a lot": hundreds, or tens of thousands?]
- [NEEDS CLARIFICATION: Can an archived order be restored, and by whom?]
- [NEEDS CLARIFICATION: Do archived orders still count in reports and exports?]
- [NEEDS CLARIFICATION: Is there a retention rule that says how long an order must stay visible?]
