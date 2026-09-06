# Speckit CLI — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

This capability is the extension's relationship with an external tool it does not own: the SpecKit CLI and its companion CLI extension. It exists so the editor can detect, install, upgrade, and stay out of the way of that CLI — and so a missing, outdated, or failing CLI degrades the experience instead of breaking the editor.

## Requirements

### A missing or broken CLI degrades the extension, never the host

Every interaction with the external CLI SHALL be treated as optional. Detection MUST resolve to a plain answer rather than an error, and a CLI that is absent, on an old build, or failing MUST leave the extension activated and usable. Nothing here may throw into activation.

#### Scenario: the CLI is not installed
- **WHEN** detection runs on a machine without it
- **THEN** the extension reports "not installed", records that in a context key, and continues activating
- **AND** the affordances that depend on the CLI surface an install route instead of failing

#### Scenario: the CLI exists but does not answer the probe
- **WHEN** the primary detection probe errors
- **THEN** a second, differently-shaped probe is attempted before concluding it is absent

### Detection distinguishes "the tool exists" from "this project uses it"

Whether the CLI is installed on the machine and whether the open workspace has been scaffolded by it SHALL be separate answers, checked separately and exposed separately. A third check — whether the project's constitution still holds placeholder text — SHALL only run once the workspace is known to be initialized.

#### Scenario: an initialized workspace on a machine without the CLI
- **WHEN** detection runs
- **THEN** the workspace reports as initialized while the CLI reports as absent
- **AND** the two drive different affordances

#### Scenario: the workspace was scaffolded for a chat-based assistant
- **WHEN** the canonical scaffolding directory is absent
- **THEN** initialization is still detected from the per-assistant command files the CLI emits

### The extension drives the CLI through a visible terminal, never silently

Install, initialize, and upgrade actions SHALL run as commands in a terminal the user can see, because they are long-running, may prompt, and may fail in ways only their own output explains. The extension MUST NOT claim these succeeded — after dispatching it tells the user what is happening and offers to reload once they judge it complete.

#### Scenario: the user triggers an upgrade
- **WHEN** the action runs
- **THEN** a named terminal opens showing the command and its output
- **AND** the extension offers a reload rather than asserting the upgrade finished

#### Scenario: a workspace path contains shell metacharacters
- **WHEN** a command must run in the workspace directory
- **THEN** the directory is supplied as structured terminal configuration rather than interpolated into the command text

### Re-scaffolding targets the assistant the user actually configured

When the extension asks the CLI to regenerate a project's scaffolding, the assistant identifier it passes SHALL be derived from the configured provider — and, for the chat-routing provider, from the detected host editor. The resolution MUST be explicit for every supported provider: each one the product ships SHALL have its own entry, so the identifier passed matches the assistant the user actually chose. The resolution MUST also be total — a value the product does not recognize at all resolves to a safe default rather than passing through an identifier the CLI would reject. The default exists only for genuinely unknown values; a supported provider that falls through to it is a defect, not a fallback, because the workspace is then scaffolded for the wrong assistant. No dispatch site may hardcode an identifier.

#### Scenario: the workspace is upgraded under a chat-routing provider
- **WHEN** the upgrade command is built
- **THEN** the identifier is chosen from the detected host editor
- **AND** an unrecognized host falls back to a known-valid identifier

#### Scenario: a supported provider has no entry of its own
- **WHEN** the identifier is resolved for it
- **THEN** reaching the default is a defect rather than acceptable behavior
- **AND** the provider must be given its own explicit entry

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

### Task progress is derived from the task document and only reported on transitions

Phase completion SHALL be computed by parsing the task document into phases and counting only genuine task checkboxes — items inside code blocks are documentation, not work. A notification MUST fire only when a phase newly becomes complete relative to the last observed state, and the cache MUST be seeded on first sight of a file so opening an already-finished project announces nothing.

#### Scenario: an already-complete task file is opened
- **WHEN** its state is first observed
- **THEN** the cache is seeded and no completion is announced

#### Scenario: the final task of a phase is checked
- **WHEN** the file changes
- **THEN** that phase alone is reported as newly complete, and re-saving the file reports nothing further

## Uncovered

_None — every file in the area was read._
