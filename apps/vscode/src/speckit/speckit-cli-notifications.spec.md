# Speckit CLI Notifications — Living Spec

## Purpose

What the extension tells the user about things it noticed on its own: a newer release of the editor extension, and a task phase that just finished.

## Requirements

### Two products share one release list and must never be confused
<!-- touches: apps/vscode/src/speckit/updateChecker.ts -->

Every release lookup SHALL keep only the tag shape of the product it asks about and skip drafts and prereleases, because both products publish into one release list. A bare "latest release" lookup MUST NOT be reintroduced, including in links opened for the user.

#### Scenario: an update check runs
- **WHEN** releases are listed
- **THEN** only `v1.2.3`-shaped tags count, the highest wins, and `speckit-ext-v*` tags, drafts and prereleases are ignored

#### Scenario: the user opens the changelog for an offered update
- **WHEN** View Changelog is chosen
- **THEN** the release page for that exact version's tag opens, never a shared "latest release" URL

### A product missing from the fetched page reads as unknown
<!-- touches: apps/vscode/src/speckit/updateChecker.ts -->

Only the first page of releases is fetched, so finding no tag for a product SHALL mean "unknown", never "no releases", and nothing already known about it is discarded.

#### Scenario: the page holds no release for one of the products
- **WHEN** that product's tag shape matches nothing
- **THEN** its previously known version is kept

### Update checks are throttled, skippable, and never noisy on failure
<!-- touches: apps/vscode/src/speckit/updateChecker.ts, apps/vscode/src/speckit/utilityCommands.ts -->

The update check SHALL run at most once a day unless forced, SHALL NOT notify about a version the user skipped, and SHALL log a network or API failure without showing it to the user.

#### Scenario: the user skips a version
- **WHEN** that version is seen again
- **THEN** no notification is shown, while a newer version still notifies

#### Scenario: the releases API is unreachable
- **WHEN** the check runs
- **THEN** the failure is logged and no error appears

### The new-version notification can install the version it offers
<!-- touches: apps/vscode/src/speckit/updateChecker.ts -->

The notification SHALL offer Update first, then View Changelog and Skip. Update installs the newest version the editor's gallery serves without pinning it, so automatic updates stay on, then offers a reload. A failed install opens the extension's page instead.

#### Scenario: the install succeeds
- **WHEN** the user presses Update
- **THEN** the newest version is installed and a reload is offered

#### Scenario: the install fails
- **WHEN** the user presses Update and the install fails
- **THEN** the extension's page opens

### A phase is announced only when it newly completes
<!-- touches: apps/vscode/src/speckit/taskProgressService.ts -->

A task phase SHALL be announced once, when its last task is checked. The first sight of a task file records its state without announcing, so opening a finished project announces nothing.

#### Scenario: an already-complete task file is opened
- **WHEN** its state is first observed
- **THEN** no completion is announced

#### Scenario: the final task of a phase is checked
- **WHEN** the file changes
- **THEN** that phase alone is announced, and saving again announces nothing

## Uncovered

_None. Every file in the area was read._
