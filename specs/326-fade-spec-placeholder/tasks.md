# Tasks: Fade Create Spec Placeholder

**Input**: Design documents from `/specs/326-fade-spec-placeholder/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md

**Tests**: No automated test tasks — this is a pure CSS visual change with no test request in the spec. The Storybook story (`CreateSpec.stories.tsx`) is the visual baseline and is verified manually.

**Organization**: Tasks are grouped by user story. Both user stories are P1 and are satisfied by the same single CSS edit; verification differs per story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

## Path Conventions

Single VS Code extension with a webview UI layer. The change is isolated to `webview/styles/spec-editor.css`; the visual baseline lives in `webview/src/spec-editor/__stories__/CreateSpec.stories.tsx`. `webview/styles/tokens.css` is the read-only source of truth for the chosen token.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the target rule and the chosen token before editing

- [x] **T001** Confirm the current placeholder rule at `webview/styles/spec-editor.css:134` reads `color: var(--text-body); opacity: 0.85;` and that `--text-secondary` is defined as `color-mix(in srgb, var(--vscode-editor-foreground) 70%, transparent)` for both themes in `webview/styles/tokens.css` (lines ~47 and ~147).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational work — there is no shared infrastructure to build for a one-rule CSS change.

*(No tasks in this phase.)*

---

## Phase 3: User Story 1 - Empty field reads as guidance, not entered text (Priority: P1)

**Goal**: The empty description placeholder renders visibly lighter/grayer than real typed content, so an empty field is never mistaken for a filled one.

**Independent Test**: Open the Create Spec page with the description field empty and confirm the placeholder text is visibly lighter than typed text, reading as a hint rather than entered content.

- [x] **T002** [US1] In `webview/styles/spec-editor.css`, change the `.spec-editor-textarea::placeholder` rule (line 134) from `color: var(--text-body); opacity: 0.85;` to `color: var(--text-secondary);`, removing the stacked `opacity` declaration (satisfies FR-001 and FR-004).
- [x] **T003** [US1] Rebuild the webview bundle (`npm run compile`) so the CSS change is picked up, then open the Create Spec page with an empty description field in the Extension Development Host and confirm the placeholder is visibly lighter than typed content and reads as guidance (Acceptance Scenarios 1 & 2; SC-001, SC-003).

**Checkpoint**: Empty placeholder is clearly distinguishable from typed text — US1 independently verifiable.

---

## Phase 4: User Story 2 - Placeholder guidance stays readable on both themes (Priority: P1)

**Goal**: The faded placeholder stays legible — not disabled-looking, not vanishing — on both light and dark themes.

**Independent Test**: View the empty Create Spec field on both a light and a dark theme and confirm the placeholder guidance remains legible in each.

> Implemented by the same edit as US1 (T002); this phase is verification of the cross-theme contrast requirement.

- [x] **T004** [US2] In the Extension Development Host, switch to a dark theme and confirm the empty placeholder is faded yet clearly readable and does not match the disabled appearance (FR-002, FR-003; Acceptance Scenario 2; SC-002).
- [x] **T005** [P] [US2] In the Extension Development Host, switch to a light theme and confirm the empty placeholder is faded yet clearly readable and does not match the disabled appearance (FR-002, FR-003; Acceptance Scenario 1; SC-002).

**Checkpoint**: Placeholder legibility holds across both themes — US2 independently verifiable.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Keep the visual baseline in sync per FR-005

- [x] **T006** Confirm the empty-state story in `webview/src/spec-editor/__stories__/CreateSpec.stories.tsx` still represents the intended empty-placeholder baseline (it picks up the CSS automatically — no code change expected; update it only if the rendered baseline shifts) (FR-005).

---

## Dependencies & Execution Order

- **T001 (Setup)** → must complete before the edit.
- **T002 (US1 edit)** → blocks all verification (T003, T004, T005) and the polish check (T006); it is the single change that satisfies both user stories.
- **T003 / T004 / T005 (verification)** → all depend on T002 and a rebuild (T003 triggers the rebuild). T004 and T005 are independent of each other.
- **T006 (polish)** → after the edit is confirmed.

```
T001 → T002 → T003 ─┐
                    ├→ T006
            ├→ T004 ┤
            └→ T005 ┘
```

## Parallel Execution Example

After T002 and the rebuild, the two theme checks can run in parallel:

```
T004 [US2] Verify dark-theme legibility
T005 [US2] Verify light-theme legibility   # [P] — independent of T004
```

## Implementation Strategy

**MVP scope**: T002 is the entire functional change. The placeholder swap to `--text-secondary` (dropping stacked opacity) delivers both P1 stories at once; everything else is verification and baseline upkeep. Ship after T003–T005 confirm the empty state reads as faded-but-legible content on both themes.
