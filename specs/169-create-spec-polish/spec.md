# Create Spec Polish

## Overview

Tidy up the **Create New Spec** page so it reads cleanly and tells people what to type. The title and subtitle at the top explain the task, the workflow picker sits on its own right-aligned row just above the input field (with empty space to its left so no copy crowds it), the body text is bumped to a comfortably readable size, and the empty-input area carries all the guidance in its placeholder — guiding questions plus a sample Jira link and a sample GitHub link, and an explicit note that a link on its own is enough (no description required). The redundant on-page "Specification" label and helper paragraph are dropped from view but kept as screen-reader-only text so accessibility doesn't regress.

## Functional Requirements

- **FR-001** The workflow selector MUST sit on its own right-aligned row directly above the input field, with empty space to its left so no adjacent copy reads close to it.
- **FR-002** The page's base body text (subtitle and input area) MUST render at a comfortably readable size — visibly larger than the previous small type.
- **FR-003** All readable text on the page MUST use the `--text-body` / `--text-primary` design tokens; the low-contrast `--text-secondary` / `--text-muted` tokens MUST NOT be used for primary readable copy.
- **FR-004** The input area's placeholder MUST carry the page's writing guidance: a short set of guiding questions, at least one sample Jira-style reference and one sample GitHub-style reference the user can pattern-match against, and an explicit statement that a reference link on its own is enough (no separate description required).
- **FR-004a** The on-page "Specification" label and helper paragraph MUST be removed from the visible layout (the title/subtitle and the placeholder now carry that information) but MUST remain present as screen-reader-only text so the field keeps an accessible name and description.
- **FR-005** The change MUST be visual/copy only — the submit flow, character-count behavior, image attach, workflow dispatch, and keyboard shortcuts MUST continue to work exactly as before.
- **FR-006** The Storybook mock (`CreateSpec.stories.tsx` / `CreateSpecMock.tsx`) MUST be updated to reflect the new top-right selector placement, larger type, and example-bearing placeholder so the visual baseline stays truthful.
- **FR-007** If the visible Create-Spec UX described to users in the README changed, the README Create-Spec copy MUST be refreshed to match; if no user-facing description changed, no README edit is required.

## Success Criteria

- **SC-001** On the Create Spec page, the workflow selector renders right-aligned on its own row above the input field in 100% of loads, with no body copy sitting beside it.
- **SC-002** A first-time user can read the page's body copy without straining — base body text (subtitle and the input/placeholder) is at least as large as the standard editor font, not the previous reduced size.
- **SC-003** With the input empty, the placeholder shows the guiding questions, at least two concrete reference examples (one resembling a Jira link, one a GitHub link), and the note that a link alone suffices.
- **SC-004** No readable copy on the page resolves to the muted/secondary tokens; a token audit of the page's text rules returns zero `--text-secondary` / `--text-muted` uses on primary copy.
- **SC-005** Every existing Create-Spec interaction (submit, cancel, char count, attach image, keyboard shortcuts, workflow change) still passes — zero behavioral regressions.
- **SC-006** The Storybook story renders the polished layout and matches the shipped page.

## Assumptions

- "Comfortably readable" is realized by raising the page's base type toward the standard VS Code editor font size rather than introducing a bespoke scale; the exact value is chosen in implementation against the design tokens.
- The placeholder examples are illustrative dummy references (e.g. a Jira issue URL and a GitHub issue URL), not live links, and exist purely as input guidance.
- The selector's placement is achieved by moving the existing `.workflow-row` (a lone right-aligned child) onto its own row above the field, rather than introducing a new layout component.
- The README only needs a touch if its Create-Spec description (placeholder/selector copy) is currently shown to users; the placeholder and selector position are otherwise not separately documented.

## Approach

Small, contained polish across the Create Spec webview and its Storybook mock — no behavior changes.

- **Selector on its own row** — move `.workflow-row` out of the header and into the content, directly above `.editor-container`, right-aligned (`justify-content: flex-end`); header reverts to a plain title + subtitle block.
- **Readable base type** — bump the subtitle to `1em` and the textarea (and thus its placeholder) to `max(15px, var(--font-size))` so the field copy stays comfortably large and theme-scalable; keep `--text-body`/`--text-primary` tokens.
- **Guidance in the placeholder** — set the `placeholder` on `#specContent` in `src/features/spec-editor/specEditorProvider.ts` to the guiding questions + a sample Jira link + a sample GitHub link + the links-only note; mirror it in `CreateSpecMock.tsx`'s empty state.
- **Drop the visible label/helper** — give the `.editor-label` and `.helper-text` the `sr-only` utility class so they stay in the a11y tree (`aria-describedby` intact) but leave the layout.
- **Stories** — update `webview/src/spec-editor/__stories__/CreateSpec.stories.tsx` / `CreateSpecMock.tsx` to show the right-aligned selector row, larger field type, and the guidance-bearing placeholder with no visible label/helper.
- **README** — refresh the Create-Spec copy in `README.md` only if its described placeholder/selector UX changed.

Dependencies: none — all surfaces are self-contained webview/CSS/story files. Verify the three acceptance items still reproduce on `main` before editing (confirmed during specify).
