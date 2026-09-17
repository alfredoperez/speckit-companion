# Core Spec Discovery — Living Spec

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Core owns where specs live on disk and how the extension notices them change: the configured directory patterns, file-to-spec attribution, and the watchers that keep the sidebar and viewer current. Every feature uses this one answer to "what is a spec directory".

## Requirements

### Spec locations are configured, not assumed
<!-- touches: src/core/specDirectoryResolver.ts -->

The extension SHALL locate specs from a user-configurable list of directory patterns, not a fixed path. Plain directory names and glob patterns MUST both be supported: a plain name's children are specs, while each glob match is itself a spec. Any hardcoded fallback MUST list every layout the shipped configuration lists, or a whole layout silently disappears.

#### Scenario: a workspace uses a nested change-based layout
- **WHEN** a configured pattern has wildcards and a real directory matches it
- **THEN** that directory is itself a spec directory, not a container of specs

#### Scenario: a configured directory holds spec folders
- **WHEN** a configured pattern is a plain directory name
- **THEN** each immediate subdirectory is a candidate spec
- **AND** a subdirectory is only accepted once it has markdown content or a recorded spec context, so empty scaffolding does not appear as a spec

### Spec discovery and file-to-spec attribution agree
<!-- touches: src/core/specDirectoryResolver.ts -->

Spec discovery and file-to-spec attribution SHALL use the same configured patterns and exclusions. A file belongs to a spec only when it sits inside a matched spec directory, not when it sits at the pattern's own depth.

#### Scenario: a document is edited inside a spec
- **WHEN** an edited file's path lies under a directory matching a configured pattern
- **THEN** that spec directory's path is returned as the file's owning spec

#### Scenario: the same path is queried twice through different patterns
- **WHEN** two configured patterns both match a directory
- **THEN** it is reported once, because discovery de-duplicates by resolved path

### Reference material declared by a workflow is never mistaken for a spec
<!-- touches: src/core/specDirectoryResolver.ts -->

Folders any configured workflow declares as background reference SHALL be excluded from spec detection, whichever workflow a given spec chose. Otherwise a reference folder under a spec pattern shows up as a phantom spec.

#### Scenario: a workflow's reference folder sits under a spec pattern
- **WHEN** spec discovery runs
- **THEN** that folder and everything beneath it is skipped
- **AND** files inside it are not attributed to any spec

### The extension notices spec changes wherever specs live

File watchers SHALL be registered from the configured spec patterns, not a single hardcoded directory, so every supported layout gets live updates. A watcher on one layout misses context writes, so the viewer never refreshes and new specs never clear the empty state.

#### Scenario: a spec's context file is written under any configured layout
- **WHEN** the write lands
- **THEN** an open viewer showing that spec re-derives its state without a reload

#### Scenario: a spec's context file appears for the first time
- **WHEN** the file is created
- **THEN** the sidebar re-scans so the new spec appears and any empty state clears

Watcher-driven refresh work SHALL be debounced. Every watcher handler MUST catch and log its own failures, such as a malformed file, a partial write, or a missing directory, because a throwing handler kills the watcher for the rest of the session.

#### Scenario: a context file is observed mid-write
- **WHEN** its contents do not parse
- **THEN** the event is ignored and the watcher keeps working

#### Scenario: a file is saved repeatedly in quick succession
- **WHEN** several change events fire close together
- **THEN** the dependent refresh runs once after the burst settles

### The completion of the implement step is closed by observing the work, not by trusting a report

The extension SHALL close the implement step by watching the task list: when every task is checked and implement is underway, it writes the terminal close. This MUST work however the run was driven, and MUST be idempotent and forward-only so it never moves a spec backward.

#### Scenario: the last task is checked off
- **WHEN** the task document changes and no unchecked tasks remain while implement is in progress
- **THEN** the extension records the implement step's completion
- **AND** re-running the check does not duplicate or regress the recorded state

## Uncovered

_None. Every file in the area was read._
