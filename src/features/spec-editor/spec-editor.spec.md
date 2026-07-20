# Spec Editor — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

This is the extension-side host for the "describe your feature" panel: it turns whatever the user typed and pasted into a durable artifact on disk, hands the AI a command pointing at that artifact, and cleans up afterwards. Without it, spec creation would be a raw string shoved at a terminal — no images, no record of which workflow was chosen, and no way to recover from a provider that cannot read the files it was handed.

## Requirements

### Submitted intent becomes a durable artifact, not a terminal string

On submit, the host SHALL materialize the user's content and attachments into a self-contained document on disk and dispatch a command that *points at* that document, rather than inlining the text into the command. This is what makes arbitrarily long specs, pasted images, and trailing machine-readable instructions possible at all — a shell command line is not a viable transport for any of them.

#### Scenario: a long spec with several pasted images is submitted
- **WHEN** the user submits
- **THEN** a document containing the content and references to each stored image is written
- **AND** the dispatched command carries the document's path, not its contents

#### Scenario: submission is attempted with empty content
- **WHEN** the user submits
- **THEN** nothing is written or dispatched
- **AND** the panel is told why

### The chosen workflow is recorded with the spec, verbatim

The workflow the user picked SHALL be carried into the new spec's own state record as part of the creation instruction, so every later step resolves its command from the spec's recorded choice rather than from whatever the project default happens to be at that moment. The picked name is recorded as picked, even when the piece that implements it is missing — each step then applies the same fallback independently, so one absent dependency cannot silently rewrite the spec's identity.

#### Scenario: the user picks the Companion workflow
- **WHEN** the spec is created
- **THEN** the creation instruction seeds that workflow into the spec's record
- **AND** later steps dispatch from that recorded choice

### The picker offers only workflows that can actually run

The workflow list SHALL be built from what the active AI provider supports and what is genuinely installed, so the picker never lists an option that would silently degrade to something else. Every builder that feeds a workflow list MUST share one predicate — this repo has shipped a bug where one of two independent list builders was gated and the other was not, and the ungated one was the one that rendered.

#### Scenario: the companion piece is not installed
- **WHEN** the panel builds its workflow list
- **THEN** the Companion entry is absent rather than present-and-degrading

#### Scenario: a user-defined workflow names a step the active provider cannot run
- **WHEN** the list is built
- **THEN** that workflow is omitted

### A missing dependency degrades or refuses, but never dispatches something unresolvable

When a chosen action needs the companion piece and it is absent, the host SHALL either downgrade to the equivalent stock action or, when there is no equivalent, refuse to start at all. Either way the user gets a non-blocking explanation and a one-click way to install. Dispatching a command the AI cannot resolve is never acceptable.

#### Scenario: the Companion entry point is chosen without the companion piece
- **WHEN** the user submits
- **THEN** the stock equivalent runs
- **AND** a dismissible warning offers to install the missing piece

#### Scenario: the hands-off run is requested without the companion piece
- **WHEN** the user triggers it
- **THEN** nothing runs, because it has no stock equivalent
- **AND** the panel surfaces the reason rather than appearing to start

### Attachments live outside the workspace unless a provider's sandbox forces otherwise

Stored attachments SHALL default to extension-owned storage outside the user's repository, falling back to a system temporary location when that storage is not writable. Only when the active provider sandboxes its reads to the project root are the attachments copied *into* the workspace, and then only into a cache directory that ignores itself from version control on first use. If that copy cannot be made, the original references stand rather than the submission failing.

#### Scenario: the active provider cannot read outside the project root
- **WHEN** a spec with images is submitted
- **THEN** the images are copied into a self-ignoring workspace cache
- **AND** the document's references are rewritten to the in-project copies

#### Scenario: no workspace folder is open, or the copy fails
- **WHEN** staging is attempted
- **THEN** the original references are kept and the submission proceeds

### Every temporary artifact is tracked with an expiry and reclaimed later, never immediately

Each artifact set SHALL be registered in a manifest carrying its own distinct key, its paths, and when it expires; expired, orphaned, and finished sets are swept on activation. Cleanup MUST NOT be an immediate post-dispatch delete — the AI reads the files asynchronously after the command is handed off, so deleting on dispatch races the read. Each registered set needs a key of its own: reusing an existing set's key clobbers that set's record and leaks the directory it pointed at.

#### Scenario: a submission finishes and the panel closes
- **WHEN** dispatch completes
- **THEN** the set is marked submitted and left on disk to be reclaimed on a later sweep

#### Scenario: a follow-on staged copy is registered for an existing set
- **WHEN** it is written to the manifest
- **THEN** it uses a derived key distinct from the original set's
- **AND** the original set's record and directory survive

#### Scenario: the editor is closed mid-session and the extension restarts
- **WHEN** activation runs
- **THEN** stale artifact sets past their expiry are deleted and the deletion count is logged

### The panel is a single live session, and every failure reaches it

At most one editor panel SHALL exist at a time — a second request reveals the existing one rather than starting a competing session. Every failure path — an unreadable attachment, a size limit, a missing dependency, a failed dispatch — MUST be reported back to the panel as a message the UI can render, never swallowed into a log the user will not see. The panel's markup is served under a strict content policy with a per-load nonce and an explicit allow-list of resource locations.

#### Scenario: the editor is opened while a session is already running
- **WHEN** the open action fires
- **THEN** the existing panel is revealed with its content intact
- **AND** no second session is created

#### Scenario: an attached image exceeds the per-image limit
- **WHEN** it is processed
- **THEN** the panel receives an error message describing the failure

## Uncovered

- `installBanner.test.ts` and the contents of `__tests__/` — not read; every non-test file in the area was read in full.
