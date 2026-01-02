# Tasks: VS Code Theme Integration and Readability Improvements

**Input**: Design documents from `/specs/001-theme-integration/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓

**Tests**: Not required - CSS-only feature with manual testing via VS Code theme switching.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- All tasks modify `webview/styles/workflow.css` unless otherwise noted

## Path Conventions

- **Primary file**: `webview/styles/workflow.css` (~970 lines)
- **Reference file**: `webview/styles/spec-markdown.css` (already uses VS Code variables)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create CSS custom property foundation for theme integration

- [x] T001 Audit current hardcoded colors in `webview/styles/workflow.css` and document line numbers for replacement
- [x] T002 Review `webview/styles/spec-markdown.css` for VS Code variable patterns to reference
- [x] T003 Create `:root` CSS custom property block at top of `webview/styles/workflow.css` with VS Code variable mappings and fallbacks (as defined in research.md Decision 4)

**Checkpoint**: Foundation CSS variables ready - user story implementation can now begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core CSS variable mappings that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until these variable mappings exist

- [x] T004 Define background color variables using VS Code mappings in `webview/styles/workflow.css`:
  - `--bg-primary: var(--vscode-editor-background, #1e1e1e)`
  - `--bg-secondary: var(--vscode-sideBar-background, #252526)`
  - `--bg-elevated: var(--vscode-editorWidget-background, #252526)`
  - `--bg-hover: var(--vscode-list-hoverBackground, #2a2d2e)`

- [x] T005 [P] Define text color variables using VS Code mappings in `webview/styles/workflow.css`:
  - `--text-primary: var(--vscode-editor-foreground, #d4d4d4)`
  - `--text-secondary: var(--vscode-descriptionForeground, #858585)`
  - `--text-muted: var(--vscode-disabledForeground, #6c6c6c)`

- [x] T006 [P] Define accent color variables using VS Code mappings in `webview/styles/workflow.css`:
  - `--accent: var(--vscode-focusBorder, #007fd4)`
  - `--accent-hover: var(--vscode-button-hoverBackground, #0062a3)`
  - `--success: var(--vscode-testing-iconPassed, #388a34)`
  - `--warning: var(--vscode-editorWarning-foreground, #cca700)`
  - `--error: var(--vscode-editorError-foreground, #f14c4c)`

- [x] T007 [P] Define border color variables using VS Code mappings in `webview/styles/workflow.css`:
  - `--border: var(--vscode-panel-border, #3c3c3c)`
  - `--border-hover: var(--vscode-contrastBorder, #6c6c6c)`

- [x] T008 [P] Define typography variables using VS Code mappings in `webview/styles/workflow.css`:
  - `--font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, sans-serif)`
  - `--font-mono: var(--vscode-editor-font-family, 'Consolas', 'Monaco', monospace)`
  - `--font-size: var(--vscode-editor-font-size, 13px)`

- [x] T009 Add theme-specific fallback blocks for light/dark themes in `webview/styles/workflow.css`:
  - `body.vscode-light { ... }` with light-appropriate fallbacks
  - `body.vscode-dark { ... }` with dark-appropriate fallbacks
  - `body.vscode-high-contrast { ... }` for accessibility

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Theme-Aware Workflow Editor (Priority: P1) 🎯 MVP

**Goal**: Replace all hardcoded dark theme colors with VS Code theme CSS custom properties so the editor automatically adopts the user's VS Code theme.

**Independent Test**: Switch VS Code between light theme (Light+), dark theme (Dark+), and high contrast theme - verify workflow editor colors update immediately without refresh.

### Implementation for User Story 1

- [x] T010 [US1] Replace all hardcoded background colors (`#0a0a0a`, `#141414`, `#1a1a1a`, `#1f1f1f`) with CSS custom properties (`var(--bg-primary)`, etc.) in `webview/styles/workflow.css`

- [x] T011 [US1] Replace all hardcoded text colors (`#fafafa`, `#a1a1a1`, `#666666`, white variants) with CSS custom properties (`var(--text-primary)`, etc.) in `webview/styles/workflow.css`

- [x] T012 [US1] Replace all hardcoded accent colors (`#3b82f6`, `#60a5fa`, blue variants) with CSS custom properties (`var(--accent)`, etc.) in `webview/styles/workflow.css`

- [x] T013 [US1] Replace all hardcoded semantic colors (success greens, warning yellows, error reds) with CSS custom properties in `webview/styles/workflow.css`

- [x] T014 [US1] Replace all hardcoded border colors (`#262626`, `#404040`, gray variants) with CSS custom properties in `webview/styles/workflow.css`

- [x] T015 [US1] Verify no hardcoded hex color values remain in `webview/styles/workflow.css` except as fallbacks within `var()` functions

- [ ] T016 [US1] Test theme switching with VS Code Default Dark+ and Default Light+ themes

**Checkpoint**: At this point, User Story 1 should be fully functional - theme colors update automatically when VS Code theme changes

---

## Phase 4: User Story 2 - Improved Typography and Readability (Priority: P2)

**Goal**: Update typography to use VS Code's configured fonts for a consistent reading experience.

**Independent Test**: Configure a custom editor font in VS Code settings and verify code blocks in the workflow editor use that font. Compare body text readability.

### Implementation for User Story 2

- [x] T017 [P] [US2] Update `font-family` declarations for body text to use `var(--font-family)` in `webview/styles/workflow.css`

- [x] T018 [P] [US2] Update `font-family` declarations for code blocks and inline code to use `var(--font-mono)` in `webview/styles/workflow.css`

- [x] T019 [US2] Review and adjust `font-size` declarations to use `var(--font-size)` where appropriate in `webview/styles/workflow.css`

- [x] T020 [US2] Review and adjust `line-height` values for comfortable reading (1.5-1.7 for body text) in `webview/styles/workflow.css`

- [x] T021 [US2] Ensure visual hierarchy is maintained between headings, body text, and code with consistent font sizing in `webview/styles/workflow.css`

**Checkpoint**: Typography uses VS Code's configured fonts - code blocks match editor font

---

## Phase 5: User Story 3 - Compact Layout and Clean Spacing (Priority: P2)

**Goal**: Reduce excessive header margins and remove hover effects from empty lines for better content density.

**Independent Test**: Open a spec document and measure vertical space usage. Verify ~30% reduction in vertical space while maintaining readability. Verify empty lines have no hover effects.

### Implementation for User Story 3

- [x] T022 [US3] Reduce `.doc-title` margin from `0 0 24px 0` to `0 0 16px 0` in `webview/styles/workflow.css`

- [x] T023 [US3] Reduce `.section-header` margin from `32px 0 16px 0` to `20px 0 10px 0` in `webview/styles/workflow.css`

- [x] T024 [US3] Add `.subsection-header` margin of `16px 0 8px 0` if not already defined in `webview/styles/workflow.css`

- [x] T025 [US3] Add styling for empty lines to remove hover effects in `webview/styles/workflow.css`:
  - `.line.empty { pointer-events: none; }`
  - `.line.empty:hover { background: transparent; }`

- [x] T026 [US3] Review and reduce excessive padding/margin on metadata blocks, content blocks, and paragraph elements in `webview/styles/workflow.css`

- [x] T027 [US3] Verify document title, metadata, and first section have balanced, cohesive spacing in `webview/styles/workflow.css`

**Checkpoint**: Layout is more compact - headers group visually with content, empty lines are clean

---

## Phase 6: User Story 4 - Consistent Visual Hierarchy (Priority: P3)

**Goal**: Ensure clear visual distinction between document sections using theme-aware semantic colors.

**Independent Test**: Open a complete spec file and verify section types (title, headers, user stories, requirements) are visually distinct and the hierarchy is immediately apparent.

### Implementation for User Story 4

- [x] T028 [US4] Update document title (`.doc-title`) to use `var(--vscode-textLink-foreground)` for accent color in `webview/styles/workflow.css`

- [x] T029 [US4] Update section headers to use `var(--vscode-symbolIcon-classForeground)` or `var(--vscode-editorInfo-foreground)` for semantic distinction in `webview/styles/workflow.css`

- [x] T030 [US4] Ensure user story headers have distinct visual treatment using theme-appropriate accent colors in `webview/styles/workflow.css`

- [x] T031 [US4] Review border treatments for sections to use theme-aware border colors in `webview/styles/workflow.css`

- [ ] T032 [US4] Verify visual hierarchy allows quick identification of section boundaries in both light and dark themes

**Checkpoint**: All section types are visually distinct with theme-appropriate colors

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup affecting all user stories

- [ ] T033 [P] Validate CSS with popular themes: One Dark Pro, Dracula, Monokai, Solarized Light/Dark
- [ ] T034 [P] Test with VS Code high contrast theme for accessibility compliance
- [ ] T035 Verify no flashes of unstyled content (FOUC) during theme transitions
- [x] T036 Remove any unused CSS rules or commented-out legacy color definitions from `webview/styles/workflow.css`
- [x] T037 [P] Update CLAUDE.md with notes about active technologies for this feature
- [ ] T038 Final visual review comparing workflow editor appearance to VS Code's native markdown preview

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (P1) → US2 (P2) → US3 (P2) → US4 (P3) in priority order
  - US2 and US3 (both P2) could run in parallel after US1 completes
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Core theme integration
- **User Story 2 (P2)**: Can start after US1 - Typography builds on theme variables
- **User Story 3 (P2)**: Can start after US1 - Spacing is independent of typography, can parallel with US2
- **User Story 4 (P3)**: Can start after US1 - Visual hierarchy uses theme variables, can parallel with US2/US3

### Parallel Opportunities

- **Setup phase**: T001, T002, T003 are sequential (audit → review → create)
- **Foundational phase**: T005, T006, T007, T008 can run in parallel (different variable groups)
- **US1**: T010-T014 are sequential (must replace colors systematically to avoid conflicts in same file)
- **US2**: T017, T018 can run in parallel (body vs code font families)
- **US3**: T022, T023, T024, T025 can run in parallel (different selectors)
- **US4**: T028, T029, T030 can run in parallel (different elements)
- **Polish**: T033, T034, T037 can run in parallel (different activities)

---

## Parallel Example: Foundational Phase

```bash
# Launch variable definition tasks together (different variable groups):
Task: "T005 [P] Define text color variables in webview/styles/workflow.css"
Task: "T006 [P] Define accent color variables in webview/styles/workflow.css"
Task: "T007 [P] Define border color variables in webview/styles/workflow.css"
Task: "T008 [P] Define typography variables in webview/styles/workflow.css"
```

## Parallel Example: User Story 3

```bash
# Launch margin/spacing tasks together (different selectors):
Task: "T022 [US3] Reduce .doc-title margin in webview/styles/workflow.css"
Task: "T023 [US3] Reduce .section-header margin in webview/styles/workflow.css"
Task: "T024 [US3] Add .subsection-header margin in webview/styles/workflow.css"
Task: "T025 [US3] Add empty line styling in webview/styles/workflow.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (audit, review reference, create variable block)
2. Complete Phase 2: Foundational (all CSS variable mappings)
3. Complete Phase 3: User Story 1 (replace all hardcoded colors)
4. **STOP and VALIDATE**: Test with Light+ and Dark+ themes
5. Commit and demo - core theme integration is complete!

### Incremental Delivery

1. Complete Setup + Foundational → CSS variables ready
2. Add User Story 1 → Test theme switching → Commit (MVP!)
3. Add User Story 2 → Test typography → Commit
4. Add User Story 3 → Test spacing → Commit
5. Add User Story 4 → Test visual hierarchy → Commit
6. Polish phase → Final validation → Commit

### Single Developer Strategy

Since all changes are to the same CSS file:
1. Complete phases sequentially (1 → 2 → 3 → 4 → 5 → 6 → 7)
2. Within each phase, work on parallel tasks one by one but commit together
3. Test after each user story completion before proceeding

---

## Notes

- All tasks modify `webview/styles/workflow.css` - avoid concurrent editing
- [P] tasks can be combined in a single commit if they don't conflict
- Reference `webview/styles/spec-markdown.css` for proven VS Code variable patterns
- Fallback values should be VS Code's Dark+ theme defaults
- Test with both light and dark themes after each user story
- No automated tests needed - manual testing with VS Code theme switching is sufficient
