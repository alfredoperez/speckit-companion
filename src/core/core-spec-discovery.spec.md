# Core Spec Discovery — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Core owns where a spec lives on disk and how the extension notices it changing: the configured directory patterns, the file-to-spec attribution built on them, and the watchers that keep the sidebar and viewer honest. Without one shared answer, every feature would carry its own idea of "what is a spec directory" and they would disagree.

## Requirements

### Spec locations are configured, not assumed
<!-- touches: src/core/specDirectoryResolver.ts -->

The extension SHALL locate specs from a user-configurable list of directory patterns rather than a fixed path, because the workflows it supports place specs in several different layouts. Both plain directory names and glob patterns MUST be supported, and their meanings differ: a plain name's *children* are specs, while each glob *match* is itself a spec. Any hardcoded fallback for these patterns MUST list every layout the shipped configuration lists, since a divergence silently makes a whole layout invisible.

#### Scenario: a workspace uses a nested change-based layout
- **WHEN** a configured pattern has wildcards and a real directory matches it
- **THEN** that directory is treated as a spec directory itself, not as a container of specs

#### Scenario: a configured directory holds spec folders
- **WHEN** a configured pattern is a plain directory name
- **THEN** each of its immediate subdirectories is a candidate spec
- **AND** a subdirectory is only accepted once it has markdown content or a recorded spec context, so empty scaffolding does not appear as a spec

### Spec discovery and file-to-spec attribution agree
<!-- touches: src/core/specDirectoryResolver.ts -->

Resolving the specs in a workspace and deciding which spec a given file belongs to SHALL be driven by the same configured patterns and the same exclusions. A file is attributed to a spec only when it sits *inside* a matched spec directory, never when it merely sits at the pattern's own depth.

#### Scenario: a document is edited inside a spec
- **WHEN** an edited file's path lies under a directory matching a configured pattern
- **THEN** that spec directory's path is returned as the file's owning spec

#### Scenario: the same path is queried twice through different patterns
- **WHEN** two configured patterns would both match a directory
- **THEN** it is reported exactly once — discovery de-duplicates by resolved path

### Reference material declared by a workflow is never mistaken for a spec
<!-- touches: src/core/specDirectoryResolver.ts -->

A workflow may declare folders it reads for background context. Those folders SHALL be excluded from spec detection across all configured workflows, regardless of which workflow a given spec chose. Without this, a reference folder that happens to sit under a spec pattern surfaces as a phantom spec with a lifecycle it does not have.

#### Scenario: a workflow's reference folder sits under a spec pattern
- **WHEN** spec discovery runs
- **THEN** that folder and everything beneath it is skipped
- **AND** files inside it are not attributed to any spec

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

## Uncovered

_None — every file in the area was read._
