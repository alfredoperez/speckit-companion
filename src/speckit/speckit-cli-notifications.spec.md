# Speckit CLI Notifications — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

This capability covers what the extension tells the user about things it observed on its own: a newer release of the editor extension, and a task phase that just finished. Without it a release lookup could land on the wrong product, and every activation would repeat news the user already had.

## Requirements

### Two products share one release list and must never be confused
<!-- touches: src/speckit/updateChecker.ts -->

This repository publishes two independently-versioned products into a single releases list. Any release lookup SHALL filter to the tag shape belonging to the product being asked about, and MUST reject drafts and prereleases. A lookup that resolves "the latest release" across both namespaces is a defect shape that has shipped before and MUST NOT be reintroduced anywhere — including links opened for the user.

#### Scenario: an update check runs
- **WHEN** releases are enumerated
- **THEN** only tags matching the editor extension's own shape are considered, and the highest version among them wins
- **AND** the other product's releases, drafts, and prereleases are ignored

#### Scenario: the user opens the changelog for an offered update
- **WHEN** the update notification's changelog action is chosen
- **THEN** the link opens the release page for that exact version by its own tag
- **AND** never a shared "latest release" URL that could land on the other product

### Update checks are throttled, skippable, and never noisy on failure
<!-- touches: src/speckit/updateChecker.ts, src/speckit/utilityCommands.ts -->

The update check SHALL run at most once per interval unless explicitly forced, SHALL respect a version the user chose to skip, and SHALL fail silently to the log when the network or the API is unavailable.

#### Scenario: the user skips a version
- **WHEN** that version is later seen again
- **THEN** no notification is shown
- **AND** a newer version than the skipped one still notifies

#### Scenario: the releases API is unreachable
- **WHEN** the check runs
- **THEN** the failure is logged and no user-facing error appears

### Task progress is derived from the task document and only reported on transitions
<!-- touches: src/speckit/taskProgressService.ts -->

Phase completion SHALL be computed by parsing the task document into phases and counting only genuine task checkboxes — items inside code blocks are documentation, not work. A notification MUST fire only when a phase newly becomes complete relative to the last observed state, and the cache MUST be seeded on first sight of a file so opening an already-finished project announces nothing.

#### Scenario: an already-complete task file is opened
- **WHEN** its state is first observed
- **THEN** the cache is seeded and no completion is announced

#### Scenario: the final task of a phase is checked
- **WHEN** the file changes
- **THEN** that phase alone is reported as newly complete, and re-saving the file reports nothing further

## Uncovered

_None — every file in the area was read._
