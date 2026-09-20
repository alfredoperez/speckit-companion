# Release the spec-kit extension — Living Spec

## Purpose

A maintainer turns the extension's sources into the command files and the archive a user installs. Without these rules a release ships a command that calls a script the archive lacks, a hand edit vanishes on the next build, or a release tag publishes the wrong product.

## Requirements

### A command file is built from its sources, never edited by hand
<!-- touches: apps/speckit-extension/scripts/build.py, apps/speckit-extension/scripts/assemble_nodes.py, apps/speckit-extension/scripts/_command_parts.py, apps/speckit-extension/scripts/check_shape_parity.py, apps/speckit-extension/nodes/**, apps/speckit-extension/presets/**, apps/speckit-extension/commands/** -->

Every Companion command file SHALL be the output of the build: its own steps in their declared order, with each shared block filled from that block's single source. A change is made in a step or a shared block and the build is rerun. The check mode writes nothing and fails when a committed command file differs from what its sources produce.

#### Scenario: a shared block is edited
- **WHEN** a maintainer edits one shared block and runs the build
- **THEN** every command carrying that block is rewritten with the new text

#### Scenario: a command file is edited directly
- **WHEN** a maintainer changes a committed command file without touching its sources
- **THEN** the check fails and names the command that drifted

### The stock command presets are frozen until a maintainer re-freezes them
<!-- touches: apps/speckit-extension/scripts/build.py, apps/speckit-extension/scripts/check_shape_parity.py, apps/speckit-extension/tests/golden/commands/**, apps/speckit-extension/presets/companion-standard/** -->

The preset copies of the stock commands have no sources to rebuild from, so each SHALL equal its frozen copy. Only the build's bless mode rewrites the frozen copies, and it is run after a deliberate preset or shared block edit.

#### Scenario: a preset changes without a bless
- **WHEN** a preset command's text differs from its frozen copy
- **THEN** the check fails and names the preset

### The release archive carries exactly the scripts the shipped commands reach for
<!-- touches: apps/speckit-extension/scripts/package-manifest.py, apps/speckit-extension/commands/**, apps/speckit-extension/extension.yml -->

The packing list SHALL equal the set of scripts the shipped commands call, followed through each script's own imports, in both directions. The archive's scripts folder is filled from that same list and ends up holding exactly it. A failing list builds no archive.

#### Scenario: a command calls a script that is not on the list
- **WHEN** a new command references a script the packing list leaves out
- **THEN** the check fails and names the script, and no archive can be filled until it is listed

#### Scenario: the staging folder holds something other than scripts
- **WHEN** the archive is filled into a folder holding a subfolder, a document, or the source scripts themselves
- **THEN** the fill is refused, the offending entries are named, and nothing is deleted

### The declared command list is the authority for what is installed and documented
<!-- touches: apps/speckit-extension/scripts/check-command-emissions.py, apps/speckit-extension/extension.yml, apps/speckit-extension/README.md -->

The commands declared in `extension.yml` SHALL match the command files installed into each assistant's folder, the install records the uninstall path reads, and the command tables in the docs. An assistant folder holding none of the installed files counts as not installed and is skipped. A folder holding any is held to the full set. A folder the check does not recognise fails it.

#### Scenario: a command is renamed
- **WHEN** a command is renamed and the old installed file is still present
- **THEN** the check fails with the orphaned file named

#### Scenario: a fresh checkout
- **WHEN** the check runs where the extension was never installed
- **THEN** the installed-files comparison is skipped and the docs comparison still runs

### A project's pipeline build is all or nothing and reaches the copies each assistant reads
<!-- touches: apps/speckit-extension/scripts/build-pipeline.py, apps/speckit-extension/scripts/emission_sync.py -->

Building a project's pipeline from `.specify/companion.yml` SHALL write nothing until every command has assembled, and SHALL refuse a setting it does not understand by naming the line. A finished build replaces the body of each assistant's installed copy and leaves that copy's own header alone. An installed file that holds no assembled body, such as a pointer file, is never rewritten. The build never edits the extension's own sources.

#### Scenario: one command cannot assemble
- **WHEN** a reordered pipeline drops a step whose output a kept step needs
- **THEN** the build stops, says which input is missing, and the previous pipeline is left exactly as it was

#### Scenario: a build succeeds
- **WHEN** a project's build completes
- **THEN** the assistant runs the new pipeline on its next command, and the build reports which copies it wrote and which it could not reach

### A setting written back leaves the rest of the file exactly as the person wrote it
<!-- touches: apps/speckit-extension/scripts/config_write.py, apps/speckit-extension/scripts/companion_config.py -->

Writing one setting into a project's pipeline configuration SHALL change only the lines that setting occupies, so every comment, blank line, quote style and indent width elsewhere in the file comes back byte for byte. Clearing a setting SHALL take its line out and nothing else, leaving an absent key to mean what ships. A value the file's format cannot hold on one line SHALL be refused by name rather than written in a shape the reader gives back wrong.

#### Scenario: the panel reorders a pipeline
- **WHEN** a maintainer reorders the steps of a command from the panel
- **THEN** the file's notes, spacing and four-space indent survive, and the diff shows only the reordered steps

#### Scenario: a selection is cleared
- **WHEN** a maintainer clears the chosen workflow
- **THEN** that one line goes, a note written under it stays, and the project reads its own configuration again

### The spec-kit extension releases under its own tag and a stable download address
<!-- touches: apps/speckit-extension/docs/publishing.md, apps/speckit-extension/extension.yml, .github/workflows/release.yml -->

A spec-kit extension release SHALL use a `speckit-ext-v*` tag, because any `v*` tag publishes the VS Code extension to the Marketplace. The install and update address SHALL be the `companion-latest` prerelease asset, replaced on every release, and never a version-pinned file or a `/releases/latest` lookup. The catalog entry is the one place that pins a version.

#### Scenario: a release is cut
- **WHEN** a maintainer releases version X.Y.Z
- **THEN** a `speckit-ext-vX.Y.Z` release holds `companion-X.Y.Z.zip`, and `companion-latest` serves the same build as `companion.zip`

#### Scenario: a VS Code release lands afterwards
- **WHEN** a newer `v*` release exists in the same releases list
- **THEN** the stable install address still serves the spec-kit extension

## Uncovered

- Nothing checks that the `companion-latest` asset and the newest `speckit-ext-v*` archive are the same build. The publish flow keeps them equal by copying one file.
