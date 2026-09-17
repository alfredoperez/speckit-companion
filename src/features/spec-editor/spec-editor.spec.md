# Spec Editor — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The extension-side host for the "describe your feature" panel turns what the user typed and pasted into an artifact on disk, hands the AI a command pointing at it, and cleans up afterwards. It also records the chosen workflow and recovers when a provider cannot read the files it was handed.

## Requirements

### Submitted intent becomes a durable artifact, not a terminal string

On submit, the host SHALL write the user's content and attachments into a self-contained document on disk and dispatch a command that points at that document instead of inlining the text. A shell command line cannot carry long specs, pasted images, or trailing machine-readable instructions.

#### Scenario: a long spec with several pasted images is submitted
- **WHEN** the user submits
- **THEN** a document with the content and a reference to each stored image is written
- **AND** the dispatched command carries the document's path, not its contents

#### Scenario: submission is attempted with empty content
- **WHEN** the user submits
- **THEN** nothing is written or dispatched
- **AND** the panel is told why

### The chosen workflow is recorded with the spec, verbatim

The creation instruction SHALL seed the workflow the spec actually runs into the spec's own state record, so every later step resolves its command from that record and not from the current project default. The recorded name is the effective selection after the install modal: an installed pick is recorded verbatim, and a pick the user downgraded through the install-first prompt records the stock choice they accepted. A missing dependency MUST never silently rewrite the recorded workflow, and the record, the dispatched command family, and the reported creation attribution always agree on one value.

#### Scenario: the user picks the Companion workflow
- **WHEN** the spec is created
- **THEN** the creation instruction seeds that workflow into the spec's record
- **AND** later steps dispatch from that recorded choice

#### Scenario: a Companion pick is downgraded via the install-first prompt
- **WHEN** the user chooses to continue with stock instead of installing
- **THEN** the record seeds the stock workflow, the same value the creation event reports

### The picker never offers a silent degrade, but Companion stays visible as install-to-enable

The workflow list SHALL be built from what the active AI provider supports, omitting provider-incompatible custom workflows. Companion is ALWAYS listed, even without the spec-kit extension, labeled install-to-enable and flagged not-installed, and a not-installed pick is intercepted before any dispatch instead of quietly running stock. Every surface that offers a workflow list MUST build it through the one shared pick-surface builder and its shared availability predicate, because a second private builder reopens the bug where the ungated list was the one that rendered.

#### Scenario: two surfaces offer a workflow list under the same conditions
- **WHEN** each renders its list
- **THEN** both offer exactly the same set, because both delegated to the shared builder

#### Scenario: the companion piece is not installed
- **WHEN** the panel builds its workflow list
- **THEN** the Companion entry is still present, labeled install-to-enable and flagged not-installed
- **AND** picking it raises an install-first prompt instead of silently producing a stock spec

#### Scenario: a user-defined workflow names a step the active provider cannot run
- **WHEN** the list is built
- **THEN** that workflow is omitted

### A missing dependency degrades or refuses, but never dispatches something unresolvable
<!-- touches: src/features/spec-editor/installBanner.ts, src/features/spec-editor/specEditorProvider.ts, src/features/spec-editor/types.ts -->

When a chosen action needs the missing companion piece, the host SHALL downgrade to the equivalent stock action, or refuse to start when there is none, and MUST never dispatch a command the AI cannot resolve. The user gets a non-blocking explanation and a one-click install. The host SHALL record when the install prompt is shown and when it is clicked.

An ordinary (non-Auto, non-custom) Companion pick without the companion piece SHALL show a modal with its benefits and three choices before any spec is created: install, "use SpecKit instead", or cancel. Install starts the install and aborts creation, "use SpecKit instead" takes the stock downgrade, and cancel creates nothing and leaves the editor interactive. The panel SHALL pre-select the effective default workflow: the user's explicit choice when set, otherwise Companion when the extension is installed.

#### Scenario: the Companion entry point is chosen without the companion piece
- **WHEN** the user submits an ordinary Companion pick
- **THEN** a benefits-and-install-first prompt appears before anything is created
- **AND** installing aborts creation to be re-run once installed, declining takes the stock equivalent, and cancelling creates nothing

#### Scenario: the hands-off run is requested without the companion piece
- **WHEN** the user triggers it
- **THEN** nothing runs, because it has no stock equivalent
- **AND** the panel shows the reason instead of appearing to start

The install-first modal is asked once: choosing "use SpecKit instead" SHALL be remembered in global state, and the modal SHALL NOT be raised again for that user. The fallback warning SHALL be one sentence owned by the shared dispatch routine, raised through it from Create Spec and every pipeline step, on a session cooldown so a failed install is not hidden for the rest of the session. The install banner's markup SHALL be single-sourced under the protocol layer, so the Create-Spec panel and the viewer's Activity panel render the same banner.

The one shared resolver SHALL decide which banner shows, not the panel: an absent companion piece asks to install, one behind this build's version asks to update, and a current install shows nothing. The update banner names both versions, offers a single Update action and no "Learn more", and reports its exposure and click under its own surface name. The banner SHALL carry the prompt the user saw and send it back with the click, so a dismissal writes the flag for the banner that was closed; a message without one is treated as the install banner.

#### Scenario: the user has already chosen SpecKit at the modal
- **WHEN** they submit another Companion pick without the companion piece
- **THEN** the stock downgrade proceeds without the modal

#### Scenario: a four-step Companion run without the companion piece
- **WHEN** each step falls back to stock
- **THEN** the warning is shown once, and the log records every fallback

#### Scenario: the installed companion piece is behind this build
- **WHEN** the panel is rendered
- **THEN** the update banner shows the installed and expected versions, with one Update action
- **AND** the exposure is reported under the update surface, not the install one

#### Scenario: the banner is dismissed
- **WHEN** the dismiss control is used
- **THEN** the banner's declared prompt is sent back with the dismissal, so an update is silenced for that version alone and the install banner's permanent flag is not written by mistake

### Attachments live outside the workspace unless a provider's sandbox forces otherwise

Stored attachments SHALL default to extension-owned storage outside the user's repository, falling back to a system temporary location when that storage is not writable. Only when the active provider sandboxes reads to the project root are attachments copied into the workspace, into a cache directory that ignores itself from version control on first use. If that copy fails, the original references stand and the submission proceeds.

#### Scenario: the active provider cannot read outside the project root
- **WHEN** a spec with images is submitted
- **THEN** the images are copied into a self-ignoring workspace cache
- **AND** the document's references point at the in-project copies

#### Scenario: no workspace folder is open, or the copy fails
- **WHEN** staging is attempted
- **THEN** the original references are kept and the submission proceeds

### Every temporary artifact is tracked with an expiry and reclaimed later, never immediately

Each artifact set SHALL be registered in a manifest with its own distinct key, its paths, and its expiry, and expired, orphaned, and finished sets are swept on activation. Cleanup MUST NOT delete right after dispatch, because the AI reads the files asynchronously and would race the delete. Reusing an existing set's key clobbers that set's record and leaks its directory.

#### Scenario: a submission finishes and the panel closes
- **WHEN** dispatch completes
- **THEN** the set is marked submitted and left on disk for a later sweep

#### Scenario: a follow-on staged copy is registered for an existing set
- **WHEN** it is written to the manifest
- **THEN** it uses a derived key distinct from the original set's
- **AND** the original set's record and directory survive

#### Scenario: the editor is closed mid-session and the extension restarts
- **WHEN** activation runs
- **THEN** artifact sets past their expiry are deleted and the deletion count is logged

### The panel is a single live session, and every failure reaches it

At most one editor panel SHALL exist at a time, and a second request reveals the existing one. Every failure, such as an unreadable attachment, a size limit, a missing dependency, or a failed dispatch, MUST reach the panel as a renderable message, never only a log. The panel's markup is served under a strict content policy with a per-load nonce and an explicit allow-list of resource locations.

#### Scenario: the editor is opened while a session is already running
- **WHEN** the open action fires
- **THEN** the existing panel is revealed with its content intact
- **AND** no second session is created

#### Scenario: an attached image exceeds the per-image limit
- **WHEN** it is processed
- **THEN** the panel receives an error message describing the failure

## Uncovered

- `installBanner.test.ts` and the contents of `__tests__/`: not read. Every non-test file in the area was read in full.
