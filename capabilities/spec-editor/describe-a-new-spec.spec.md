# Describe a New Spec — Living Spec

## Purpose

The Create New Spec panel is where a person says what they want built before any AI runs. It covers what they can type and attach, when the form lets them go forward, and how it avoids losing what they wrote.

## Requirements

### A feature brief is the only thing a new spec needs
<!-- touches: apps/vscode/src/features/spec-editor/**, apps/vscode/webview/src/spec-editor/** -->

**SpecKit: New Spec**, the `+` in the Specs view and **Run Spec Hands-Off (Auto)** SHALL all open the same Create New Spec panel, and opening it again SHALL reveal the panel already open instead of starting a second one. The form SHALL allow creating only when the Feature Brief has non-blank text of at most 50,000 characters. A pasted Jira or GitHub link on its own counts as a brief.

#### Scenario: the brief is blank
- **WHEN** the Feature Brief is empty or only whitespace
- **THEN** Create Spec, Auto and the submit shortcut do nothing

#### Scenario: the brief is too long
- **WHEN** the text nears 90% of the limit
- **THEN** a character counter appears, and once over the limit it says how many characters to remove and creating stays blocked

### Images are attached by file picker or by paste
<!-- touches: apps/vscode/src/features/spec-editor/**, apps/vscode/webview/src/spec-editor/** -->

A person SHALL be able to attach PNG, JPG, GIF or WebP images of up to 2 MB each, through **Attach image** or by pasting an image from the clipboard. Each attached image SHALL show as a thumbnail with its file name and a remove control, adding or removing one SHALL be announced to screen readers, and a removed image SHALL be deleted and never handed to the assistant. A file name SHALL only ever be shown as text, in the thumbnail's label, its alternative text and the remove control's spoken name alike, so a name carrying quotes or markup can never become part of the page.

#### Scenario: an image is refused
- **WHEN** someone attaches an unsupported format or an image over 2 MB
- **THEN** the form shows an error naming the problem and the image is not attached

#### Scenario: a file name that looks like markup
- **WHEN** an attached image is named so that it closes an attribute and opens a tag
- **THEN** the thumbnail shows that name literally and nothing is injected into the form

### Typed text is not lost by accident
<!-- touches: apps/vscode/webview/src/spec-editor/** -->

The brief SHALL survive the panel being hidden and shown again, with the cursor where it was. Cancel and Esc SHALL ask for confirmation before discarding a brief that has text. A failed create SHALL leave the form open with its text, an error message and working buttons.

#### Scenario: cancelling a written brief
- **WHEN** someone presses Esc with text in the brief
- **THEN** they are asked whether to discard it, and declining keeps the panel and the text

### The form is usable from the keyboard alone
<!-- touches: apps/vscode/src/features/spec-editor/**, apps/vscode/webview/src/spec-editor/** -->

Ctrl+Enter SHALL create the spec, shown as Cmd+Enter on a Mac, and Esc SHALL cancel. Errors SHALL be announced as alerts and take focus on their dismiss control, and the "Creating your spec" busy state SHALL be announced while it blocks the form.

#### Scenario: submitting from the keyboard
- **WHEN** someone presses the submit shortcut with a valid brief
- **THEN** the spec is created with the selected workflow, the same as clicking Create Spec

## Uncovered

- Image attachments are not restored when the panel is rebuilt after being hidden. The text comes back, the thumbnails do not.
