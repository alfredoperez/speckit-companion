# Editor UI — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The browser-side half of the Create Spec panel. It takes a free-form description, pasted images and a workflow choice, keeps the draft safe across hides and reloads, and hands a well-formed submission to the extension.

## Requirements

### A typed message channel is the editor's only way to affect anything
<!-- touches: webview/src/spec-editor/index.ts, webview/src/spec-editor/types.ts -->

The editor UI SHALL cause no side effect outside its own document. Every outcome a user asks for (creating a spec, running a workflow command, attaching or removing an image, cancelling, opening docs) MUST be posted as a message to the extension, and every change to the editor's own contents MUST arrive as a message back. The install banner's install and dismiss messages MUST carry the prompt the banner itself declares, read back off the banner and forwarded untouched.

#### Scenario: the user asks for something with an effect
- **WHEN** any control in the editor is activated
- **THEN** the editor posts a message describing the intent and does no privileged work itself
- **AND** it waits for the extension's reply rather than assuming success

#### Scenario: an attachment is accepted
- **WHEN** the extension confirms an image was stored
- **THEN** the editor takes the attachment's identity and preview location from that reply
- **AND** it never builds them itself from the local file

#### Scenario: a control on the install banner is used
- **WHEN** the install or the dismiss control is activated
- **THEN** the message carries the prompt the banner declared, so the extension acts on the banner the user saw

### One gate decides whether the description can be submitted

Submittability MUST be decided by one pure predicate: non-empty after trimming and within the length limit. Every path that can start a submission (keyboard shortcut, primary button, hands-off button, workflow command buttons) MUST consult it. The predicate lives outside the DOM so it can be tested without a webview harness.

#### Scenario: description is only whitespace
- **WHEN** the user has typed only spaces or newlines
- **THEN** every submission affordance is disabled
- **AND** the keyboard shortcut does nothing rather than submitting an empty spec

#### Scenario: description exceeds the length limit
- **WHEN** the content passes the maximum
- **THEN** every path refuses submission
- **AND** the counter says how many characters must be removed, not merely that they are over

#### Scenario: the description is short
- **WHEN** the content is well under the limit
- **THEN** the character counter is visually hidden but stays in the accessibility tree

### Typed work is never lost without the user choosing to lose it

Typed content and cursor position MUST be saved to webview state as the user types, debounced so saving never competes with typing, and restored when the panel is revived. VS Code can hide or reload the panel at any time, and losing a half-written description is the most expensive failure here. Cancelling with content present MUST ask for confirmation, on the keyboard path as well as the button path.

#### Scenario: the panel is hidden and reopened
- **WHEN** the user switches away and returns
- **THEN** the description and the caret position are as they were
- **AND** the character counter reflects the restored content immediately

#### Scenario: attachments outlive the same interruption
- **WHEN** the panel is restored with images already attached
- **THEN** the extension re-supplies the attachment list and the previews reappear

#### Scenario: cancel with content present
- **WHEN** the user cancels while the description is non-empty
- **THEN** they are asked to confirm the discard
- **AND** declining leaves the draft untouched

#### Scenario: cancel with an empty editor
- **WHEN** there is nothing typed
- **THEN** the panel closes without a prompt

### Attachments are screened before they leave the webview

The editor MUST reject unsupported image formats and oversized files locally, with a message naming the problem, instead of forwarding them. Pasting an image and picking one from the file dialog MUST behave identically. These checks are advisory and exist for responsiveness, so the extension is still required to re-validate.

#### Scenario: an unsupported file is pasted
- **WHEN** the clipboard carries a non-image or an unsupported image type
- **THEN** the editor reports what was wrong and sends nothing

#### Scenario: an attachment's name carries markup
- **WHEN** a filename contains quotes or angle brackets
- **THEN** the preview, its label and its remove control are built with DOM APIs, so the name can never escape into markup or an attribute

### The chosen workflow determines which submission affordances exist

Submission affordances MUST be derived from the selected workflow's own declaration, never hard-coded, so adding a workflow needs no edit to this surface. A declared hands-off orchestrator gets the hands-off affordance, declared entry commands get a button each, and a workspace with only one workflow hides the chooser. A declaration MAY carry an `installed` flag, which the extension decides (the Companion entry sets it from whether the spec-kit extension is present). When the selected workflow is not installed, the primary affordance MUST become the install action and the hands-off affordance MUST be withheld, because such a workflow cannot create anything.

#### Scenario: the selected workflow has no hands-off mode
- **WHEN** the user picks such a workflow
- **THEN** the hands-off affordance is not offered
- **AND** the ordinary create path stays available

#### Scenario: only one workflow is configured
- **WHEN** the workspace offers no alternative
- **THEN** the chooser is hidden and that workflow's affordances apply directly

#### Scenario: the selected workflow is not installed
- **WHEN** the user picks it
- **THEN** the primary button reads as the install and the hands-off affordance is hidden
- **AND** activating it posts the install request, not a submission

### The workflow choice sells itself: descriptions visible, state on the card, a low-commitment trial

The workflow chooser MUST be a native select showing the selected workflow's name when closed, so the description box stays above the fold. A banner directly under it SHALL show the Companion pitch (its description, install badge and one-spec trial) whenever Companion is not installed, whatever is selected, and SHALL NOT show it once Companion is installed. When a project-defined workflow is selected, the banner SHALL show that workflow's own description. A not-installed workflow says so in its option text without mangling its name. The trial selects Companion for the current submission only, and this surface never reads or writes the configured default workflow. Every submission reports the selected workflow and how it was selected: the untouched pre-selection, an ordinary change, or the trial.

#### Scenario: the form opens
- **WHEN** it renders
- **THEN** the description box is visible without scrolling, and the chosen workflow is readable in the closed select

#### Scenario: Companion is not installed
- **WHEN** any workflow is selected
- **THEN** the Companion banner shows with its badge and, when Companion is not the default, its trial
- **AND** taking the trial selects Companion in the picker and submits with the trial marker, leaving the configured default unchanged

#### Scenario: Companion is installed
- **WHEN** it is selected
- **THEN** no banner shows, since there is nothing to pitch

#### Scenario: a project-defined workflow is selected
- **WHEN** it carries a description
- **THEN** the banner shows that description, without the Companion glyph

### A submission in flight locks the surface and announces itself

While the extension is working, the editor MUST block a second submission from any path, mark the content region busy for assistive technology, and announce the change in a live region. Announcements MUST also cover adding and removing attachments. The busy state belongs on the content region, not on the overlay shown during the wait.

#### Scenario: the user double-submits
- **WHEN** a submission is already running and the user presses the shortcut again
- **THEN** nothing further is sent

#### Scenario: submission fails
- **WHEN** the extension reports an error
- **THEN** the busy state is released, the message is shown as escaped text, and focus moves to the control that dismisses it

### The Storybook mock stays a faithful stand-in for the real form
<!-- touches: webview/src/spec-editor/CreateSpecMock.tsx, webview/src/spec-editor/__stories__/CreateSpec.stories.tsx -->

The shipped editor is imperative DOM, so a separate Preact mock serves as its visual baseline. The mock MUST reflect every state of the real form: empty, over-limit, submitting, hands-off available or not, attachments present, a narrow split-pane layout, and the workflow row (several workflows with a project-defined description in the banner, Companion not installed with its badge and trial, and Companion selected while missing so the primary button becomes the install and the hands-off affordance is withheld). The workflow choice MUST be mocked as the shipped native select with the pitch banner and its trial beneath it, not as a stack of cards. The mock MUST render through the shipped `spec-editor.css` with the real form's class names and native controls (`textarea`, `select`), not bespoke inline styles. When the real form gains or loses a state, updating the mock is part of that change, not a follow-up. [inferred]

The mock is still hand-maintained and nothing checks that its structure matches the real DOM, so a stale mock misleads every reviewer who trusts it. Sharing the shipped stylesheet limits that drift to structure rather than appearance.

#### Scenario: attachments are present
- **WHEN** the form is shown with images attached
- **THEN** the mock renders each as a thumbnail carrying its name and a remove control, matching the real preview list

#### Scenario: the panel is narrow
- **WHEN** the editor is shown at a constrained (split-pane) width
- **THEN** the mock exercises that layout so it is reviewable

#### Scenario: a submission state is added or changed
- **WHEN** the real form gains a new visual state
- **THEN** the mock gains a matching story in the same change

## Uncovered

_None. Every file in the area was read._
