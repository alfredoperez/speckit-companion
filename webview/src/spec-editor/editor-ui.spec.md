# Editor UI — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The browser-side half of the Create Spec panel: it is the first thing a user touches in the spec pipeline, so it has to take a free-form description (plus pasted images and a workflow choice), keep that draft safe while the panel is hidden or the window is reloaded, and hand a well-formed submission to the extension. Without it there is no in-editor entry point to the pipeline — a user would have to type slash commands into a terminal and would lose an in-progress description any time the panel lost focus.

## Requirements

### A typed message channel is the editor's only way to affect anything

The editor UI SHALL cause no side effect outside its own document. Every outcome a user asks for — creating a spec, running a workflow command, attaching or removing an image, cancelling, opening docs — MUST be expressed as a message on the webview→extension channel, and every change to the editor's own contents MUST arrive as a message back. The webview has no filesystem, no workspace, and no credentials; keeping the boundary total is what lets the extension remain the single place where authority and validation live.

#### Scenario: the user asks for something with an effect
- **WHEN** any control in the editor is activated
- **THEN** the editor posts a message describing the intent and performs no privileged work itself
- **AND** it waits for the extension's reply rather than optimistically assuming success

#### Scenario: an attachment is accepted
- **WHEN** the extension confirms an image was stored
- **THEN** the editor learns the attachment's identity and preview location from that reply
- **AND** it never constructs those itself from the local file

### One gate decides whether the description can be submitted

Submittability MUST be computed by a single pure predicate — non-empty after trimming, within the length limit — and every path that can start a submission MUST consult it. Keyboard shortcut, primary button, hands-off button, and workflow command buttons are entry points to the same decision, not four independent opinions. The predicate lives outside the DOM so it can be tested without a webview harness.

#### Scenario: description is only whitespace
- **WHEN** the user has typed nothing but spaces or newlines
- **THEN** every submission affordance is disabled
- **AND** the keyboard shortcut is inert rather than silently submitting an empty spec

#### Scenario: description exceeds the length limit
- **WHEN** the content passes the maximum
- **THEN** submission is refused on every path
- **AND** the counter tells the user how many characters must be removed, not merely that they are over

#### Scenario: the description is short
- **WHEN** the content is well under the limit
- **THEN** the character counter is not visible as clutter, but remains reachable to assistive technology rather than removed from the accessibility tree

### Typed work is never lost without the user choosing to lose it

Typed content and cursor position MUST be persisted to webview state as the user types, debounced so persistence never competes with typing, and restored when the panel is revived. The panel can be hidden, backgrounded, or reloaded by VS Code at any time; losing a half-written feature description to that is the single most expensive failure this surface can have. Discarding MUST likewise be deliberate: cancelling with content present requires confirmation, on the keyboard path as much as the button path, because the keyboard path is the one a user reaches by reflex.

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

The editor MUST reject unsupported image formats and oversized files locally, with a message naming the actual problem, rather than forwarding them and letting the extension fail. Pasting an image and picking one from the file dialog MUST behave identically. This is a responsiveness guarantee, not a security one — the extension is still required to re-validate, since the webview's checks are advisory.

#### Scenario: an unsupported file is pasted
- **WHEN** the clipboard carries a non-image or an unsupported image type
- **THEN** the editor reports what was wrong and sends nothing

#### Scenario: an attachment's name carries markup
- **WHEN** a filename contains quotes or angle brackets
- **THEN** the preview, its label, and its remove control are constructed through DOM APIs so the name can never escape into markup or an attribute

### The chosen workflow determines which submission affordances exist

Submission affordances MUST be derived from the selected workflow's own declaration rather than hard-coded. A workflow that declares a hands-off orchestrator gets the hands-off affordance; a workflow that declares named entry commands gets a button per command; a workspace with only one workflow hides the chooser entirely instead of showing a one-item control. Adding a workflow must not require editing this surface.

#### Scenario: the selected workflow has no hands-off mode
- **WHEN** the user picks such a workflow
- **THEN** the hands-off affordance is not offered
- **AND** the ordinary create path stays available

#### Scenario: only one workflow is configured
- **WHEN** the workspace offers no alternative
- **THEN** the chooser is hidden and that workflow's affordances are applied directly

### A submission in flight locks the surface and announces itself

While the extension is working, the editor MUST prevent a second submission from any path, mark the content region busy for assistive technology, and announce the state change in a live region. Announcements MUST also cover attachment add/remove, since those are otherwise silent visual-only changes. Busy state belongs on the content region — not on the transient overlay that appears during the wait.

#### Scenario: the user double-submits
- **WHEN** a submission is already running and the user presses the shortcut again
- **THEN** nothing further is sent

#### Scenario: submission fails
- **WHEN** the extension reports an error
- **THEN** the busy state is released, the message is shown as escaped text, and focus moves to the control that dismisses it

### The Storybook mock stays a faithful stand-in for the real form

Because the shipped editor is imperative DOM rather than a component tree, a separate Preact mock exists purely as the visual baseline. That mock MUST reflect the real form's states — empty, over-limit, submitting, hands-off-available-or-not, attachments-present, and a narrow (split-pane) layout — so a reviewer reading Storybook is not shown an arrangement the product never produces. To keep the visuals honest, the mock MUST render through the shipped `spec-editor.css` using the real form's class names and native controls (`textarea`, workflow `select`) rather than bespoke inline styles, so it inherits the product's styling instead of re-declaring it. When the real form gains or loses a state, updating the mock is part of that change, not a follow-up. [inferred]

This duplication is accepted for now and its cost is recorded plainly: the mock is still hand-maintained and nothing enforces that its structure matches the real DOM, so a stale mock misrepresents the product to every reviewer who trusts it — though sharing the shipped stylesheet narrows the drift to structure rather than appearance.

#### Scenario: attachments are present
- **WHEN** the form is shown with images attached
- **THEN** the mock renders each as a thumbnail carrying its name and a remove control, matching the real preview list

#### Scenario: the panel is narrow
- **WHEN** the editor is shown in a constrained (split-pane) width
- **THEN** the mock exercises that layout so the responsive arrangement is reviewable

#### Scenario: a submission state is added or changed
- **WHEN** the real form gains a new visual state
- **THEN** the mock gains a matching story in the same change

## Uncovered

_None — every file in the area was read._
