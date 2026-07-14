# Feature Specification: Sidebar Redesign — One Coherent, VS Code-Native Sidebar

**Feature Branch**: `396-sidebar-redesign`
**Created**: 2026-07-14
**Status**: Draft
**Source**: GitHub issue #435 (folds in #428, #429). Full design plan: [`docs/sidebar-redesign-plan.md`](../../docs/sidebar-redesign-plan.md)

## Overview

The SpecKit sidebar works, but its design language has drifted. Four views use overlapping names, decorative illustration-style icons compete with the editor's own icon set and provider logos at the same tiny scale, the Specs toolbar shows too many icon-only buttons at once, hover and right-click menus disagree about what a spec row can do, some tooltips show raw internal values or name the wrong provider file, and a workspace with hundreds of completed specs floods the tree the moment it opens.

This feature makes the sidebar read as one product — quiet, scannable, predictable, compact — while staying entirely native to the host editor. Nothing about how specs behave changes: the same commands, the same lifecycle, the same filter, sort, multi-select, and resume rules. Only what the user sees and where they reach for it changes.

## User Scenarios & Testing

### User Story 1 - A sidebar that opens calm, not flooded (Priority: P1)

A developer with a mature project — a handful of specs in progress and two hundred finished ones — opens the SpecKit sidebar. Today the tree explodes: every active spec is already expanded into its documents, and the eye has to hunt for the one spec being worked on. After this change the sidebar opens to a short, readable list: the Active group expanded showing one row per spec, and Completed and Archived collapsed behind their counts. Expanding a spec is a deliberate act, not the default.

**Why this priority**: This is the first thing every user sees on every session. A flooded tree is the loudest symptom of the drift and the cheapest to fix.

**Independent Test**: Open a workspace with several active specs and 200+ completed ones. The initial viewport shows the group headers with counts and one collapsed row per active spec, with no document children rendered until a row is expanded.

**Acceptance Scenarios**:

1. **Given** a workspace with four active specs, **When** the Specs view first renders, **Then** the Active group is expanded and each individual spec row is collapsed.
2. **Given** a workspace with 205 completed specs, **When** the Specs view first renders, **Then** the Completed group is collapsed and shows its count in the header.
3. **Given** the tree is rendered, **When** the user runs Expand All, **Then** every spec row expands; **When** the user runs Collapse All, **Then** every spec row collapses again.
4. **Given** a group contains zero specs, **When** the tree renders, **Then** that group header is omitted entirely.

---

### User Story 2 - Names that say what a view is (Priority: P1)

A user cannot tell "Specs" from "Spec Explorer" — the names are near-synonyms for two different things (per-feature work vs. durable capability documentation). And the "Settings" view holds bug reports and a marketplace rating link, not just settings. After this change the views are named for what they hold: **Specs**, **Living Specs**, **Steering**, **Settings & Feedback**.

**Why this priority**: The confusion is reported directly (#428) and every other improvement is read through these labels.

**Independent Test**: Open the SpecKit activity bar container and read the four view headers.

**Acceptance Scenarios**:

1. **Given** the SpecKit container, **When** the user reads the view headers, **Then** the living-specs view is titled "Living Specs" and never "Spec Explorer".
2. **Given** the SpecKit container, **When** the settings view is shown, **Then** it is titled "Settings & Feedback".
3. **Given** any existing keybinding, saved setting, or command-palette entry, **When** the rename ships, **Then** it continues to work — no view id, command id, or setting key changed.

---

### User Story 3 - One icon language (Priority: P1)

Today a detailed, illustration-style construction sign sits beside a flat editor glyph beside a brand logo, all at the same tiny size. After this change every functional and status concept uses the editor's own themed icon set, so the tree inherits light, dark, and high-contrast behavior for free. Custom art survives only where it means identity: the product's own mark, and the official logos of AI providers.

**Why this priority**: This is the single largest visual source of the "drifted" feeling, and it also fixes real theme legibility problems.

**Independent Test**: Switch between light, dark, and high-contrast themes and confirm every group and category icon remains legible and monochrome-appropriate, while the product mark and provider logos still read as brands.

**Acceptance Scenarios**:

1. **Given** the Specs tree, **When** the group headers render, **Then** Active, Completed, and Archived each use a themed editor icon, not a detailed illustration.
2. **Given** the Steering tree, **When** a generic category (project, user, agents, skills, settings, scripts, templates, constitution) renders, **Then** it uses a themed editor icon.
3. **Given** the Steering tree, **When** the product's own node renders, **Then** it keeps its custom product mark.
4. **Given** any tree row, **When** it renders, **Then** its label, description, and tooltip contain no emoji characters.
5. **Given** a status is conveyed by color, **When** the user cannot perceive that color, **Then** the same status is still conveyed by icon shape, group, description, or tooltip.

---

### User Story 4 - A provider row that never lies (Priority: P1)

A user running the host editor's built-in chat in an editor that is not the one the extension guessed sees the wrong brand logo — a competitor's mark on their own product's row. And the Wibey providers show a generic fallback with no explanation. After this change the provider label and the provider icon always agree, and an unrecognized host falls back to a neutral chat icon rather than borrowing someone else's brand.

**Why this priority**: Showing the wrong company's logo is a correctness bug, not a taste issue.

**Independent Test**: Configure each provider in turn, including the host-chat provider under several host editors, and confirm the row's name and mark refer to the same product.

**Acceptance Scenarios**:

1. **Given** the host-chat provider in an unrecognized host editor, **When** the provider row renders, **Then** it shows a neutral chat icon and a neutral label — never a specific vendor's branding.
2. **Given** the host-chat provider in a recognized host editor, **When** the provider row renders, **Then** the icon matches the same product the label names.
3. **Given** the Wibey providers, **When** the provider row renders, **Then** it shows a documented, intentional icon rather than an accidental fallback.
4. **Given** a provider whose mark has no inherent color, **When** the theme changes, **Then** the mark remains legible in both light and dark.

---

### User Story 5 - A toolbar you can read at a glance (Priority: P2)

The Specs title bar can show six icon-only buttons at once — filter, clear filter, sort, collapse/expand, install, upgrade, new — and users guess. After this change it shows at most four: **Filter**, **Sort**, **More Actions**, and **New Spec** (rightmost). The occasional actions move behind More Actions, and every one of them stays reachable from the Command Palette.

**Why this priority**: High everyday value, but only meaningful once the naming and density work has landed.

**Independent Test**: Open the Specs view in every context combination (filter on/off, extension installed/not, spec-kit detected/not) and count the title-bar buttons.

**Acceptance Scenarios**:

1. **Given** any context, **When** the Specs title bar renders, **Then** it shows at most four actions.
2. **Given** a filter is active, **When** the user opens Filter, **Then** the input is prefilled with the current query; **When** the user submits an empty value, **Then** the filter clears.
3. **Given** More Actions is opened, **When** the extension is not installed, **Then** the install action appears in the list; **When** it is installed, **Then** it does not.
4. **Given** More Actions is opened, **Then** collapse/expand appears, matching the tree's current state.
5. **Given** Sort is opened, **Then** it opens the picker directly from the title icon, with a check on the current order and one compact line per option.

---

### User Story 6 - Hover and right-click that agree (Priority: P2)

A spec row offers one set of actions on hover and a differently-ordered set on right-click, and Delete sits in the same undifferentiated block as the status and lifecycle actions. After this change both surfaces present the same actions in the same safe order, with Delete isolated at the bottom as the only destructive item.

**Why this priority**: Predictability and safety; a mis-click on Delete is unrecoverable.

**Independent Test**: Hover a spec row and open its More Actions; then right-click the same row. Compare item order.

**Acceptance Scenarios**:

1. **Given** a spec row, **When** the user hovers it, **Then** at most two inline icons appear — Resume (only when eligible) and More Actions.
2. **Given** a spec row's More Actions and its right-click menu, **When** both are opened, **Then** they present the same items in the same order and grouping.
3. **Given** either menu, **When** it renders, **Then** Delete sits alone in the final group, separated from the non-destructive actions.
4. **Given** a completed or archived spec, **When** either menu opens, **Then** the lifecycle items shown match that spec's lifecycle exactly as before this change.

---

### User Story 7 - Every file row can be found on disk (Priority: P2)

Some file-backed rows offer reveal actions and structurally identical ones do not; an orphan living spec cannot be revealed at all; a missing document offers a reveal that would fail. After this change reveal coverage is consistent: every row backed by a real file on disk offers both reveal actions, and rows with no file offer none.

**Why this priority**: Small but repeatedly annoying inconsistency; also removes a class of dead clicks.

**Independent Test**: Right-click each file-backed row in Living Specs and Steering and confirm both reveal actions appear and target the correct file.

**Acceptance Scenarios**:

1. **Given** an orphan living spec, **When** the user right-clicks it, **Then** both reveal actions appear and resolve that file's exact path.
2. **Given** any file-backed Steering row, **When** the user right-clicks it, **Then** both reveal actions appear.
3. **Given** a capability whose spec file does not exist, **When** the user right-clicks it, **Then** no reveal action is offered.
4. **Given** a provider-owned or tool-owned file, **When** the user right-clicks it, **Then** no destructive action is offered.

---

### User Story 8 - A Steering tree with an obvious shape (Priority: P3)

"Create Project Rule" and "Create Global Rule" float at the root, disconnected from the provider whose file they would create; the tree alternates between "Global" and "User" for the same idea; a section named "SpecKit Files" is ambiguous. After this change the root is built in one explicit order, each missing-rule action lives inside the scope it belongs to, and the vocabulary is consistent.

**Why this priority**: Real structural improvement, but the least-visited view of the four.

**Independent Test**: Open Steering with a provider whose project and user rule files are both missing.

**Acceptance Scenarios**:

1. **Given** a provider with no project rule file, **When** the user expands Provider > Project, **Then** the create action appears there and not at the tree root.
2. **Given** a provider with no user rule file, **When** the user expands Provider > User, **Then** the create action appears there.
3. **Given** any scope label in the tree, **When** it renders, **Then** it reads "User", never "Global".
4. **Given** the create action for a provider whose rule file is not the default one, **When** the user hovers it, **Then** the tooltip names that provider's actual filename.

---

### User Story 9 - The configuration row opens the configuration (Priority: P3)

Under the product's Steering node, "Configuration" behaves like a folder that must be expanded before anything can be opened, even though the thing it represents is a single file. After this change clicking it opens that file directly, while still allowing the setting groups to be browsed underneath.

**Why this priority**: A one-click fix to a small papercut (#429), naturally bundled into this pass.

**Independent Test**: Click the Configuration row under the product node.

**Acceptance Scenarios**:

1. **Given** the product node is installed and expanded, **When** the user clicks Configuration, **Then** the configuration file opens in the editor.
2. **Given** the same row, **When** the user expands it, **Then** its setting groups are still listed underneath.

---

### User Story 10 - Nothing that worked stops working (Priority: P1)

Everything above is presentation. A user's saved filter query, sort mode, keybindings, multi-select bulk actions, resume eligibility, and lifecycle transitions must behave identically after the redesign.

**Why this priority**: The redesign is only acceptable if it is behavior-neutral.

**Independent Test**: Exercise filter, sort, multi-select bulk archive/complete/reactivate, resume, and each lifecycle transition before and after; compare outcomes.

**Acceptance Scenarios**:

1. **Given** a persisted filter query and sort mode, **When** the extension reloads after the redesign, **Then** both are restored exactly as before.
2. **Given** a multi-selection of specs, **When** a bulk lifecycle action runs, **Then** it affects the same set of specs, with the same confirmation, as before.
3. **Given** a spec that was eligible for Resume, **When** the redesign ships, **Then** it is still eligible, under the same conditions.

## Edge Cases

- A workspace with **zero** specs must still render the welcome experience, never a blank broken tree.
- Living Specs with the feature turned **off**, turned **on but empty**, or in a recoverable error state must each render one informative row — never an empty panel.
- A **filtered** tree whose query matches nothing must still offer a one-click way back.
- A **completed or archived** spec, when expanded, must still show coherent per-document status icons — a structurally identical row must not go blank just because its parent's lifecycle moved on.
- A **missing** document row must not offer an action that would fail.
- The **More Actions** list must contain only actions valid in the current context — never a dead entry.
- A user who has **reordered** the views must keep their order; the contribution order is a default, not an override.
- A **provider** the extension does not recognize must render a neutral icon rather than crash or borrow a brand.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST title the living-specs view "Living Specs" and the settings view "Settings & Feedback", without changing any view id.
- **FR-002**: The system MUST render individual spec rows collapsed by default, while keeping the Active group expanded and the Completed and Archived groups collapsed.
- **FR-003**: The system MUST continue to omit any spec group that contains zero items, and MUST keep the group order Active, Completed, Archived with their counts.
- **FR-004**: The system MUST preserve the existing collapse-all / expand-all behavior for individual spec rows.
- **FR-005**: The system MUST use the editor's themed icon set for every functional and status concept in the sidebar, reserving custom artwork for the product's own identity mark and official provider marks.
- **FR-006**: The system MUST NOT render emoji characters in any tree label, description, or tooltip.
- **FR-007**: The system MUST communicate every status by at least one non-color signal in addition to any color used.
- **FR-008**: The system MUST render coherent per-document status icons for a spec's documents regardless of whether the parent spec is active, implemented, completed, or archived.
- **FR-009**: The system MUST resolve the provider icon through a single testable resolver that agrees with the provider display name for every supported provider and host editor.
- **FR-010**: The system MUST fall back to a neutral chat icon — never another vendor's brand — for an unrecognized host editor or an unknown provider.
- **FR-011**: The system MUST show at most four actions in the Specs title bar at any time: Filter, Sort, More Actions, and New Spec, with New Spec rightmost.
- **FR-012**: The system MUST prefill the filter input with the active query and MUST treat an empty submission as clearing the filter.
- **FR-013**: The system MUST expose collapse/expand, install, and upgrade through a More Actions picker, gated by the same conditions their title-bar entries used, and MUST keep every one of them reachable from the Command Palette.
- **FR-014**: The system MUST present the same actions, in the same order and grouping, in a spec row's hover More Actions submenu and in its right-click menu.
- **FR-015**: The system MUST isolate the delete action in a final, separate group in both spec-row menus.
- **FR-016**: The system MUST show at most two inline actions on a spec row: Resume (only when currently eligible) and More Actions.
- **FR-017**: The system MUST offer both reveal actions on every file-backed row in the Living Specs and Steering trees, including orphan living specs, and MUST resolve each row's exact path.
- **FR-018**: The system MUST NOT offer a reveal action on a row whose file does not exist.
- **FR-019**: The system MUST restrict destructive steering actions to the documents the product itself generates.
- **FR-020**: The system MUST nest each missing-rule create action inside its provider's Project or User group rather than at the tree root, and MUST name the configured provider's actual filename in that action's tooltip.
- **FR-021**: The system MUST build the Steering root in one explicit order and MUST use the word "User" consistently for user-scoped configuration.
- **FR-022**: The system MUST open the product's configuration file when its Configuration row is clicked, while still listing its setting groups as children.
- **FR-023**: The system MUST render an informative row for the Living Specs disabled, empty, or recoverable-error states — never a blank panel.
- **FR-024**: The system MUST present friendly, title-cased status text in tooltips and MUST NOT expose raw lifecycle keys.
- **FR-025**: The system MUST derive a document row's tooltip path from the stored path rather than reconstructing it from the display label.
- **FR-026**: The system MUST preserve every existing command id, view id, stored setting, lifecycle rule, multi-select behavior, filter, sort, and Resume gate.
- **FR-027**: The system MUST keep all sidebar rendering native to the host editor — no embedded web view, no custom styling, and no hand-rolled hover, focus, selection, or menu behavior.
- **FR-028**: The system MUST cover the contribution manifest and the tree presentation logic with automated tests that fail if the shipped presentation drifts from this specification.

### Key Entities

- **View** — one of the four panels in the product's activity-bar container. Has a stable identifier, a display title (changing here), a default visibility, and an order.
- **Spec row** — a single feature spec in the Specs tree. Carries a lifecycle state, a default expansion state (changing here), a status icon, a description, a tooltip, inline actions, and a context menu.
- **Document row** — a spec's individual document. Carries a completion state, an icon, a path-bearing tooltip, and an open action when the file exists.
- **Provider** — the configured AI assistant. Carries a display name and a mark; the two must always refer to the same product.
- **Steering node** — a section, group, or file-backed row in the Steering tree. File-backed nodes carry a resolvable path and therefore reveal actions.

## Success Criteria

### Measurable Outcomes

- **SC-001**: With 200+ completed specs and 4 active specs, the initial Specs viewport renders at most one row per active spec plus the group headers — no document rows.
- **SC-002**: The Specs title bar never renders more than 4 actions in any of the context combinations tested.
- **SC-003**: 100% of supported provider / host-editor combinations resolve to an icon that names the same product as the row's label.
- **SC-004**: 0 tree rows render a detailed illustration-style icon for a generic category.
- **SC-005**: 0 tooltips expose a raw lifecycle key, a reconstructed path, or the wrong provider filename.
- **SC-006**: 100% of file-backed rows in Living Specs and Steering offer both reveal actions; 0% of missing-file rows do.
- **SC-007**: The hover More Actions submenu and the right-click menu for a spec row are identical in item order and grouping.
- **SC-008**: All 23 acceptance criteria from the design plan pass, with compile, the full test suite, and the packaging build green.

## Assumptions

- Users may reorder views themselves; the contribution order is treated as a default, not enforced.
- "Wibey needs a mark or a documented fallback" is satisfied by an intentional, tested neutral icon plus documentation, since no official Wibey mark is available in the repository.
- Screenshots are captured by a human running the editor; the automated work stops at documentation text.
- The existing More Actions submenu contribution (already present with the target grouping) is the correct foundation for the hover/right-click alignment work rather than a new mechanism.

## Verbatim Constraints

- View title: `Living Specs`
- View title: `Settings & Feedback`
- Steering section title: `SpecKit Project Files`
- Living Specs disabled row: `Living Specs are off`
- Living Specs empty row: `No living specs yet`
- Specs title-bar actions, in order: `Filter`, `Sort`, `More Actions`, `New Spec`
- Spec-row menu groups, in order: `1_status`, `2_lifecycle`, `3_copy`, `4_reveal`, `5_danger`
