# Idea Intake: Shared todo lists

- **Slug**: shared-lists
- **Created**: 2026-10-03
- **Source**: pasted text (repo: this tiny browser todo app)
- **Type**: new-capability

## Idea (as captured)

> "let two people share one todo list in this tiny browser todo app."

Run mode: headless, no one available to answer questions; defaults chosen.

## Restated

Two people would view and edit the same todo list from their own browsers. Today the list lives only in one browser's `localStorage` (`src/store.js`, key `tiny-todo.items`), with no backend or user identity.

## Origin & Context

- **Raised by**: [NEEDS CLARIFICATION: who asked]
- **Trigger**: [NEEDS CLARIFICATION: what prompted it]

## First-Glance Unknowns

- [NEEDS CLARIFICATION: Same device or different devices? The first needs no backend, the second does.]
- [NEEDS CLARIFICATION: Live sync, or refresh to see changes?]
- [NEEDS CLARIFICATION: How is a list shared (link, invite, account)? The app has no user identity today.]
- [NEEDS CLARIFICATION: Can both people edit, or is one read-only?]
- [NEEDS CLARIFICATION: Is hosting a backend acceptable for a client-only app?]
- [NEEDS CLARIFICATION: What happens to existing local items?]
