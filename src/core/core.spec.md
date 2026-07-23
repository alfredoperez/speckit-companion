# Core — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Core is the shared ground every feature stands on: where a spec lives on disk, what a spec's recorded state means, how the extension notices the filesystem changing, and the small set of primitives (terminals, temp files, context keys, errors) features would otherwise each reinvent. Without it, every feature would carry its own idea of "what is a spec directory" and they would disagree.

## Requirements

### Spec locations are configured, not assumed

The extension SHALL locate specs from a user-configurable list of directory patterns rather than a fixed path, because the workflows it supports place specs in several different layouts. Both plain directory names and glob patterns MUST be supported, and their meanings differ: a plain name's *children* are specs, while each glob *match* is itself a spec. Any hardcoded fallback for these patterns MUST list every layout the shipped configuration lists, since a divergence silently makes a whole layout invisible.

#### Scenario: a workspace uses a nested change-based layout
- **WHEN** a configured pattern has wildcards and a real directory matches it
- **THEN** that directory is treated as a spec directory itself, not as a container of specs

#### Scenario: a configured directory holds spec folders
- **WHEN** a configured pattern is a plain directory name
- **THEN** each of its immediate subdirectories is a candidate spec
- **AND** a subdirectory is only accepted once it has markdown content or a recorded spec context, so empty scaffolding does not appear as a spec

### Spec discovery and file-to-spec attribution agree

Resolving the specs in a workspace and deciding which spec a given file belongs to SHALL be driven by the same configured patterns and the same exclusions. A file is attributed to a spec only when it sits *inside* a matched spec directory, never when it merely sits at the pattern's own depth.

#### Scenario: a document is edited inside a spec
- **WHEN** an edited file's path lies under a directory matching a configured pattern
- **THEN** that spec directory's path is returned as the file's owning spec

#### Scenario: the same path is queried twice through different patterns
- **WHEN** two configured patterns would both match a directory
- **THEN** it is reported exactly once — discovery de-duplicates by resolved path

### Reference material declared by a workflow is never mistaken for a spec

A workflow may declare folders it reads for background context. Those folders SHALL be excluded from spec detection across all configured workflows, regardless of which workflow a given spec chose. Without this, a reference folder that happens to sit under a spec pattern surfaces as a phantom spec with a lifecycle it does not have.

#### Scenario: a workflow's reference folder sits under a spec pattern
- **WHEN** spec discovery runs
- **THEN** that folder and everything beneath it is skipped
- **AND** files inside it are not attributed to any spec

### Recorded spec state has one on-disk shape and one append-only log

A spec's lifecycle SHALL be recorded in a single per-spec context file whose history is append-only — entries are never reordered, edited, or removed. Per-step and per-substep timing SHALL be derived in memory from that log rather than persisted alongside it, so there is exactly one source of truth and no second field to drift. Unknown and legacy fields MUST be preserved across writes, so an older or newer writer never loses another's data.

#### Scenario: a step's timing is displayed
- **WHEN** the viewer needs how long a step took
- **THEN** it derives that from the history log rather than reading a stored duration

#### Scenario: a writer that predates a field updates the file
- **WHEN** a component rewrites the context file
- **THEN** fields it does not recognize survive the write unchanged

### The recorded status and the recorded step must not disagree

Status values and step names SHALL form one lifecycle where each non-terminal status names the step that owns it and whether that step is still running or settled. A status ahead of the history log is an invalid state and MUST NOT be written: it renders as work in progress that nobody is doing.

#### Scenario: a step is advanced
- **WHEN** the current step changes
- **THEN** a matching history entry is appended in the same write

#### Scenario: a step is still running
- **WHEN** the status is one of the in-progress forms
- **THEN** the extension reports that step as active rather than settled

### A duration is only shown when the extension itself stamped both ends

A span SHALL be reported as trustworthy only when both of its boundaries were stamped by the extension's own clock. Timestamps journaled by the assistant or a CLI order events correctly but record when the write ran, not when the work happened, so a duration computed from them is fiction and MUST NOT be displayed as elapsed time.

#### Scenario: the assistant journaled a step's completion
- **WHEN** a step's start or end was written by something other than the extension
- **THEN** the span is marked untrusted and no elapsed time is rendered for it

#### Scenario: the whole run's elapsed time is requested
- **WHEN** a run-level timing summary is derived from the history log
- **THEN** a start, end, and elapsed span appear only if every expected phase has a trustworthy closed span; otherwise the summary reports how many phases were measured and stays incomplete
- **AND** the summary is derived in memory, never persisted, so the history log stays the only timing source on disk

### The extension notices spec changes wherever specs live

File watchers SHALL be registered from the configured spec patterns, not from a single hardcoded directory, so a workspace using any supported layout still gets live updates. Watching only one layout is a known regression shape: a context write goes unobserved, the open viewer never refreshes, and a newly created spec never clears the empty state.

#### Scenario: a spec's context file is written under any configured layout
- **WHEN** the write lands
- **THEN** an open viewer showing that spec re-derives its state without a reload

#### Scenario: a spec's context file appears for the first time
- **WHEN** the file is created
- **THEN** the sidebar re-scans so the new spec appears and any empty state clears

Filesystem events arrive in bursts, so refresh work driven by a watcher SHALL be debounced. Every watcher handler MUST swallow and log its own failures — a malformed file, a partial write, a missing directory — because a throwing handler silently kills the watcher for the rest of the session.

#### Scenario: a context file is observed mid-write
- **WHEN** its contents do not parse
- **THEN** the event is ignored and the watcher keeps working

#### Scenario: a file is saved repeatedly in quick succession
- **WHEN** several change events fire close together
- **THEN** the dependent refresh runs once after the burst settles

### The completion of the implement step is closed by observing the work, not by trusting a report

Because the extension is blind to what the assistant does, the implement step SHALL be closed by watching the task list itself: when every task is checked and implement is underway, the extension writes the terminal close. This path MUST work regardless of how the run was driven, and MUST be idempotent and forward-only so it can never move a spec backward.

#### Scenario: the last task is checked off
- **WHEN** the task document changes and no unchecked tasks remain while implement is in progress
- **THEN** the extension records the implement step's completion
- **AND** re-running the same check does not duplicate or regress the recorded state

### Settings survive being renamed, retyped, and retired

Configuration keys change shape across releases, so a reader SHALL be correct for a persisted value from any generation without waiting for a migration to run. Migrations MUST preserve the scope a value was set at, MUST be idempotent, and MUST NOT fail activation. A retired key's persisted value SHOULD be cleaned up rather than left to confuse the user.

#### Scenario: a setting was persisted in its old form
- **WHEN** a reader asks for it before any migration has run
- **THEN** the legacy form is coerced to the current type and the user's effective choice is preserved, never flipped

#### Scenario: a renamed key is migrated
- **WHEN** the old key was set at the workspace level
- **THEN** the new key is written at the workspace level and the old one is removed there
- **AND** re-running the migration changes nothing

### Telemetry carries shapes, never content

Every telemetry payload SHALL contain only enum-like values, booleans, versions, counts, and a random per-spec identifier. User-authored text — prompt content, file paths, spec names, custom workflow and step names — MUST never be sent. Any value read from disk or settings that could be free text MUST be coerced to a known allow-list before reporting, with anything unrecognized reduced to a neutral placeholder.

#### Scenario: a user-defined workflow step runs
- **WHEN** an event reports which phase it belongs to
- **THEN** built-in phase names are sent verbatim and any other step name is reported as a generic marker

#### Scenario: a spec has no correlation identifier yet
- **WHEN** an event fires for it
- **THEN** a random identifier is minted and persisted so later events for the same spec correlate
- **AND** a failure to persist it does not block the event

#### Scenario: the extension activates
- **WHEN** the activation event fires
- **THEN** it carries only versions, a spec count, a companion-installed boolean, and enum-like feature-flag states — never a spec name, path, or user-authored workflow name

### Engagement is counted without naming what was engaged

The extension SHALL emit a bare event when a spec, a living spec, or a steering document is opened, and when a living-spec drift or sync runs — carrying no property at all, so a count can never be tied to a name or path. The install-banner funnel is likewise reported as fixed `shown`/`clicked` × surface literals produced only by our own call sites. Opened-in-viewer events MUST be de-duplicated per session so a re-rendering panel cannot inflate the count, and the de-dupe key used for that MUST be an internal identity that is never sent. A de-dupe slot MUST be claimed only after an event actually emits, so an open that happened while telemetry was off or uninitialized still fires once telemetry becomes available.

#### Scenario: the same spec is re-revealed in the viewer
- **WHEN** the panel re-renders and would re-emit the open event
- **THEN** only the first open of that spec this session is sent, keyed by an identity that never leaves the process

#### Scenario: a spec is opened while telemetry is disabled
- **WHEN** the event cannot be sent yet
- **THEN** no de-dupe slot is consumed, so the first successful send still happens once telemetry turns on

### Context keys have one writer and one catalogue

VS Code context keys SHALL be written through a single wrapper that accepts only catalogued key names and logs failures. Activation MUST reset every catalogued key, so a value from a previous session cannot leak into the new one and leave a menu affordance stuck.

#### Scenario: a key is set from a feature
- **WHEN** the write fails
- **THEN** the failure is logged rather than silently swallowed

#### Scenario: the extension activates
- **WHEN** startup runs
- **THEN** every catalogued key is reset to its default

### A spec's display name resolves by preference without changing its identity

A readable display name SHALL be resolved by preference — a recorded name first, then a document heading, then a humanized form of the directory slug — while the directory slug remains the stable identifier. A blank or whitespace-only candidate MUST be treated as absent so it can never win over the humanized-slug fallback.

#### Scenario: a spec has no recorded name
- **WHEN** a display name is needed and the recorded name is empty or whitespace
- **THEN** a document heading is used when present, otherwise the humanized slug — and the slug still identifies the spec

### Shared primitives absorb host and shell differences

Terminal readiness, temp-file staging, path translation for cross-environment shells, shell-family detection, and task-checkbox parsing SHALL live in core and be the only implementations. Callers MUST NOT re-derive them. Waiting for a shell MUST have a timeout fallback so a host that never reports readiness still dispatches.

#### Scenario: a checkbox appears inside a code block
- **WHEN** task counts are computed for a document
- **THEN** checkboxes inside fenced blocks or inline code are not counted as work

#### Scenario: shell integration never signals ready
- **WHEN** the readiness wait exceeds its timeout
- **THEN** dispatch proceeds anyway rather than hanging

## Uncovered

_None — every file in the area was read._
