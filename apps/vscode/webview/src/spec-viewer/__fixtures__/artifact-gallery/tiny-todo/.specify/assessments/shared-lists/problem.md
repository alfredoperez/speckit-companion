# Problem Definition: Shared todo lists

- **Slug**: shared-lists
- **Created**: 2026-10-03
- **Inputs used**: intake.md, research.md

## Problem Statement

Two people who need to track the same tasks cannot see or edit one list: each browser holds a private list, so they fall back on copying items to each other by hand or using another app. [NEEDS CLARIFICATION: the trigger and the real frequency are unknown; no demand evidence exists.]

## Affected Users & Stakeholders

- **Users**: [NEEDS CLARIFICATION: pairs who share tasks (couple, roommates, coworkers)? Not stated in intake.] Today each has a separate, private list.
- **Stakeholders**: Project owner, who decides whether the app's privacy and no-network purpose may change. The constitution (v1.0.0) is the standing constraint on that decision.

## Goals

- Two people keep one agreed set of todos without copying items by hand.
- Each person sees the other's changes without losing their own.
- The app stays tiny and easy to use for a person who never shares.

## Non-Goals

- Accounts, profiles, or permissions beyond what two people sharing needs.
- Groups larger than two people.
- Multiple named lists, due dates, or notifications.
- Changing how a solo user's list works.

## Success Metrics

- Two people complete a shared add, edit, and check-off round trip with no manual copying (qualitative; baseline: not possible).
- No item is silently lost when both people edit (baseline: not applicable, single writer today).
- Solo use is unchanged (qualitative; baseline: current behavior).
- Adoption or usage targets: [NEEDS CLARIFICATION: the app has no telemetry, so none can be measured.]

## Cost of Inaction

The app stays a private, single-user list, which matches its stated purpose and its constitution. Anyone who needs to share keeps using chat or another app. The cost is real only if a requester exists, and none is on record.

## Open Questions

- [NEEDS CLARIFICATION: Who wants this, and what prompted it?]
- [NEEDS CLARIFICATION: Same device or different devices? This decides whether Principle III (no network) blocks the work.]
- [NEEDS CLARIFICATION: Is the constitution open to amendment, or must the idea fit it as written?]
- [NEEDS CLARIFICATION: Live updates, or refresh to see changes?]
- [NEEDS CLARIFICATION: Can both people edit, or is one read-only?]
- [NEEDS CLARIFICATION: What happens to existing local items when a list becomes shared?]
