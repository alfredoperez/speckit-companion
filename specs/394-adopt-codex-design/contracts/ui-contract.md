# UI Contract: Adopt the Codex Redesign in the Spec Viewer

**Feature**: 394-adopt-codex-design · **Date**: 2026-07-13

Two halves: the **frozen interfaces** this adoption must not move (consumers exist on both sides), and the **new presentation contract** stories and tests code against.

## Frozen — must not change

### Extension ↔ webview message protocol

Unchanged in name, shape, and meaning:

- Webview → extension: `ready`, `stepperClick { phase }`, `switchDocument { documentType }`, `resumeRun`, `setStatus`, footer action messages (approve/regenerate/archive/complete/reactivate/refine), comment persistence messages.
- Extension → webview: `contentUpdated { content, navState, viewerState }`, `navStateUpdated`, `viewerStateUpdated`, `documentsUpdated`, `fileDeleted`, `actionToast`, `error`.

### Emitted markdown classes (styling hooks only — markup frozen)

`.spec-meta` `.meta-*` · `.user-story-header` `.story-id` `.story-priority` · `.phase-header` `.phase-num` `.phase-chip` · `.req-row` `.req-badge` `.req-text` · `.entity-row` · `.ck-group` `.ck-item` `.ck-box` · `.md-collapsible` `.tech-grid` `.tech-cell` · `.con-row` `.verdict` · `.decision-card` `.decision-num` `.decision-field` · `.callout*` · `pre.code-block[data-lang]` `.mermaid-container` `pre.tree-structure` · `.task-item__*` `.task-details` · `.line` `.line-add-btn` `.line-content` `.line-comment-slot` · `.template-instructions`.

### Behavioral matrix

`docs/viewer-states.md` remains the authority for status → badge/step/action rendering; this feature updates its *visual descriptions* only, never its transitions. Living mode: `NavState.livingMode` suppresses stepper + footer, tiers render as tabs. Recovery affordances (`StaleBanner`, `runRecovery`, file-deleted state) keep their triggers.

## New — the shell presentation contract

Class roles adopted from the Codex system (final names live in the shipped partials; stories exercise them):

| Region | Contract |
|---|---|
| Shell top | title, subtitle (branch/workflow), and status badge; the two-state **view switch** (`Overview` / `Documents`, `aria-pressed` semantics) sits at the top of the document rail (Context-First revision) |
| Document rail | `nav[aria-label="Spec documents"]`; grouped lists (Pipeline / Artifacts, or the workflow's own name); each button carries a **rail mark** expressing completion independent of `aria-current="page"` selection; action-only steps render marked as actions; producing no document of their own, they open the nearest earlier document they run from (Implement → Tasks), or stay inert when there is none |
| Reading column | prose capped ≈72ch; heading TOC remains inside the column; empty `.spec-meta` and `details.template-instructions` hidden |
| Run strip | `[aria-label="Run context"]` one-line strip above the content; facts rendered only when present; "Run details" jumps to the Overview (Context-First revision — replaces the permanent aside column) |
| Footer | context line (next-step sentence), optional **Other actions** menu (workflow `enhancementButtons`), primary CTA labeled by `getApproveLabel()`; in-flight states render no CTA |
| Code | `pre.code-block` on the owned always-dark code surface in both themes, language chip from `data-lang` |
| Comments | line-anchored comment cards + composer preserved; pending items surface as the **refinement queue** with a count |

### Accessibility invariants (carried from repo rules)

`.sr-only` (not `display:none`) for text referenced by `aria-describedby`/`labelledby`; `aria-busy` on the content region; visible `:focus-visible` outline (`--cx` accent, 2px offset); `prefers-reduced-motion` collapses all animation; WCAG AA per spec SC-003.
