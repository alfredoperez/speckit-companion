# Tasks: Inline comments that annotate, not interrupt

**Feature**: `398-inline-comment-polish` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Line format: `- [ ] **T###** [P?] [US#] Description · exact/file/path`

## Phase 1: Setup

No setup. Every file this feature touches already exists and the toolchain is unchanged.

## Phase 2: Foundational (blocks every story)

The shared types and the persistence mutation every story below reads or writes.

**Wave 1 — independent (different files):**

- [x] **T001** [P] Add `status: ReviewCommentStatus` (defaulting to pending) to the webview `Refinement` type, and add the `editComment` message to `ViewerToExtensionMessage` · `webview/src/spec-viewer/types.ts`
- [x] **T002** [P] Add the pure `editComment(ctx, id, text)` mutation next to `addComment` / `removeComment` / `markApplied` — replaces only the `comment` field, carries every other field through untouched, no-ops on a blank text or an unknown id · `src/features/spec-viewer/reviewComments.ts`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T003** [US2] Route the `editComment` message through the existing serialized comment-write queue (`persistCommentMutation`) · `src/features/spec-viewer/messageHandlers.ts`
- [x] **T004** [US2] Cover the new mutation and its routing: text replaced in place, id / anchor / status / createdAt preserved, blank and unknown-id are no-ops · `src/features/spec-viewer/__tests__/messageHandlers.test.ts`

**Checkpoint**: a comment's text can be revised on disk without disturbing any other field.

## Phase 3: User Story 1 — A commented line reads as annotated, not interrupted (P1)

**Goal**: a saved comment costs one quiet line, borderless, on the viewer's neutral surface, with no permanent delete control.

**Independent Test**: open a spec with three saved comments; the document reads top to bottom and each comment adds one line.

### Implementation

**Wave 1 — independent (different files):**

- [x] **T005** [P] [US1] Rebuild `InlineComment` as a collapsed annotation: a `.comment-disclosure` `<button>` carrying the state glyph, the one-line truncated text, and the state label; state modifier classes on the root; every piece of comment text rendered through Preact, never a string-built attribute · `webview/src/spec-viewer/components/InlineComment.tsx`
- [x] **T006** [P] [US1] Restyle `.inline-comment` as the quiet annotation — `color-mix(in srgb, var(--text-muted) 12%, transparent)` surface, no border, `--text-body` text, accent only on hover/focus, a 2px state rail, and the full truncation trio with `min-width: 0` on the text · `webview/styles/spec-viewer/_refinements.css`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T007** [US1] Pass each mounted comment's `status` through from the restored/added refinement so the annotation renders its state · `webview/src/spec-viewer/editor/refinements.ts`

**Checkpoint**: commented lines render as quiet single-line annotations; the document is scannable again.

## Phase 4: User Story 2 — Open a comment to read it, act on it, or change it (P1)

**Goal**: the full text and all three actions are one click or one key press away, with no hover-only affordance.

**Independent Test**: tab to an annotation, press Enter, read the full text, edit it, reopen the spec, and see the edit persisted.

### Implementation

**Wave 1 — independent (different files):**

- [x] **T008** [P] [US2] Add the disclosure behavior and the action row to `InlineComment`: `aria-expanded` / `aria-controls` on the trigger, click and Enter/Space toggling, and Refine / Edit / Delete buttons revealed on expand (Refine only when pending); suppress the action row when the spec is read-only · `webview/src/spec-viewer/components/InlineComment.tsx`
- [x] **T009** [P] [US2] Give `InlineEditor` optional `initialValue` and `submitLabel` props so the edit flow reuses the composer pre-filled · `webview/src/spec-viewer/components/InlineEditor.tsx`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T010** [US2] Open the pre-filled composer for an existing comment and persist the revision via the `editComment` message, re-rendering the annotation with the new text · `webview/src/spec-viewer/editor/inlineEditor.ts`
- [x] **T011** [US2] Wire the annotation's Edit and Refine handlers into the mount path alongside the existing delete handler · `webview/src/spec-viewer/editor/refinements.ts`
- [x] **T012** [US2] Style the expanded body and the action row — full text at `--text-body`, wrapping safely on a long unbroken word · `webview/styles/spec-viewer/_refinements.css`

**Checkpoint**: read, refine, edit, and delete are all reachable from the comment itself, by mouse or keyboard.

## Phase 5: User Story 3 — Pending and applied are legible at a glance (P2)

**Goal**: the two states are distinguishable without opening a comment, and applied comments stay on the line without inflating the Refine count.

**Independent Test**: leave two comments, run Refine, and watch both flip to applied while the Refine badge drops to zero.

### Implementation

- [x] **T013** [US3] Restore applied comments inline alongside pending ones, mounting them without entering the `pendingRefinements` signal so the Refine badge stays pending-only · `webview/src/spec-viewer/editor/restoreComments.ts`, `webview/src/spec-viewer/editor/refinements.ts`

**⟶ Wait for T013, then:**

- [x] **T014** [US3] Style the two states — accent-tinted rail plus comment glyph for pending, muted rail plus check glyph for applied · `webview/styles/spec-viewer/_refinements.css`

**Checkpoint**: a line shows what was asked and whether it has been acted on.

## Phase 6: User Story 4 — Adding a comment is reachable without a mouse (P3)

- [x] **T015** [US4] Reveal the line add control on `:focus-visible`, not hover alone · `webview/styles/spec-viewer/_line-actions.css`

## Phase 7: User Story 5 — The consolidated review list speaks the same language (P3)

- [x] **T016** [US5] Give the Overview's Review comments card the same state-chip vocabulary and body-weight comment text as the inline annotation · `webview/src/spec-viewer/components/cards/CommentsCard.tsx`, `webview/styles/spec-viewer/_activity.css`

## Phase 8: Polish

**Wave 1 — independent (different files):**

- [x] **T017** [P] Component tests: collapsed and expanded rendering, pending vs applied, Refine hidden when applied, read-only suppression, and an XSS regression proving comment text containing markup and quotes renders as literal characters everywhere including the accessible name · `webview/src/spec-viewer/components/__tests__/InlineComment.test.tsx`
- [x] **T018** [P] Rewrite the stories to cover every state — pending collapsed, pending expanded, applied, long-text truncation, several comments on one document, row mode, read-only — and add an edit-mode story to the composer · `webview/src/spec-viewer/components/InlineComment.stories.tsx`, `webview/src/spec-viewer/components/InlineEditor.stories.tsx`
- [x] **T019** [P] Update the README's "Reading Specs" subsection to describe the annotation, its states, and the actions it offers · `README.md`
- [x] **T020** [P] Add the user-facing changelog entry · `CHANGELOG.md`

**⟶ Wait for Wave 1 to finish, then:**

- [x] **T021** Validate against the Success Criteria: `npm run compile`, `npm test`, `npm run build-storybook`, and `npm run package` all green

## Dependencies & Execution Order

- **Phase 2 (Foundational)** blocks everything: T001/T002 are independent, then T003 and T004 depend on them.
- **Phase 3 (US1)** blocks Phase 4 and Phase 5 — both build on the annotation component and its stylesheet. Within Phase 3, T005 and T006 are independent; T007 follows.
- **Phase 4 (US2)** depends on Phase 3 and on Phase 2's `editComment` mutation. T008 and T009 are independent; T010–T012 follow.
- **Phase 5 (US3)** depends on Phase 3 (the component must render a `status` before restore can supply one).
- **Phases 6 and 7** are independent of each other and of Phases 3–5, and can be done at any point after Phase 2.
- **Phase 8 (Polish)** depends on all of the above. T017–T020 are independent; T021 is last.
