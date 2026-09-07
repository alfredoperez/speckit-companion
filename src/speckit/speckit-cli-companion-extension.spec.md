# Speckit CLI Companion Extension — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The companion spec-kit extension is installed through the CLI, not the editor, so this capability exists to install and update it from one shared definition and to ask about it only when it is absent or behind, never on opt-in and never twice. Without it users would be nagged or left on a stale extension without knowing.

## Requirements

### The companion CLI extension has exactly one install path and one target
<!-- touches: src/speckit/specKitExtensionInstall.ts, src/speckit/specKitExtensionInstallCommands.ts -->

The companion spec-kit extension is a CLI extension, not an editor extension, so it SHALL be installed only by running the CLI's own extension-add command. Its install target MUST live in a single place so a release changes nothing here. A first install MUST NOT carry an overwrite flag — an older CLI rejects it outright and there is nothing to overwrite — while an update over an extension that is already present MUST pass one, because the add command refuses to write over what is installed. The flag SHALL be added only after asking this machine's own CLI whether it accepts it, and only an answer from the CLI counts: a probe that never reached it (no CLI on the extension host's search path, a hang cut short, no extension subcommand at all) assumes the documented current CLI for that click and is not remembered, so the next click asks again rather than carrying a guess. "Already present" SHALL be read from the extension directory *or* the CLI's own registry, since either one is what the add command refuses on. Dispatching the install MUST also announce that an install is in flight, because overwriting removes the extension directory before writing the new one and a reader that believes that gap would repaint every surface with the install pitch.

#### Scenario: the user installs from any surface
- **WHEN** the install action runs from a banner, the sidebar, or the upgrade menu
- **THEN** the same command is built from the same shared definition

#### Scenario: the user is on a CLI build without the extension subcommand
- **WHEN** the install runs
- **THEN** the prerequisite is printed — not executed — before the install command, so the resulting failure is self-explanatory

#### Scenario: an update runs over an extension that is already installed
- **WHEN** the command is built and the CLI reports it accepts the overwrite flag
- **THEN** the flag is added so the update can replace the installed copy
- **AND** a machine whose CLI has no such option gets the plain form instead of a hard error

#### Scenario: the extension directory is emptied mid-install
- **WHEN** a detection tick lands between the removal and the copy
- **THEN** the in-flight window keeps the previously observed answer instead of reporting the extension as uninstalled

### The install nudge is gated on presence, not on opt-in
<!-- touches: src/speckit/specKitExtensionInstall.ts, src/speckit/companionVersionGap.ts -->

The prompt about the companion CLI extension SHALL be shown when the prompt preference is on **and** the extension is either absent or behind the version this build ships — an absent one asks to install, an out-of-date one asks to update, and a current one asks nothing. It MUST NOT be gated behind any workflow opt-in, since the audience that has not opted in is exactly the one that needs the discovery. An explicit opt-out MUST suppress both variants entirely, with no residual warning. The two variants are silenced differently: the install prompt carries one permanent dismissal, while the update prompt is dismissed per expected version so the next release asks again. Every dismissal SHALL go through one writer, which announces itself so the ambient surfaces re-sync without waiting for a file to change.

#### Scenario: the extension is already installed
- **WHEN** the gate is evaluated
- **THEN** no prompt is shown regardless of the preference, as long as the installed version is not behind

#### Scenario: the user has opted out
- **WHEN** the gate is evaluated with the extension absent
- **THEN** nothing is shown — no banner and no fallback warning

#### Scenario: the installed extension is behind the version this build ships
- **WHEN** the gate is evaluated
- **THEN** the update variant is offered, naming the installed and the expected version

#### Scenario: an update prompt is dismissed and a newer release arrives
- **WHEN** the gate is evaluated again for the new expected version
- **THEN** the prompt returns, because the dismissal only covered the version it was raised for

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

## Uncovered

_None — every file in the area was read._
