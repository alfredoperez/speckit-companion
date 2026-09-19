# Editor UI — Living Spec

## Purpose

The browser side of the Create Spec panel. It takes a description, pasted images and a workflow choice, keeps the draft safe across hides and reloads, and hands a well-formed submission to the extension.

## Requirements

### The install banner acts on the prompt it showed
<!-- touches: webview/src/spec-editor/index.ts, webview/src/spec-editor/types.ts -->

The install banner's install and dismiss messages SHALL carry the prompt the banner itself declares, read back off the banner, so the extension acts on the banner the user saw.

#### Scenario: an update banner is dismissed
- **WHEN** the dismiss control is used
- **THEN** the message names the update prompt, so only that version is silenced and the install banner's permanent dismissal is not written

### An empty or over-limit description cannot be submitted from any path

Every way to submit (keyboard shortcut, primary button, hands-off button, workflow command buttons) SHALL refuse a description that is blank after trimming or longer than the limit.

#### Scenario: the description is only whitespace
- **WHEN** the user presses the submit shortcut
- **THEN** nothing is submitted and every submit control is disabled

#### Scenario: the description exceeds the limit
- **WHEN** the content passes the maximum
- **THEN** every path refuses, and the counter says how many characters to remove

### Typed work is never lost without the user choosing to lose it

The description and caret position SHALL be saved as the user types and restored when the panel is hidden or reloaded, with attachments re-supplied by the extension. Cancelling with text present MUST ask for confirmation, from the keyboard as well as the button.

#### Scenario: the panel is hidden and reopened
- **WHEN** the user switches away and returns
- **THEN** the description, caret and character counter are as they were

#### Scenario: the panel is restored with images attached
- **WHEN** it reloads
- **THEN** the image previews reappear

#### Scenario: cancel with text present
- **WHEN** the user presses Escape or Cancel
- **THEN** they are asked to confirm, and declining leaves the draft untouched

### Unsupported or oversized images are rejected before upload

The editor SHALL reject unsupported image types and oversized files with a message naming the problem, the same way for paste and the file picker. The extension still re-validates what it receives.

#### Scenario: an unsupported file is pasted
- **WHEN** the clipboard carries a non-image or an unsupported image type
- **THEN** the editor says what was wrong and sends nothing

### An attachment's name can never become markup

An attachment's preview, label and remove control SHALL be built with DOM APIs, so a filename is only ever text.

#### Scenario: a filename contains quotes or angle brackets
- **WHEN** its preview renders
- **THEN** the name shows literally and nothing in it is parsed as markup or an attribute

### The chosen workflow determines which submission affordances exist

Submit controls SHALL come from the selected workflow's own declaration, so adding a workflow needs no change here: a hands-off orchestrator gets the hands-off button and each entry command gets a button. With only one workflow the chooser is hidden. A workflow the extension marks not installed turns the primary button into its install action and withholds hands-off.

#### Scenario: the selected workflow has no hands-off mode
- **WHEN** the user picks it
- **THEN** the hands-off button is not offered and Create Spec stays available

#### Scenario: the selected workflow is not installed
- **WHEN** the user picks it
- **THEN** the primary button reads "Install …", hands-off is hidden, and pressing it asks for the install instead of submitting

### The Companion pitch shows until Companion is installed, and its trial never changes the default

While Companion is not installed, a banner under the workflow select SHALL show its description, an install badge and, when Companion is not the default, a one-spec trial, whatever is selected. Once installed, the banner shows the selected project workflow's own description, or nothing. The trial selects Companion for this submission only, and this panel never writes the configured default.

#### Scenario: Companion is not installed
- **WHEN** any workflow is selected
- **THEN** the Companion banner shows with its badge

#### Scenario: the user takes the trial
- **WHEN** they press "Try Companion for this spec"
- **THEN** Companion is selected, the submission is marked as a trial, and the configured default is unchanged

### A submission in flight locks the surface and announces itself

While the extension works, the editor SHALL refuse a second submission from any path, mark the content busy for assistive technology, and announce it in a live region, as it does for added and removed attachments.

#### Scenario: the user double-submits
- **WHEN** a submission is running and the shortcut is pressed again
- **THEN** nothing more is sent

#### Scenario: submission fails
- **WHEN** the extension reports an error
- **THEN** the busy state clears, the message shows as text, and focus moves to its dismiss control

### The Storybook mock stays a faithful stand-in for the real form
<!-- touches: webview/src/spec-editor/CreateSpecMock.tsx, webview/src/spec-editor/__stories__/CreateSpec.stories.tsx -->

The shipped form is imperative DOM, so a Preact mock is its visual baseline. The mock SHALL render through the shipped stylesheet with the real class names and native controls, and cover every state of the real form. Nothing checks its structure against the real DOM, so a new form state gets a matching story in the same change.

#### Scenario: the real form gains a visual state
- **WHEN** that change lands
- **THEN** the mock has a story showing it

## Uncovered

_None. Every file in the area was read._
