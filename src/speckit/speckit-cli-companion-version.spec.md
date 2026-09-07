# Companion Version Nudge — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

How the installed companion extension is compared against the version this build ships, and how an out-of-date one is announced without nagging.

## Requirements

### Activation shows no install prompt
<!-- touches: src/speckit/companionUpdateNudge.ts -->

Activation SHALL NOT show an install prompt for the companion extension. The activity-bar badge and the pinned CTA row in the Specs tree already carry that message, ambiently and permanently, so a toast on top delivered the same thing a third time before the user had done anything. Discovery stays provider-agnostic through those two surfaces, which no preference or dismissal turns off — deliberately, since neither interrupts. An extension that *is* installed but out of date is not this case: it has no ambient surface saying so, and it is announced by the update nudge below.

#### Scenario: activation runs in a spec-kit project without the extension
- **WHEN** activation runs, spec-kit is detected and the extension is absent
- **THEN** no prompt, toast, or modal is shown
- **AND** the badge and the pinned CTA row are the only surfaces that mention it

#### Scenario: the preference is off, the nudge was dismissed, or the extension is present
- **WHEN** any leg of the gate fails
- **THEN** the activation prompt does not render
- **AND** the dismissal is shared with every other install-prompt surface

### The installed companion extension is compared against the version this build ships
<!-- touches: src/speckit/companionVersionGap.ts, src/speckit/updateChecker.ts -->

The workspace's spec-kit extension SHALL be resolved to one of three answers — missing, current, or out of date with both versions named — from local files only, with no network call. The expected version comes from the manifest bundled inside this build, read once per install path; the installed version comes from the workspace's own installed manifest first, so a development symlink reads as current, and from the CLI's registry as a fallback. The comparison MUST be the same `major.minor.patch` comparison the editor's own update check uses, and a version that cannot be read on either side MUST resolve to *current* rather than out of date — an unreadable file is not evidence of a gap, and treating it as one would nag every user whose layout this code does not recognize. The answer SHALL be resolved once per tick and remembered per workspace, and re-resolved when the workspace changes rather than serving another folder's answer.

#### Scenario: neither version can be read
- **WHEN** the gap is computed
- **THEN** the answer is "current" and nothing asks the user to update

#### Scenario: the installed version is ahead of the bundled one
- **WHEN** the gap is computed
- **THEN** the answer is "current" — only a bundled version strictly newer than the installed one counts as a gap

#### Scenario: the editor moves to another workspace folder
- **WHEN** the gap is asked for again
- **THEN** it is re-resolved for that folder instead of reusing the previous folder's answer

### An out-of-date companion extension is announced once per version, and stops asking once an update has been tried
<!-- touches: src/speckit/companionUpdateNudge.ts, src/speckit/specKitExtensionInstall.ts, src/speckit/specKitExtensionInstallCommands.ts -->

When the installed extension is behind this build, activation SHALL say so once for that expected version — a notification offering to update or to skip the version — and a warning status-bar item SHALL stay visible for as long as the gap does. The notification MUST count as seen the moment it appears rather than when it is answered, because a notification with buttons stays pending until the user deals with it and a user who simply keeps working would otherwise be told again every activation. Skipping goes through the same dismissal writer as the banner, so every surface falls silent together. Both surfaces MUST also respect the prompt preference, and neither may throw into activation. An update that was actually dispatched and left the installed version exactly where it was SHALL stop every surface asking about that pair, remembered per project so another repository with the same gap is still told; a dispatch whose files never moved records nothing, so a failed install never silences anything.

#### Scenario: the same gap is seen on the next activation
- **WHEN** the notification already fired for that expected version
- **THEN** nothing is shown again, whether the user answered it or ignored it

#### Scenario: the user skips the version
- **WHEN** the skip is taken
- **THEN** the notification, the status-bar item and the banner all fall silent for that expected version
- **AND** a later release asks again

#### Scenario: an update runs but the version does not move
- **WHEN** the extension directory changes and still reports the version it had
- **THEN** no surface asks about that pair again in this project

#### Scenario: the install is dispatched but never runs
- **WHEN** nothing on disk changes
- **THEN** the gap is still reported, because a failed install must not silence the ask
