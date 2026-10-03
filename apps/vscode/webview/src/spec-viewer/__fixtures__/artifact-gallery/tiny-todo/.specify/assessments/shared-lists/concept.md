# Concept: Shared todo lists

- **Slug**: shared-lists
- **Created**: 2026-10-03
- **Recommended option**: A — Do nothing for now (not proceeding; revisit as Option B if a real requester appears)

## Options

### Option A — Do nothing
- **Sketch**: The app stays a private, single-user list. People who need to share keep using chat or another app.
- **Appetite**: small (no work)
- **Trade-offs**: Wins: honors the constitution (Principle III, no network) and the "tiny" purpose, zero risk to solo users. Sacrifices: the two-person goal stays unmet. Cost is real only if a requester exists, and none is on record.
- **Rabbit holes**: none.

### Option B — Share by file or link (no network)
- **Sketch**: One person exports the list as a file (or a link holding a snapshot). The other imports it and the app merges the two lists, keeping items from both. Sharing is a manual hand-off, not live sync. Still fits the constitution as written, since nothing is stored or synced over the network.
- **Appetite**: medium (weeks). Uncertain: merge rules and conflict messages are unscoped.
- **Trade-offs**: Wins: no backend, no accounts, solo use untouched, closest to "no item silently lost". Sacrifices: not live, needs a manual step each time, and a link puts todo text into URLs and browser history (privacy).
- **Rabbit holes**:
  - Merge of edits and deletions with no timestamps or versions (item ids are `Date.now()` and can collide).
  - Link size limits for long lists.
  - Accessible (WCAG AA) UI for import and conflict messages.

### Option C — Live shared list on a backend
- **Sketch**: Two people open the same list from different devices and see each other's changes shortly after they happen, through a hosted service and a share link.
- **Appetite**: large (months). Needs a constitution amendment first.
- **Trade-offs**: Wins: the full goal, works across devices. Sacrifices: reverses Principle III (MAJOR amendment), needs hosting and ongoing cost, adds identity and privacy concerns, and the app grows well beyond its 42 lines. Principle I forbids a third-party sync library, so sync would be hand-built.
- **Rabbit holes**:
  - Conflict resolution for concurrent edits.
  - Who owns the data and for how long.
  - Abuse, link guessing, and deletion of shared lists.
  - Migrating existing local items.

## Recommendation

Option A: do not build yet. There is no requester, no trigger, and no demand signal, while Option C collides with a MAJOR constitutional principle and Option B adds the largest feature in the app for an unproven need. If a real pair of users confirms the need, start with Option B: it is the smallest option that meets the goals without breaking the constitution. Option C is only worth a conversation if the owner chooses to amend Principle III.

## Out of Scope (for the recommended option)

- Any sharing, sync, or merge work (nothing is built under Option A).
- If Option B is later chosen: live updates, accounts, groups larger than two, read-only roles, multiple named lists, notifications, and changes to how a solo list works.

## Assumptions to Validate

- A real requester exists or can be found. Not yet confirmed.
- Two people sharing via a manual hand-off (Option B) would be acceptable, versus needing live sync.
- The project owner wants to keep Principle III as written.
- Same-device sharing is not the actual need (it already half-works through `localStorage` across tabs, an unverified assumption).
- A snapshot link or file is an acceptable privacy trade-off.
