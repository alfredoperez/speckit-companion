# Speckit CLI Notifications — Living Spec

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

What the extension tells the user about things it observed on its own: a newer release of the editor extension, and a task phase that just finished.

## Requirements

### Two products share one release list and must never be confused
<!-- touches: src/speckit/updateChecker.ts -->

Any release lookup SHALL filter to the tag shape of the product being asked about, and MUST reject drafts and prereleases, because two products publish into one release list. A lookup of "the latest release" across both namespaces MUST NOT be reintroduced anywhere, including links opened for the user. One fetch SHALL answer for both products.

Only the first page is fetched, so finding none of a product's tags SHALL mean the page did not reach them, never that the product has no releases.

#### Scenario: an update check runs
- **WHEN** releases are enumerated
- **THEN** only tags matching the editor extension's own shape are considered, and the highest version among them wins
- **AND** the other product's releases, drafts, and prereleases are ignored

#### Scenario: the page holds no release for one of the products
- **WHEN** that product's tag shape matches nothing
- **THEN** it is read as unknown, and nothing already known about it is discarded

#### Scenario: the user opens the changelog for an offered update
- **WHEN** the update notification's changelog action is chosen
- **THEN** the link opens the release page for that exact version by its own tag
- **AND** never a shared "latest release" URL that could land on the other product

### Update checks are throttled, skippable, and never noisy on failure
<!-- touches: src/speckit/updateChecker.ts, src/speckit/utilityCommands.ts -->

The update check SHALL run at most once per interval unless forced, SHALL respect a version the user skipped, and SHALL fail silently to the log when the network or API is unavailable.

#### Scenario: the user skips a version
- **WHEN** that version is later seen again
- **THEN** no notification is shown
- **AND** a version newer than the skipped one still notifies

#### Scenario: the releases API is unreachable
- **WHEN** the check runs
- **THEN** the failure is logged and no user-facing error appears

### Task progress is derived from the task document and only reported on transitions
<!-- touches: src/speckit/taskProgressService.ts -->

Phase completion SHALL be computed by parsing the task document into phases and counting only real task checkboxes, not items inside code blocks. A notification MUST fire only when a phase newly becomes complete since the last observed state. The cache MUST be seeded on first sight of a file, so opening an already-finished project announces nothing.

#### Scenario: an already-complete task file is opened
- **WHEN** its state is first observed
- **THEN** the cache is seeded and no completion is announced

#### Scenario: the final task of a phase is checked
- **WHEN** the file changes
- **THEN** that phase alone is reported as newly complete, and re-saving the file reports nothing further

## Uncovered

_None. Every file in the area was read._
