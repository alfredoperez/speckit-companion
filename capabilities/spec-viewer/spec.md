# Spec Viewer — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The extension-side spec viewer is the editor's window onto a spec: it owns the webview panel per spec directory, decides which documents exist and which one to render, derives the workflow state the panel displays from the spec's recorded context, and turns the user's clicks into workflow commands and file edits. Without it the spec's lifecycle is invisible in the editor and the only way to advance a spec is to type slash commands by hand.

## Requirements

### Each spec directory owns exactly one viewer panel

The provider MUST key open panels by spec directory and reuse an existing panel rather than opening a second one for the same spec. Opening a document that belongs to an already-open spec MUST reveal that panel retargeted at the requested document, and disposing a panel MUST release everything scoped to it (pending refresh timers, per-spec notification bookkeeping).

#### Scenario: Opening a sub-document of an open spec
- **WHEN** the user opens a file that lives beneath the directory of an already-open panel and that panel already knows the file as one of its documents
- **THEN** the existing panel is retargeted to that document and revealed
- **AND** no second panel is created for the nested path

#### Scenario: Resolving the spec root from an arbitrary file
- **WHEN** a document is opened from a step sub-folder or a related-docs folder
- **THEN** the provider walks upward to the nearest ancestor that actually holds the spec before choosing the panel key
- **AND** the panel is keyed to that spec root, not to the file's immediate parent

### Documents come from the spec's own workflow pipeline

Document discovery MUST be driven by the workflow resolved for that spec, falling back to the default pipeline when none resolves. The scan MUST distinguish pipeline entries (the workflow's ordered steps, including steps that produce no file) from related documents discovered by scanning, and MUST look for a step's file in both the spec directory and the change root of a two-level layout.

#### Scenario: A workflow step that produces no document
- **WHEN** a workflow declares a step with no output file
- **THEN** that step still occupies its position in the pipeline
- **AND** it is never selected as the document to render

#### Scenario: Resolving which document to show
- **WHEN** the caller requests a document type that has no file on disk but a sub-document beneath that step does exist
- **THEN** the viewer renders the existing sub-document instead of an empty tab
- **AND** an explicit tab click resolves only within that step rather than silently falling back to an unrelated sibling

### Viewer state derives from the recorded spec context, not from files on disk

Step completion, the in-flight step, the status badge, and the footer MUST be derived from the spec's recorded context. File existence MUST NOT be used to infer that a step completed. A step that precedes the recorded current step MUST be treated as completed even when it has no recorded history of its own, and no step MUST be shown as in flight once the spec reaches a terminal status.

#### Scenario: External tool advanced the spec without per-step history
- **WHEN** the recorded context names a current step but carries no entries for the steps before it
- **THEN** those earlier steps are shown as completed
- **AND** the current step's own recorded start decides whether it reads as in flight

#### Scenario: Derivation from a tolerant context file
- **WHEN** the context file carries optional capture fields in a legacy or malformed shape
- **THEN** each field is either normalized into the shape the panel renders or omitted entirely
- **AND** a malformed field never reaches the webview as-is

### Footer actions are gated by the spec's recorded position, not the viewed tab

The forward action MUST dispatch the step that follows the spec's recorded current step, so navigating backward through the stepper cannot re-run a finished phase. Closure actions (archiving, marking completed) MUST surface only once the spec has reached a closure-eligible stage, and no step-scoped action MUST surface on a terminal spec. The forward action's visible label MUST be derived from the active workflow's next step.

#### Scenario: User navigates back to an earlier tab
- **WHEN** the viewed document is behind the spec's recorded current step
- **THEN** the forward action is hidden for that tab
- **AND** clicking a forward action elsewhere still dispatches from the recorded current step

#### Scenario: Mid-generation spec
- **WHEN** a step is still running
- **THEN** the closure actions are absent
- **AND** re-running the current step remains available

Recorded history is the sole rule. Deriving footer actions from which files happen to exist on disk MUST NOT be reintroduced as a parallel path — the two answers diverge whenever a document is written outside the pipeline, and only the recorded position reflects what the spec actually did.

### The panel creates a spec context only on first open and never overwrites one it cannot read

The viewer MAY write a minimal context recording only what it can verify when a spec has none, and only on the panel's first render. Every later render MUST be read-only. When an existing context file cannot be parsed, the viewer MUST render from an in-memory fallback without touching disk, and MUST offer the user an explicit, backed-up reset instead of silently repairing the file.

#### Scenario: Corrupt context file
- **WHEN** the context file exists but cannot be parsed
- **THEN** the panel renders from a fallback context and the file on disk is left untouched
- **AND** the user is offered a reset that backs up the original before replacing it

#### Scenario: Tab navigation after first open
- **WHEN** the user switches documents in an already-open panel
- **THEN** no context file is created or rewritten as a side effect

### Every state message to the webview carries the complete state

Both refresh paths — a content refresh and a context-only refresh — MUST build their payload through one builder so the webview never merges a fresh workflow state onto a stale navigation state. A partial state message MUST NOT be sent for anything the footer or header reads. Incoming webview messages MUST be routed exhaustively, and an unrecognized message MUST be logged and dropped rather than crashing the panel.

#### Scenario: Context file changed while the panel is open
- **WHEN** the spec's context file changes on disk
- **THEN** the panel re-posts a complete workflow state and navigation state without re-reading the document body
- **AND** values that were not re-read are carried forward from the panel's own cache so the payload stays internally consistent

#### Scenario: Version-skewed webview
- **WHEN** the webview posts a message type this build does not know
- **THEN** it is logged and dropped, and the panel keeps working

### A downstream document is flagged stale only while the spec is still moving

A workflow document MUST be reported stale when an upstream document in the same pipeline is strictly newer. Staleness MUST be suppressed entirely once the spec is settled, since regeneration advice is meaningless for work that is finished.

#### Scenario: Plan older than the spec
- **WHEN** the spec document is newer than the plan and the spec is still in progress
- **THEN** the plan is reported stale, naming the upstream document that caused it

#### Scenario: Completed spec
- **WHEN** the spec has reached a settled status
- **THEN** no document is reported stale regardless of timestamps

### A quiet in-flight run asks rather than changes status

When a step is recorded as in flight but nothing in the spec directory has changed for longer than that step's quiet threshold, the viewer SHOULD surface a hedged recovery prompt. It MUST NOT alter the spec's status on its own; the offered actions MUST be a user-initiated resume or an explicit status change. Past a much longer horizon — or when all tasks are already checked off — the prompt MUST reframe from "is this still running" to "this is finished or abandoned".

#### Scenario: Long-abandoned run
- **WHEN** an in-flight spec has had no file activity for far longer than the recovery threshold
- **THEN** the prompt states the run looks abandoned and leads with closing the spec rather than resuming it

#### Scenario: All tasks checked but spec still in flight
- **WHEN** the task document is fully checked off while the status is still in flight
- **THEN** the prompt leads with marking the spec complete, regardless of how long it has been quiet

### Living-spec documents render without workflow machinery

A capability's living spec MUST render in a stepper-less mode: its tier siblings become the tab strip, and no context file is read, written, or backfilled. The panel MUST badge such a document as a draft when its body carries a draft banner near the top, and MUST NOT offer workflow actions, phases, or activity narration for it.

#### Scenario: Two colocated capabilities in one directory
- **WHEN** the user opens a second living spec whose tier files sit in the same directory as an already-open one
- **THEN** the panel re-anchors to the clicked file's tier family rather than showing the previous capability's tiers

#### Scenario: Draft banner deeper in the document
- **WHEN** the word "draft" appears well below the document's opening lines
- **THEN** the spec is not badged as a draft

### Review comments persist in the spec context through a per-spec write queue

Inline review comments MUST be stored on the spec's context rather than in side files, anchored to the nearest heading and surrounding block so they survive line-number drift. Mutations MUST be serialized per spec directory so concurrent posts from the webview cannot clobber each other, and a mutation MUST be skipped rather than written when the existing context is missing or unreadable. Dispatching a document's pending comments MUST send a targeted in-place edit instruction — never a step command that would regenerate the document from a template — and then mark those comments applied while keeping them as history.

#### Scenario: Two comment mutations posted back to back
- **WHEN** the webview posts an add and a remove in quick succession
- **THEN** they are applied in sequence against successive reads
- **AND** a failure in the first does not deadlock later mutations for that spec

#### Scenario: Refining a document whose step name differs from its filename
- **WHEN** pending comments are dispatched for a document produced by a step whose name does not match its file
- **THEN** the prompt targets the document's actual filename

## Uncovered

_Every non-test source file in `src/features/spec-viewer/` was read. The sibling `__tests__/` directory was not read — this draft describes the implementation surface, not its test coverage._
