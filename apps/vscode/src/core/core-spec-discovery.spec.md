# Core Spec Discovery — Living Spec

## Purpose

Where specs live on disk and how the extension notices them change. Every feature uses this one answer to "what is a spec directory".

## Requirements

### Spec locations are configured, not assumed
<!-- touches: src/core/specDirectoryResolver.ts -->

Specs SHALL be found from the user's list of directory patterns. A plain directory name holds specs as its children, a glob ending in a wildcard matches specs directly, and a glob ending in a plain name matches folders of specs. The built-in fallback MUST list every layout the shipped default setting lists, or that layout silently disappears.

#### Scenario: a pattern ends in a wildcard
- **WHEN** a real directory matches `openspec/changes/*`
- **THEN** that directory is itself a spec

#### Scenario: a pattern is a plain directory name
- **WHEN** the pattern is `specs`
- **THEN** each immediate subdirectory is a candidate spec

#### Scenario: a wildcard pattern names each project's folder of specs
- **WHEN** the pattern is `apps/*/specs`
- **THEN** the spec folders inside each match are listed, and the matches themselves are not

### An empty folder is not a spec
<!-- touches: src/core/specDirectoryResolver.ts -->

A candidate directory SHALL count as a spec only once it holds a markdown file or a recorded spec context, so empty scaffolding never shows in the sidebar.

#### Scenario: a spec folder was created but nothing written yet
- **WHEN** discovery runs
- **THEN** the folder is not listed

### A file belongs to the spec directory that contains it
<!-- touches: src/core/specDirectoryResolver.ts -->

File-to-spec attribution SHALL use the same patterns and exclusions as discovery. A file belongs to a spec only when it sits inside a matched spec directory, not at the pattern's own depth.

#### Scenario: a document is edited inside a spec
- **WHEN** the file lies under a directory matching a configured pattern
- **THEN** that directory is returned as the file's spec

#### Scenario: a file sits at the pattern's own depth
- **WHEN** `openspec/changes/notes.md` is edited under the pattern `openspec/changes/*`
- **THEN** no spec owns it

### A spec matched by two patterns is listed once
<!-- touches: src/core/specDirectoryResolver.ts -->

Discovery SHALL de-duplicate by resolved path.

#### Scenario: two configured patterns match the same directory
- **WHEN** discovery runs
- **THEN** the spec appears once

### Reference material declared by a workflow is never mistaken for a spec
<!-- touches: src/core/specDirectoryResolver.ts -->

Folders any configured workflow declares as reference material SHALL be excluded from discovery and attribution, whichever workflow a given spec chose. Otherwise a reference folder under a spec pattern shows up as a phantom spec.

#### Scenario: a workflow's reference folder sits under a spec pattern
- **WHEN** discovery runs
- **THEN** that folder and everything beneath it is skipped, and its files belong to no spec

### The extension notices spec changes wherever specs live

File watchers SHALL follow the configured spec patterns, so every supported layout gets live updates without a reload.

#### Scenario: a spec's context file is written under any configured layout
- **WHEN** the write lands
- **THEN** an open viewer showing that spec updates without a reload

#### Scenario: a spec's context file appears for the first time
- **WHEN** the file is created
- **THEN** the sidebar lists the new spec and any empty state clears

### A bad file never stops a watcher

Every watcher handler SHALL catch and log its own failures, such as a malformed file, a partial write or a missing directory, because a handler that throws stops the watcher for the rest of the session.

#### Scenario: a context file is observed mid-write
- **WHEN** its contents do not parse
- **THEN** the event is ignored and later changes still refresh

### Checking the last task closes the implement step

When every task is checked while implement is in progress, the extension SHALL record implement as finished, however the run was driven. The close MUST be idempotent and never move a spec backward.

#### Scenario: the last task is checked off
- **WHEN** the task document changes and no unchecked tasks remain while implement is in progress
- **THEN** the implement step's completion is recorded

#### Scenario: the check runs again
- **WHEN** the task document is saved again after implement closed
- **THEN** nothing is duplicated and the recorded state does not regress

## Uncovered

_None. Every file in the area was read._
