# Speckit CLI Companion Extension — Living Spec

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

Installs and updates the companion spec-kit CLI extension from one shared definition, and asks about it only when it is absent or behind, never on opt-in and never twice.

## Requirements

### The companion CLI extension has exactly one install path and one target
<!-- touches: src/speckit/specKitExtensionInstall.ts, src/speckit/specKitExtensionInstallCommands.ts -->

The companion spec-kit extension SHALL be installed only by running the CLI's own extension-add command. Its install target MUST live in a single place, so a release changes nothing here.

A first install MUST NOT carry an overwrite flag, because an older CLI rejects it. An update over an already-present extension MUST pass one, because the add command refuses to overwrite. "Already present" SHALL be read from the extension directory or the CLI's own registry.

The flag SHALL be added only after this machine's CLI says it accepts it. A probe that never reached the CLI (not on the search path, timed out, no extension subcommand) assumes the documented current CLI for that click and is not remembered, so the next click asks again.

Dispatching the install MUST announce that an install is in flight, because overwriting removes the extension directory before writing the new one and surfaces would otherwise repaint with the install pitch.

#### Scenario: the user installs from any surface
- **WHEN** the install action runs from a banner, the sidebar, or the upgrade menu
- **THEN** the same command is built from the same shared definition

#### Scenario: the user is on a CLI build without the extension subcommand
- **WHEN** the install runs
- **THEN** the prerequisite is printed, not executed, before the install command, so the resulting failure is self-explanatory

#### Scenario: an update runs over an extension that is already installed
- **WHEN** the command is built and the CLI reports it accepts the overwrite flag
- **THEN** the flag is added so the update can replace the installed copy
- **AND** a machine whose CLI has no such option gets the plain form instead of a hard error

#### Scenario: the extension directory is emptied mid-install
- **WHEN** a detection tick lands between the removal and the copy
- **THEN** the in-flight window keeps the previously observed answer instead of reporting the extension as uninstalled

### The install nudge is gated on presence, not on opt-in
<!-- touches: src/speckit/specKitExtensionInstall.ts, src/speckit/companionVersionGap.ts -->

The companion extension prompt SHALL show only when the prompt preference is on and the extension is absent (install) or behind this build's version (update); a current install shows nothing. It MUST NOT be gated behind any workflow opt-in, since users who have not opted in are the ones who need to discover it. An explicit opt-out MUST suppress both variants entirely, with no residual warning.

The install prompt has one permanent dismissal, while the update prompt is dismissed per expected version so the next release asks again. Every dismissal SHALL go through one writer that announces itself, so ambient surfaces re-sync without waiting for a file change.

#### Scenario: the extension is already installed
- **WHEN** the gate is evaluated
- **THEN** no prompt is shown regardless of the preference, as long as the installed version is not behind

#### Scenario: the user has opted out
- **WHEN** the gate is evaluated with the extension absent
- **THEN** nothing is shown: no banner and no fallback warning

#### Scenario: the installed extension is behind the version this build ships
- **WHEN** the gate is evaluated
- **THEN** the update variant is offered, naming the installed and the expected version

#### Scenario: an update prompt is dismissed and a newer release arrives
- **WHEN** the gate is evaluated again for the new expected version
- **THEN** the prompt returns, because the dismissal only covered the version it was raised for

### Activation shows no install prompt
<!-- touches: src/speckit/companionUpdateNudge.ts -->

Activation SHALL NOT show an install prompt for the companion extension. The activity-bar badge and the pinned CTA row in the Specs tree already carry that message, and no preference or dismissal turns them off. An installed but out-of-date extension is not this case: the update nudge below announces it.

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

The workspace's spec-kit extension SHALL resolve to missing, current, or out of date with both versions named, without a network call of its own. The expected version is the newer of the manifest bundled in this build, read once per install path, and the newest published version.

The update check learns the published version, and it MUST be remembered across sessions, because the check runs at most daily and resolves after surfaces are drawn. The remembered value MUST only move forward, because a check that finds no extension release on the shared first page must not erase it. A newly learned version applies from the next session, so one session has one yardstick.

The installed version SHALL come from the workspace's installed manifest first, so a development symlink reads as current, and from the CLI's registry as a fallback. The comparison MUST be the same `major.minor.patch` comparison the editor's update check uses. A version unreadable on either side MUST resolve to current, not out of date.

The answer SHALL be resolved once per tick, remembered per workspace, and re-resolved when the workspace changes.

#### Scenario: neither version can be read
- **WHEN** the gap is computed
- **THEN** the answer is "current" and nothing asks the user to update

#### Scenario: the installed version is ahead of the bundled one
- **WHEN** the gap is computed
- **THEN** the answer is "current", because only an expected version strictly newer than the installed one counts as a gap

#### Scenario: this build's bundled copy is current but a newer one has been published
- **WHEN** the gap is computed
- **THEN** the workspace is reported out of date against the published version

#### Scenario: a later check finds no extension release at all
- **WHEN** the remembered published version is written
- **THEN** it is left as it was, and the warning it raises survives

#### Scenario: the check learns a newer version mid-session
- **WHEN** the surfaces are asked what the gap is
- **THEN** they answer with the version this session started on, and the new one applies from the next

#### Scenario: the editor moves to another workspace folder
- **WHEN** the gap is asked for again
- **THEN** it is re-resolved for that folder instead of reusing the previous folder's answer

### An out-of-date companion extension is announced once per version, and stops asking once an update has been tried
<!-- touches: src/speckit/companionUpdateNudge.ts, src/speckit/specKitExtensionInstall.ts, src/speckit/specKitExtensionInstallCommands.ts -->

When the installed extension is behind, activation SHALL show one notification per expected version offering to update or skip, and a warning status-bar item SHALL stay visible while the gap lasts. The notification MUST count as seen when it appears, not when it is answered, so a user who ignores it is not told again every activation. Skipping goes through the same dismissal writer as the banner, so every surface falls silent together.

Both surfaces MUST respect the prompt preference, and neither may throw into activation. A dispatched update that left the installed version unchanged SHALL stop every surface asking about that version pair, remembered per project. A dispatch whose files never changed records nothing, so a failed install never silences the ask.

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

_None. Every file in the area was read._
