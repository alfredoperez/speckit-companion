# Implementation Plan: Nest a step's artifact files under it in the viewer rail

**Spec**: [spec.md](./spec.md)
**Tasks**: [tasks.md](./tasks.md)

## Summary

The spec-viewer document rail (`NavigationBar`) renders workflow steps in a **Pipeline** group, then renders each step's artifact files in *separate* labeled `rail-group` blocks below ("Plan files", "Specification files"). This decouples a file from the step that produced it. This change nests each step's related artifact docs as indented sub-items directly under that step inside the Pipeline group, keeping the Overview entry on top and every artifact one click away. It is a rendering-only change — no data model, capture, or message-protocol change.

## Context

- **Language/Runtime**: TypeScript 5.3+ (ES2022, strict), Preact webview.
- **Component**: `webview/src/spec-viewer/components/NavigationBar.tsx` (rail), `StepTab.tsx` (per-step button, unchanged), `_navigation.css` (styles).
- **Existing signal used**: each `relatedDoc` carries `parentStep`; `NavigationBar` already computed per-step `hasRelatedChildren` and grouped related docs by `parentStep || rootPhase`.

## Research

- **Current shape** (NavigationBar.tsx): after the Pipeline `rail-group` (`.step-tabs` of `StepTab`s), a `groups[]` array is built from `relatedDocs` keyed by `parentStep || rootPhase`, and each group renders as its own `rail-group` with a `<Step> files` label and a `.step-children-tabs` column of `.step-child` buttons. This is the "separate sections below" the ticket flags — the deliberate choice noted in a code comment ("instead of a per-step second row").
- **Reachability of hidden-parent artifacts**: a related doc can point at a hidden action step (e.g. `implement`). The existing tests assert such an artifact still renders in a group labeled "Implement files". Nesting only covers *visible* parents, so hidden-parent artifacts need a fallback group to stay reachable (FR-007).
- **Accessibility**: sub-items must read as a nested list (FR-008). A `<ul>`/`<li>` around the sub-item buttons gives list semantics for free; the parent step remains a `<button>` (StepTab) preceding its nested list.
- **Living mode**: the `ns.livingMode` early-return path renders a flat tier strip and has no pipeline steps — untouched.

## Design

1. **Per-step nesting (NavigationBar.tsx)**: In the Pipeline `rail-group`, for each rendered `railDocs` step, compute `children = relatedDocs.filter(d => d.exists && (d.parentStep || rootPhase) === doc.type)`. Render `<StepTab>` then, when `children.length > 0`, an indented `<ul class="step-substeps">` of `<li>` items each holding a `.step-child` button (same click → `handleRelatedClick`, same active/`aria-current` logic as today). Wrap the `StepTab` + its list in a `step-tab-group` container so the nested list visually belongs to the step.
2. **Orphan fallback (NavigationBar.tsx)**: Build `railTypes = new Set(railDocs.map(d => d.type))`. Keep a single trailing `rail-group` **only** for orphan related docs — `d.exists && !railTypes.has(d.parentStep || rootPhase)` — grouped by their `parentStep`, labeled `<Step> files` (or `Artifacts`), exactly the current group rendering. Visible-parent groups are removed.
3. **CSS (_navigation.css)**: Add `.step-substeps` — a list reset (`list-style:none; margin/padding 0`) with a compact left indent so children sit visually under their step, reusing the existing `.step-child` chip styles. Keep `.step-children-tabs` for the living tier strip and the orphan fallback.
4. **Stories / tests / docs / changelog**: update `NavigationBar.stories.tsx` (nested-under-step layout across multiple steps), extend `NavigationBar.test.tsx` (nested-under-parentStep, Overview first, action steps hidden, orphan fallback, click dispatch), update `docs/sidebar.md`, add a root `CHANGELOG.md` Unreleased entry.

## Constitution / Invariants Check

- **Webview invariants**: sub-item buttons carry user-authored `label` as element **content** (`{child.label}`), never interpolated into an attribute — safe. No `innerHTML`. Click handlers are Preact `onClick` on real buttons (no `e.target.closest` delegation added). Text truncation stays on `.step-child`/`.step-label` which already carry the ellipsis trio; the nested `<ul>` gets `min-width:0` where it can shrink.
- **Design tokens**: sub-items reuse `.step-child` tokens (already `--text-secondary` → `--text-primary` on hover/active). No new low-contrast body text.
- **#516 regression guard**: action steps are filtered out of `railDocs` upstream (`category !== 'action'`); nesting iterates `railDocs`, so Implement/Mark Complete stay hidden.

## Risk / Rollback

Rendering-only; rollback is reverting `NavigationBar.tsx` + `_navigation.css`. No persisted state or protocol touched.
