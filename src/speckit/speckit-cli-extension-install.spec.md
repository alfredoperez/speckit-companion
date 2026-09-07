# Companion Extension Install — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

How the companion spec-kit CLI extension gets installed or updated, and when the install prompt is shown.

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
