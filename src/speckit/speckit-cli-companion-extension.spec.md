# Speckit CLI Companion Extension — Living Spec

## Purpose

Installs and updates the companion spec-kit extension, and asks about it only when it is absent or behind, never behind an opt-in and never twice for the same version.

## Requirements

### The companion CLI extension has exactly one install path and one target
<!-- touches: src/speckit/specKitExtensionInstall.ts, src/speckit/specKitExtensionInstallCommands.ts -->

Every install and update surface SHALL run the CLI's own extension-add command in a visible terminal, built from one shared definition of the target, so a release changes nothing here.

#### Scenario: the user installs from any surface
- **WHEN** the install runs from a banner, the sidebar, a notification or the upgrade menu
- **THEN** the same command is sent

#### Scenario: the user's CLI lacks the extension subcommand
- **WHEN** the install runs
- **THEN** the terminal first prints, without running, the command that installs a CLI that has it, so the failure explains itself

### A first install omits the overwrite flag and an update passes it
<!-- touches: src/speckit/specKitExtensionInstall.ts -->

A first install MUST NOT pass the overwrite flag, because an older CLI rejects it. An install over an extension already present, by its directory or the CLI's registry, SHALL pass it when this machine's CLI accepts it, because the add command refuses to overwrite. A probe that never reached the CLI assumes the current CLI for that click and is asked again next time.

#### Scenario: an update runs over an installed extension
- **WHEN** the CLI's help lists the overwrite flag
- **THEN** the command carries it

#### Scenario: the CLI has no overwrite option
- **WHEN** an update runs
- **THEN** the plain command is sent instead of one the CLI would reject

### An install in progress never reads as uninstalled
<!-- touches: src/speckit/specKitExtensionInstall.ts -->

Dispatching an install SHALL announce it is in flight, and while it is, detection keeps its previous answer. Overwriting removes the extension directory before copying the new one, and surfaces would otherwise flash the install pitch.

#### Scenario: the extension directory is empty mid-install
- **WHEN** a detection check lands between the removal and the copy
- **THEN** detection reports what it saw before the install began, not "uninstalled"

### The install nudge is gated on presence, not on opt-in
<!-- touches: src/speckit/specKitExtensionInstall.ts, src/speckit/companionVersionGap.ts -->

The companion prompt SHALL show only while the prompt preference is on and the extension is absent (install) or behind this build (update). It MUST NOT wait for any workflow opt-in, since people who have not opted in are the ones who need to find it. Dismissing the install prompt is permanent, while dismissing the update prompt covers only that expected version, and every surface falls silent together.

#### Scenario: the extension is installed and current
- **WHEN** the gate is evaluated
- **THEN** no prompt is shown

#### Scenario: the user has turned the preference off
- **WHEN** the extension is absent
- **THEN** no banner and no fallback warning is shown

#### Scenario: an update prompt is dismissed and a newer release arrives
- **WHEN** the gate is evaluated for the new expected version
- **THEN** the update prompt returns

### Activation shows no install prompt
<!-- touches: src/speckit/companionUpdateNudge.ts -->

Activation SHALL NOT show a prompt to install the companion extension. The activity-bar badge and the pinned row in the Specs tree already say it. An installed but outdated extension is announced by the update notification instead.

#### Scenario: activation runs in a spec-kit project without the extension
- **WHEN** spec-kit is detected and the extension is absent
- **THEN** no toast or modal appears, and the badge and pinned row are the only mentions

### The installed companion extension is compared against the version this build ships
<!-- touches: src/speckit/companionVersionGap.ts, src/speckit/updateChecker.ts -->

The workspace's extension SHALL resolve to missing, current or out of date, naming both versions, with no network call of its own. The expected version is the newer of the one bundled in this build and the newest published one the update check remembered. Only an expected version strictly newer than the installed one is a gap, and a version unreadable on either side reads as current. The remembered published version only moves forward and takes effect from the next session.

#### Scenario: this build's bundled copy is current but a newer one has been published
- **WHEN** the gap is computed
- **THEN** the workspace is out of date against the published version

#### Scenario: neither version can be read
- **WHEN** the gap is computed
- **THEN** it reads as current and nothing asks the user to update

#### Scenario: a later check finds no extension release on the page it fetched
- **WHEN** the remembered published version is written
- **THEN** it keeps its previous value, and the warning it raised survives

### An out-of-date extension is announced once per version
<!-- touches: src/speckit/companionUpdateNudge.ts, src/speckit/specKitExtensionInstall.ts, src/speckit/specKitExtensionInstallCommands.ts -->

While the extension is behind, activation SHALL show one notification per expected version offering Update or Skip, and a warning status-bar item stays while the gap lasts. The notification counts as seen when it appears, not when answered. Neither surface may throw into activation.

#### Scenario: the same gap is seen on the next activation
- **WHEN** the notification already appeared for that expected version
- **THEN** nothing is shown again, whether the user answered it or ignored it

#### Scenario: the user skips the version
- **WHEN** Skip is chosen
- **THEN** the notification, the status-bar item and the banner fall silent for that version, and a later release asks again

### An update that leaves the version unchanged stops the asking
<!-- touches: src/speckit/specKitExtensionInstall.ts -->

When a dispatched update changed the extension's files but not its version, every surface SHALL stop asking about that version pair in this project. A dispatch that changed nothing on disk records nothing, so a failed install never silences the ask.

#### Scenario: an update runs but the version does not move
- **WHEN** the extension directory changes and still reports the old version
- **THEN** no surface asks about that pair again in this project

#### Scenario: the install is dispatched but never runs
- **WHEN** nothing on disk changes
- **THEN** the gap is still reported

## Uncovered

_None. Every file in the area was read._
