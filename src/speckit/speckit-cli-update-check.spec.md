# Editor Update Check — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

How the editor extension checks its own releases without confusing them with the other product published into the same list.

## Requirements

### Two products share one release list and must never be confused

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

The update check SHALL run at most once per interval unless explicitly forced, SHALL respect a version the user chose to skip, and SHALL fail silently to the log when the network or the API is unavailable.

#### Scenario: the user skips a version
- **WHEN** that version is later seen again
- **THEN** no notification is shown
- **AND** a newer version than the skipped one still notifies

#### Scenario: the releases API is unreachable
- **WHEN** the check runs
- **THEN** the failure is logged and no user-facing error appears
