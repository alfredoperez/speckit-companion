# Codex UI/UX Review: Pipeline Builder

Reviewed: `docs/pipeline-builder.md`, its twelve generated screenshots, the narrow and wide visual-regression states, and the relevant builder components and styles.

## Executive assessment

The builder has a strong product idea and a credible base. Representing the pipeline as ordered lanes, keeping shipped behavior separate from project-owned changes, and making nodes readable without exposing their frontmatter are all good decisions. The documentation also explains a genuinely complicated system in unusually plain language.

The current UI is not release-polished yet. Two documented panels are visibly broken, several important operations depend on hover or unexplained symbols, and the staged configuration/build model is not communicated strongly enough at the moment a user makes a change. The result feels like a capable internal tool: understandable after reading the guide, but not yet self-explanatory or consistently finished.

The highest-value work is to fix the side-panel layout, make the builder's state and next action explicit, and replace hidden or symbolic controls with recognizable, labeled interaction patterns. Visual refinement should follow those changes, not precede them.

## What is already working

### The board matches the domain

The left-to-right `specify → plan → tasks → implement` model is appropriate. Steps, phases, nodes, artifacts, and hooks have distinct visual shapes, so an experienced user can scan the run without opening every item. Numbering the steps reinforces sequence without adding heavy connectors.

### The node inspector is a useful progressive disclosure pattern

Opening a node into a side inspector is better than putting all instruction text on the board. The `Writes`, `Needs`, `Order`, and `Source` facts answer the right questions before the user edits anything. Rendering the effective instructions instead of authoring syntax is especially good.

### Ownership is treated as a first-class concept

The UI consistently attempts to distinguish shipped behavior, project-owned behavior, and extension-owned hooks. That is essential for a customization tool where users need to know what upgrades can replace and what they can safely revert.

### Destructive recovery is explained before action

The broken-pipeline state is one of the strongest screens. It offers the narrowest repair first, states what each repair will discard, separates manual repair, and visually distinguishes the broad reset. This is a professional recovery pattern worth preserving.

### The guide covers the breadth of the feature

The document addresses reading, editing, replacement, add-ons, templates, hooks, workflows, custom steps, building, recovery, and file locations. The writing is direct and avoids implementation jargon where possible.

## Release blockers

### P0 — The template editor is visually broken

Evidence: `builder-template.png`.

The title is flush against and clipped by the left edge, the close button appears below the title as a default browser control, the explanatory text has no panel padding, and there is no recognizable side-panel shell. This is not a subtle polish issue; it makes the screen look as if its stylesheet failed to load.

The component uses `pb-sheet`, `pb-sheet-head`, `pb-sheet-title`, `pb-sheet-close`, and `pb-sheet-note`, but there are no corresponding shell styles in `webview/styles/pipeline-builder.css`. Only the template rows themselves are styled.

Recommended fix:

- Use the same side-panel shell as the node inspector and creation forms. There should be one shared panel primitive for width, header, close action, scroll region, and padding.
- Give the header a single row with the title on the left and a 28–32 px close target on the right.
- Keep the explanatory note inside a padded intro region.
- Put section rows in the scrolling body and preserve the header while scrolling.
- Replace the raw `×` with the same close icon and accessible label used elsewhere.
- Add light and dark visual-regression coverage specifically for the full template panel, not only its rows.

Acceptance check: at 320, 420, and 800 px panel widths, the title and close action remain on one line, all content aligns to the same inset, and no browser-default button styling is visible.

### P0 — The Add Hook form clips and overlaps its own controls

Evidence: `builder-attach.png`.

The action row overlaps the optional text field. The `When`, `Where`, and build-preview content described by the component are absent from the captured viewport. A user can reasonably interpret this as lost form state or may be unable to reach required placement controls.

The likely cause is competing scroll ownership between `.pb-form`, its `1fr auto` grid, and `.pb-form-fields`. The fields overflow through the grid track instead of scrolling independently above the actions.

Recommended fix:

- Make the panel a fixed `header / body / footer` grid.
- Give only the form body `overflow-y: auto; min-height: 0`.
- Keep the actions in a non-overlapping footer with an opaque background and top border.
- Add bottom padding to the scrolling region equal to at least one spacing unit beyond the last field.
- Test the longest hook type, validation messages, browser zoom at 200%, and a panel height of 480 px.
- Do not ship a documentation screenshot with missing placement fields; regenerate it after the layout fix.

Acceptance check: every field can be reached by keyboard and scrolling, the footer never covers content, and the focused control is scrolled fully into view.

## High-priority UX improvements

### P1 — Make “configured but not built” the dominant state model

The most important concept in the product is that edits change `companion.yml`, while the assistant continues reading generated commands until Build runs. The UI currently communicates this with a sentence in the header after a change. That message is accurate, but it competes with two dropdowns, counts, and three actions.

Improve the model at the point of action:

- Rename `Build` to `Apply changes` or `Build & apply`. “Build” sounds like compilation rather than activation.
- After any edit, show a persistent status such as `3 unapplied changes` adjacent to the primary action.
- Change the primary button label to `Apply 3 changes` when stale.
- After success, replace the warning with a brief `Pipeline is up to date` confirmation and timestamp.
- If edits are written immediately, say `Saved to companion.yml; not applied yet` in the form completion feedback.
- Make Preview open a readable grouped diff with the same vocabulary as the board: step, node, hook, template section. Avoid making raw YAML the primary preview.

This gives every state a clear answer to two questions: “Is my configuration saved?” and “Is the assistant using it?”

### P1 — Clarify the two adjacent selectors in the header

`This project` and `Shipped default · no changes` look like two peer dropdowns, but their meanings are not obvious. The first appears to be scope, while the second is a change summary; workflow selection is also present in this area. A first-time user should not have to infer the distinction.

Recommended information hierarchy:

- Page title: `Pipeline Builder`.
- Labeled workflow selector: `Workflow: Shipped default`.
- Status chip: `No customizations` or `3 customizations`.
- Secondary metadata: `5 hooks, all project-owned`.
- Actions: `Open config`, `Preview changes`, `Apply changes`.

If `This project` is a meaningful scope switcher, label it `Scope` and include the alternative scopes in the guide. If it is not currently a real choice, render it as context rather than as a dropdown.

### P1 — Replace unexplained symbols with labeled controls

The interface relies on `§`, a small purple dot, a file icon plus number, drag dots, dashed seams, and color to convey important meaning. Several of these only become understandable through hover tooltips or the guide.

Specific changes:

- Replace `§` with a compact `Template` button or a document-template icon plus accessible `Template` text.
- Render the artifact count as `2 outputs` rather than an icon and bare `2`.
- Replace the changed dot with a small `Modified` badge in the step header, or add the word in an accessible always-visible summary.
- Give pinned nodes both a lock icon and a visible `Fixed order` label in the inspector.
- Treat dashed seams as expert shortcuts; do not depend on them as the only precise hook-placement affordance.

Tooltips should add detail, not supply the basic identity of a control.

### P1 — Do not hide essential actions until hover

Phase tools, `Add hook`, `Make it ours`, and node `Undo` are hidden using opacity until hover or keyboard focus. This reduces visual noise, but it also makes capability discovery dependent on pointer exploration. Hover-only controls are especially weak in narrow panels, touch environments, and accessibility workflows.

Recommended pattern:

- Keep one always-visible overflow button on each phase and step.
- Put infrequent actions—rename phase, split, merge, customize step—inside that menu with full labels.
- Keep `Add node` and `Add hook` visible when they are primary contextual actions, or reveal them when the phase receives focus, not just hover.
- In a modified node, show a persistent small `Modified` indicator; put `Restore shipped version…` in its menu.
- Preserve immediate drag handles for pointer users, but add menu actions such as `Move up`, `Move down`, and `Move to phase…`.

This would reduce the current cluster of tiny 20 px controls while improving discoverability and keyboard reach.

### P1 — Provide a keyboard-equivalent reordering flow

Nodes use HTML drag-and-drop on the card container. There is no keyboard mechanism to reorder a movable node or transfer it to another phase. The visual grip is a non-interactive `span`, and its explanation is in `title` text.

Add one of these patterns:

- Preferred: a node action menu with `Move before…`, `Move after…`, and `Move to phase…` choices.
- Optional enhancement: keyboard “grab” mode with clear live announcements and Escape to cancel.

After a move, announce the result through an `aria-live` region, for example: `Draft the spec moved to Author, position 2 of 3.` Also keep focus on the moved node.

### P1 — Give menus complete keyboard behavior

The custom menus visually improve on native selects, but `role="menu"` implies keyboard behaviors that are not implemented: focus does not move into the menu on open, arrow keys do not change items, and Escape closes without explicitly returning focus to the trigger. The workflow menu has similar behavior without menu semantics.

Either implement the standard menu-button interaction fully or use a simpler disclosure/listbox pattern whose semantics match the current behavior. Test opening, arrow navigation, Home/End, selection, Escape, click-away, and focus restoration.

### P1 — Improve the narrow-panel experience

Evidence: `narrow-panel--narrow.png`.

At narrow widths the header becomes several loosely related rows, the stale warning is visually clipped, and the board shows an unexplained sliver of the next/outside lane. Horizontal board scrolling is reasonable, but the entry state should make the behavior obvious.

Recommended fix:

- Keep title and workflow on the first row, status on the second, and actions in a compact final row.
- Ensure warning text has `min-width: 0` and wraps without being cut off.
- Add a subtle right-edge scroll affordance or `Step 1 of 4` control with previous/next buttons.
- When a side panel is open on a narrow surface, let it occupy the available body instead of splitting the viewport into a partial board and a half-height panel.
- Preserve the user’s horizontal scroll position when the inspector opens and closes.

## Interaction and content improvements

### P2 — Make customization actions describe their consequence

`Edit`, `Replace`, `Undo`, and `Make it ours` use inconsistent language for closely related operations.

Suggested vocabulary:

| Current | Recommended |
|---|---|
| Edit | Customize instructions |
| Replace | Switch variant |
| Make it ours | Replace step instructions |
| Undo | Restore shipped node |
| Use the shipped node | Restore shipped node |
| + node | Add node |
| + step | Add step |

When the first edit creates a project-owned copy, state that before saving: `Saving creates a project override; the shipped node remains available.` Destructive restoration should name what will be lost and ask for confirmation if there are unsaved text changes or attached hooks that could be affected.

### P2 — Simplify hook presentation

The hook grouping is semantically sound, but nested connector lines, monospaced verbs, tinted blocks, and truncated content make hooks harder to scan than nodes. Long commands and instructions dominate the lane height.

Recommended presentation:

- Use a compact list under `Before` and `After` headings.
- Give every hook a type icon and concise type label: `Skill`, `Instruction`, `Command`, or `Node`.
- Truncate to one or two lines on the board and show the full value in the inspector.
- Keep ownership as a badge such as `Project` or `Extension`, not color alone.
- Show hook count on collapsed anchors and let users expand details on demand.

### P2 — Improve creation forms with examples and a live outcome summary

The New Step form exposes implementation-shaped fields (`Name`, `Reads as`, `Runs after`, `Writes`) before the user has a clear preview of the result. `Writes` is free text without explaining whether multiple files are supported or how they are separated.

Recommended changes:

- Label `Name` as `Command ID` and explain its constraints inline before validation.
- Label `Reads as` as `Display name`.
- Change `Runs after` to a choice between `Part of the automatic run` and `Run manually`, revealing placement only for the first choice.
- Make outputs a repeatable file field or explicitly state the supported delimiter and path rules.
- Add a compact live summary: `Review will run after Implement, write review.md, and be available as /speckit.companion.review.`
- On successful creation, open the seeded node with an obvious `Write instructions` next action.

For New Workflow, show presets as descriptive cards rather than hiding their differences in a select. The choice is consequential enough to compare `Current workflow`, `Shipped`, `Classic spec-kit`, and `Brownfield` at once.

### P2 — Strengthen board hierarchy and rhythm

The board is very pale in the documented light theme. Lane separators, card borders, seams, and text all sit close in contrast, while the large empty regions make the populated areas feel unfinished rather than calm.

Professional polish should include:

- A slightly stronger lane header surface or bottom rule so headers remain distinct while scrolling.
- Consistent vertical spacing between phases and nodes; hooks should not compress node-to-node rhythm unpredictably.
- A clearer selected-node state than a one-pixel accent border.
- Slightly larger hit targets for icon-only controls, aiming for at least 28–32 px in this dense desktop UI.
- Theme testing for low-contrast VS Code themes and high-contrast mode.
- A restrained elevation system shared by menus, inspectors, and transient overlays.

Avoid adding decorative gradients or heavy cards. The professional character should come from alignment, state clarity, spacing, and consistent controls.

### P2 — Improve success, progress, and failure feedback

The guide shows stale state but not the complete Preview/Build loop. Users need to know what will happen, what is happening, and what happened.

Recommended states:

1. `Saved — 3 changes not applied`.
2. Preview panel grouped by changed steps, with additions/removals/restores.
3. `Applying changes…` with disabled conflicting actions but a visible progress state.
4. `Applied successfully` with generated-command count and time.
5. Failure tied to the affected step, with configuration preserved and a direct repair/open action.

Do not rely only on a transient toast. Build status is part of the durable state of this screen.

## Documentation improvements

### Add a two-minute task-oriented quick start

The guide begins with taxonomy, then covers every capability. Add a short happy path before the reference material:

1. Open a node.
2. Choose `Customize instructions`.
3. Save the override.
4. Preview changes.
5. Apply changes.
6. Confirm the pipeline is up to date.

This teaches the governing state model through one complete outcome.

### Add an annotated legend to the first board image

The first screenshot is dense and very wide. Annotate one example each of a step, phase, node, output, hook, project modification, and outside-run step. A small legend next to the image would reduce the amount of prose a user must hold while scanning.

### Replace the broken screenshots and add missing states

Regenerate `builder-template.png` and `builder-attach.png` after their layouts are fixed. Add screenshots for:

- Preview changes.
- Successful apply/build.
- A failed build with preserved configuration.
- A narrow inspector/form state.
- Keyboard-focused node and menu states if accessibility is part of the supported experience.

### Explain scope and reversibility earlier

The guide eventually explains where files live, but first-time users will ask sooner:

- Is this project-only or global?
- Does editing immediately affect the assistant?
- Can I undo one change?
- Can I reset a workflow without losing my custom node files?
- What does switching workflows preserve?

A short `Before you change anything` callout can answer these without forcing users to read the final file-location section.

### Reduce dependence on hover in the prose

Several explanations say to hover for essential information. Hover does not translate to keyboard use, touch, screenshots, or all assistive technology. Anything needed to make a decision should also be available by focus, click, or persistent text.

## Suggested implementation order

### Release gate

1. Fix the Template panel shell.
2. Fix Add Hook scrolling and footer overlap.
3. Regenerate documentation images in light and dark themes.
4. Add visual tests at narrow height as well as narrow width.

### Core usability pass

1. Clarify header labels and the saved/applied state model.
2. Rename the primary action and show unapplied change count.
3. Replace symbolic metadata with labeled controls.
4. Make essential contextual actions persistently discoverable.
5. Add keyboard-equivalent node movement and complete menu focus behavior.

### Professional polish pass

1. Standardize one side-panel primitive and one action hierarchy.
2. Simplify hook cards and ownership labels.
3. Improve narrow-panel navigation and warning wrapping.
4. Refine spacing, hit targets, selected states, and theme contrast.
5. Add the task-oriented quick start and end-to-end build screenshots.

## Definition of done for the UI

- No panel clips, overlaps, or exposes browser-default controls at supported sizes.
- A first-time user can identify the active workflow, whether it is customized, whether changes are saved, and whether they are applied without reading documentation.
- Every pointer-only action has a keyboard-accessible equivalent.
- Modified, shipped, and extension-owned items are distinguishable without color or hover.
- Every form has clear labels, inline validation, reachable actions, and a plain-language outcome preview.
- Preview, apply-in-progress, success, warning, and failure states are represented and tested.
- The full edit → preview → apply → confirm flow is documented with current screenshots.

## Bottom line

Keep the current pipeline-as-board concept, the inspector’s factual summary, and the repair flow. Before adding more capability, finish the shared panel layout and make state, ownership, and available actions legible without hidden controls or a guide. Those changes will move the experience from a thoughtful engineering tool to a professional product surface.
