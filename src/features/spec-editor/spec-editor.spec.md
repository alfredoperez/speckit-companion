# Spec Editor — Living Spec

## Purpose

The extension side of the Create Spec panel: it turns what the user typed and pasted into a file on disk, hands the AI a command pointing at it, records the chosen workflow, and cleans up afterwards.

## Requirements

### Submitted intent becomes a durable artifact, not a terminal string

On submit, the host SHALL write the description and attachments into one document on disk and dispatch a command pointing at it, because a shell command line cannot carry long text or pasted images. An empty submission writes and dispatches nothing, and the panel is told why.

#### Scenario: a long spec with several pasted images is submitted
- **WHEN** the user submits
- **THEN** a document with the text and a reference to each stored image is written, and the dispatched command carries its path, not its contents

#### Scenario: submission is attempted with empty content
- **WHEN** the user submits
- **THEN** nothing is written or dispatched, and the panel shows why

### The chosen workflow is recorded with the spec, verbatim

The creation command SHALL record the workflow the spec actually runs in the spec's own state, so every later step dispatches from that record and not from the current project default. A missing dependency MUST never silently change the recorded workflow: the record, the dispatched command and the reported creation event always name the same one.

#### Scenario: the user picks the Companion workflow
- **WHEN** the spec is created
- **THEN** Companion is recorded, and later steps dispatch Companion commands

#### Scenario: a Companion pick is switched to stock at the install prompt
- **WHEN** the user chooses to continue with SpecKit instead of installing
- **THEN** the stock workflow is recorded, the same value the creation event reports

### Every workflow list offers Companion and only workflows the provider can run

Every surface that lists workflows SHALL build the list the same way. Companion is always listed, marked install-to-enable when the spec-kit extension is missing, and a custom workflow with a step the active provider cannot run is left out.

#### Scenario: the companion piece is not installed
- **WHEN** the panel builds its workflow list
- **THEN** Companion is present and marked install-to-enable

#### Scenario: a custom workflow names a step the active provider cannot run
- **WHEN** the list is built
- **THEN** that workflow is omitted

#### Scenario: two surfaces list workflows under the same conditions
- **WHEN** each renders its list
- **THEN** both offer exactly the same set

### A missing dependency degrades or refuses, but never dispatches something unresolvable
<!-- touches: src/features/spec-editor/installBanner.ts, src/features/spec-editor/specEditorProvider.ts, src/features/spec-editor/types.ts -->

When the chosen action needs the missing spec-kit extension, the host SHALL ask before creating anything, then install, fall back to the stock equivalent, or refuse when there is none. It MUST never dispatch a command the AI cannot resolve.

#### Scenario: an ordinary Companion pick without the extension
- **WHEN** the user submits
- **THEN** a modal lists Companion's benefits with Install, Use SpecKit Instead and Cancel before anything is created
- **AND** Install starts the install and creates nothing, Use SpecKit Instead creates a stock spec, and Cancel leaves the editor as it was

#### Scenario: the user already chose SpecKit at the modal once
- **WHEN** they submit another Companion pick without the extension
- **THEN** the stock spec is created without asking again

#### Scenario: the hands-off run is requested without the extension
- **WHEN** the user triggers it
- **THEN** nothing runs, and a warning explains why with an install action

### Attachments live outside the workspace unless a provider's sandbox forces otherwise

Attachments SHALL be stored in extension-owned storage outside the repository, or the system temp folder when that is not writable. Only for a provider that can read only inside the project are they copied into a workspace cache that ignores itself from version control. If that copy fails, the original references stand and the submission proceeds.

#### Scenario: the active provider cannot read outside the project root
- **WHEN** a spec with images is submitted
- **THEN** the images are copied into a self-ignoring workspace cache and the document points at those copies

#### Scenario: no workspace folder is open, or the copy fails
- **WHEN** staging is attempted
- **THEN** the original references are kept and the submission proceeds

### Every temporary artifact is tracked with an expiry and reclaimed later, never immediately

Each set of submitted files SHALL be recorded with its own expiry and swept on a later activation, never deleted right after dispatch, because the AI reads the files after the command is sent. A staged copy is recorded under its own key, so it never overwrites the original set's record.

#### Scenario: a submission finishes and the panel closes
- **WHEN** dispatch completes
- **THEN** the files stay on disk until a later sweep

#### Scenario: the extension restarts after sets expire
- **WHEN** activation runs
- **THEN** expired sets are deleted and the count is logged

### Opening the editor twice reveals the one already open

At most one Create Spec panel SHALL exist, and opening it again reveals the existing one with its content intact.

#### Scenario: the editor is opened while it is already open
- **WHEN** the open action fires
- **THEN** the existing panel comes forward with its draft, and no second panel appears

### Every failure reaches the panel

An unreadable attachment, a size limit, a missing dependency or a failed dispatch SHALL reach the panel as a message the user sees, never only a log line.

#### Scenario: an attached image exceeds the per-image limit
- **WHEN** it is processed
- **THEN** the panel shows an error describing the problem

## Uncovered

- `installBanner.test.ts` and the contents of `__tests__/`: not read. Every non-test file in the area was read in full.
