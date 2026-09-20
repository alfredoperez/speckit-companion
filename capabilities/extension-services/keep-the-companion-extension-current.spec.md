# Keep the Companion Extension Current — Living Spec

## Purpose

The Companion workflow, the Activity panel and living specs only work when the Companion spec-kit extension is installed in the open project, at a version that matches the VS Code extension. This capability notices when it is missing or behind, says so in the right places, and installs or updates it in one click. Without it users meet features that silently do nothing.

## Requirements

### The install state is read from the open project
<!-- touches: apps/vscode/src/speckit/companionVersionGap.ts, apps/vscode/src/features/settings/companionPresetReconciler.ts, apps/vscode/src/speckit/updateChecker.ts -->

The extension SHALL treat the Companion extension as missing, current or out of date. Missing means `.specify/extensions/companion/` does not exist in the first workspace folder. Out of date means the installed version is lower than the newest version the extension knows of: the one bundled in this build, or a newer published one learned by an earlier update check. A version that cannot be read on either side SHALL count as current, never as out of date, and working out the state SHALL need no network.

#### Scenario: an unreadable installed version
- **WHEN** the installed manifest and the spec-kit registry both lack a readable `major.minor.patch` version
- **THEN** the extension counts as current and no update is offered

#### Scenario: a newer release was published after this build
- **WHEN** yesterday's update check saw a published spec-kit extension newer than the bundled one
- **THEN** today's session measures the project against the published version

### A missing extension is pointed out wherever the user would need it
<!-- touches: apps/vscode/src/extension.ts, apps/vscode/src/features/specs/specExplorerProvider.ts, apps/vscode/src/features/spec-editor/installBanner.ts, apps/vscode/src/features/spec-viewer/**, apps/vscode/webview/styles/spec-viewer/_install-banner.css, package.json -->

While the extension is missing, the SpecKit activity-bar icon SHALL carry a badge, the Specs tree SHALL start with a pinned install row, the Living Specs view SHALL show an install action instead of content, and Create New Spec and the viewer's Activity panel SHALL show an install banner with Install and Learn more. There is no start-up notification for a missing extension.

#### Scenario: opening a project without the extension
- **WHEN** a project with specs but no Companion extension opens
- **THEN** the badge and the pinned row are visible at once, and no toast appears

### An out-of-date extension is offered once per version
<!-- touches: apps/vscode/src/speckit/companionUpdateNudge.ts, apps/vscode/src/speckit/specKitExtensionInstall.ts, apps/vscode/src/protocol/installBannerBody.ts -->

While the installed extension is behind, a warning item SHALL sit in the status bar, the banner slot in Create New Spec and the Activity panel SHALL show the update prompt with both versions instead of the install pitch, and start-up SHALL raise one notification per expected version with Update and Skip this version. The notification counts as seen once it is on screen, whether or not the user answers it.

#### Scenario: the toast was ignored
- **WHEN** the update notification for 0.9.0 showed and the user kept working
- **THEN** the next start-up raises no notification for 0.9.0, and the status bar item is still there

### The prompt setting and dismissals silence the prompts, not the ambient markers
<!-- touches: apps/vscode/src/speckit/specKitExtensionInstall.ts, apps/vscode/src/speckit/companionUpdateNudge.ts, apps/vscode/src/extension.ts -->

Turning `speckit.companion.installPrompt` off SHALL remove the banners, the status bar item and the update notification at once, without a reload. Closing the install banner SHALL hide it for good, everywhere. Closing the update banner or choosing Skip this version SHALL silence only that expected version, on every update surface at once. The badge and the pinned row SHALL stay until the extension is installed, whatever the setting or dismissals say.

#### Scenario: skipping a version
- **WHEN** the user skips the update to 0.9.0 and 0.10.0 is published later
- **THEN** the status bar item and banner for 0.9.0 disappear immediately, and 0.10.0 is offered when it becomes the expected version

### One click installs or updates from a terminal
<!-- touches: apps/vscode/src/speckit/specKitExtensionInstall.ts, apps/vscode/src/speckit/specKitExtensionInstallCommands.ts -->

Every install and update surface SHALL run the same action: a visible terminal at the project root prints the CLI prerequisite, then runs `specify extension add companion` against the rolling release download. It SHALL pass `--force` only when the extension is already installed or registered and the local CLI accepts the flag, since a fresh install must work on CLIs that reject it. The project path SHALL never become part of the command text.

#### Scenario: updating with an older CLI
- **WHEN** the extension is installed and the local `specify extension add` does not list `--force`
- **THEN** the command runs without the flag rather than failing on an unknown option

#### Scenario: the CLI could not be asked
- **WHEN** the check for `--force` support times out or `specify` is not reachable from the editor
- **THEN** the install still goes out, assuming a current CLI, and the next click asks again

### Every surface follows the disk without a reload
<!-- touches: apps/vscode/src/extension.ts, apps/vscode/src/speckit/companionVersionGap.ts -->

When the extension appears, disappears or changes version on disk, the badge, the pinned row, the gated views, the status bar item and any open viewer SHALL update within moments. For about a minute after an install is started, a briefly absent extension folder SHALL be read as a reinstall in progress and nothing SHALL flip to missing. Adding or removing a workspace folder SHALL re-evaluate everything, and a window with no folder shows no badge and no status bar item.

#### Scenario: a forced reinstall deletes the folder first
- **WHEN** an update is running and the extension folder vanishes for a second before the new files land
- **THEN** the badge does not appear and the banners do not switch to the install pitch

### An update that changed nothing stops asking
<!-- touches: apps/vscode/src/speckit/specKitExtensionInstall.ts, apps/vscode/src/extension.ts -->

When an update the user started has run and the installed version is exactly where it was, no surface SHALL offer that same installed-to-expected pair again in that project. An install that never touched the disk silences nothing, and other projects still ask.

#### Scenario: the published download is not newer
- **WHEN** the user clicks Update from 0.8.0 to 0.9.0, the files are rewritten, and the installed version is still 0.8.0
- **THEN** the status bar item, banner and notification for 0.8.0 to 0.9.0 stop in this project

### The standard SpecKit commands stay present once the extension is installed
<!-- touches: apps/vscode/src/features/settings/companionPresetReconciler.ts, apps/vscode/src/extension.ts -->

At start-up and whenever the extension lands on disk, the stock `/speckit.*` command family SHALL be restored from the presets bundled with the installed extension if it is absent, and presets left by old versions SHALL be removed. This only ever adds the standard family, never removes it, and a missing or failing CLI SHALL be logged without affecting start-up.

#### Scenario: a fresh checkout
- **WHEN** a project has the extension folder but the standard preset was never installed
- **THEN** the standard preset is added from the extension's bundled copy, and a second start-up does nothing
