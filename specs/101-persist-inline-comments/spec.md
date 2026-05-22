# Spec: Persist inline review comments + Activity view

**Slug**: 101-persist-inline-comments | **Date**: 2026-05-21

## Summary

Make inline review comments durable and resumable. Today comments live only in an in-memory Preact signal and hit disk solely when the user clicks **Refine** (appended to per-document `<doc>-extra.md` scratchpad files), so an in-progress review is lost when the tab closes and can't be committed or picked up later. This feature persists each comment to the spec's `.spec-context.json` the moment it is added/edited/removed, restores comments inline when the spec reopens (best-effort re-anchoring to the nearest matching heading when the source block has changed), and surfaces a consolidated cross-document review list in the **Activity** panel — decoupling *annotating* a spec from *running the refinement agent*. The separate `<doc>-extra.md` scratchpad path and its read-only "Notes" sub-tab are removed.

## Requirements

- **R001** (MUST): A review comment is persisted to the spec's `.spec-context.json` the moment it is added, edited, or removed — not only on Refine. Each stored comment records the document it targets (`spec` | `plan` | `tasks`), an anchor (nearest preceding heading + source block text + line number), the comment text, a stable id, a status (`pending` | `applied`), and a created timestamp.
- **R002** (MUST): When a spec is reopened (new tab, later session, another machine, or another developer after a pull), every persisted comment is restored inline anchored to its source location.
- **R003** (MUST): Restore re-anchors a comment by matching its stored block text; if the exact block no longer matches (source was edited), it best-effort re-anchors to the nearest matching heading rather than dropping the comment. A comment is never silently lost.
- **R004** (MUST): Comment storage moves entirely off the per-document `<doc>-extra.md` scratchpad files. The extension stops writing those files for review comments and stops surfacing the per-document read-only "Notes" / scratchpad sub-tab.
- **R005** (MUST): The Activity panel shows a consolidated list of all comments across spec/plan/tasks, each with its status (pending / applied), a jump-to-line action, and a per-document **Run refinement** action that dispatches that document's pending comments to the AI.
- **R006** (MUST): On a successful Refine, the comments that were submitted are marked `applied` in `.spec-context.json` and kept there as history — they are not deleted and no separate file is written.
- **R007** (MUST): The existing inline UX is preserved unchanged — the line-hover "+" affordance, the comment card, and the comment dialog stay exactly as they are; persistence is layered onto them, not a replacement.
- **R008** (MUST): All writes to `.spec-context.json` go through the extension's `specContextWriter` surface (the webview posts add/edit/remove/refine messages to the extension); the webview never writes the file directly, and existing context fields and the transition log are preserved on every write.
- **R009** (SHOULD): The Activity panel is the power-user overview, not a dependency: when the Activity panel is toggled off, inline comments still work and still persist; only the cross-document consolidated list is unavailable.
- **R010** (SHOULD): A pending comment count remains visible on the inline Refine affordance (today's `✨ Refine (N)` button) so the inline surface still communicates how many comments are queued for a document.

## Scenarios

### Persist on add

**When** a user adds an inline comment on a line of `spec.md` in the viewer
**Then** the comment is written to that spec's `.spec-context.json` immediately (before any Refine), with its document, anchor (heading + block + line), text, `pending` status, and timestamp.

### Restore on reopen (unchanged source)

**When** a spec with persisted pending comments is reopened in a fresh viewer tab
**Then** each comment re-renders inline at its anchored line with the same card UI it had when created.

### Restore with drifted source (best-effort re-anchor)

**When** a spec is reopened after its source markdown was edited so a stored comment's exact block no longer matches
**Then** the comment is re-anchored to the nearest matching heading and still shown (with an indication it was re-anchored), never dropped.

### Activity-tab consolidated review

**When** the user opens the Activity panel for a spec that has comments across `spec.md` and `plan.md`
**Then** a single list shows all comments grouped by document, each with status, a jump-to-line control, and a per-document **Run refinement** button.

### Mark applied on refine

**When** the user runs refinement for a document and the AI edit dispatch succeeds
**Then** that document's submitted comments flip from `pending` to `applied` in `.spec-context.json`, remain in the consolidated list as history, and no `<doc>-extra.md` file is written.

### Scratchpad path removed

**When** the viewer scans a spec's documents
**Then** no `<doc>-extra.md` "Notes" sub-tab is synthesized or shown, and refinement no longer appends to those files.

## Non-Functional Requirements

- **NFR001** (MUST): Persisting a comment must not clobber concurrent extension-side writes to `.spec-context.json` — writes go through `specContextWriter` and preserve all existing fields, `transitions`, and step history (per the extension-isolation rule that only shipped extension code writes user-local files).
- **NFR002** (SHOULD): Restore-on-open re-anchoring runs on the comment set for a single spec without a perceptible delay on viewer load for typical specs (tens of comments).
- **NFR003** (SHOULD): A `.spec-context.json` written by an older extension version (no review-comments field) opens without error, and a context with review comments degrades gracefully in an older viewer (unknown field preserved, ignored).

## Out of Scope

- Real-time multi-user collaboration / live sync between concurrent editors.
- Threaded replies, reactions, or @-mentions on comments.
- Changes to the refinement prompt the AI receives.
- Keeping or migrating the old `<doc>-extra.md` files — they are explicitly removed (this supersedes spec 096-scratchpad-extras).
- A cross-document consolidated list when the Activity panel is toggled off — the inline surface remains the always-on primary path.
