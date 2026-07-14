# Feature Specification: Ship every runtime script the commands call

**Feature Branch**: `395-package-runtime-scripts`
**Created**: 2026-07-13
**Status**: Draft
**Issue**: [#432](https://github.com/alfredoperez/speckit-companion/issues/432)

## Overview

People who install the SpecKit Companion spec-kit extension from its published release archive get an extension whose commands cannot run. Several commands call helper programs that were never put into the archive, so the moment a user runs one, the helper is simply not on disk. The helpers are not missing from the project — they exist and work. They just never get packed into the box that ships.

The list of what goes into the box is maintained by hand, in prose, in two separate documents, and nothing checks it against what the commands actually need. It fell behind, and no test noticed.

## User Scenarios & Testing

### User Story 1 - A released extension's commands actually run (Priority: P1)

A developer installs the extension from its published download and runs the brownfield adoption command. Today the command starts, then stops because the helper program it needs is not there, and the assistant has to ask the user where the program lives. The developer's honest conclusion is that the feature was never finished. The same failure hits the drift and coverage commands, and it silently degrades the two core pipeline commands, which quietly lose the project context they were supposed to load.

After this change, every helper program that any shipped command invokes is present in the installed extension, so each of those commands runs end to end from a clean install.

**Why this priority**: This is the reported defect. Three commands are entirely unusable and two more are silently degraded for every user who installed the normal way. Nothing else matters until the box contains what the commands need.

**Independent Test**: Build the release archive, install it into a scratch project, and run each command that calls a helper. Every helper it reaches for is on disk; no command aborts for a missing program.

**Acceptance Scenarios**:

1. **Given** a release archive built by the documented publish flow, **When** its contents are listed, **Then** every helper program reachable from a shipped command is present.
2. **Given** the extension installed from that archive, **When** the adoption command runs, **Then** it completes its registration step instead of reporting the helper as missing.
3. **Given** the same install, **When** the drift command and the coverage command run, **Then** each produces its report rather than failing to start.
4. **Given** the same install, **When** the two core pipeline commands run in a project that uses living specs, **Then** they load that context successfully instead of skipping it because the resolver is absent.
5. **Given** a release archive, **When** its contents are listed, **Then** no build-only or test-only program is included, and no documentation, examples, or test files are included.

### User Story 2 - The packing list can never quietly fall behind again (Priority: P1)

A maintainer adds a new command that calls a new helper program, or points an existing command at a helper it did not use before. Today they must remember to also hand-edit a copy-files line in two different documents; if they forget, everything still passes, the release still ships, and the break only surfaces in a user's install weeks later. That is exactly how this defect happened.

After this change there is one machine-readable packing list, and an automated check fails the build when the packing list and the commands disagree in either direction: a helper a command needs but that isn't packed, or a program packed that nothing needs.

**Why this priority**: Shipping the missing helpers fixes today's break. Without this story, the same class of break returns on the next command that grows a new dependency. The reporter found this bug in a feature that had been "shipped" — the process, not the code, is the defect.

**Independent Test**: Point a shipped command at a helper that isn't on the packing list, then run the automated check. It fails and names the missing helper. Add a program to the packing list that nothing calls, run the check again, and it fails and names the unused entry.

**Acceptance Scenarios**:

1. **Given** the project as it stands after this change, **When** the automated check runs, **Then** it passes.
2. **Given** a shipped command edited to call a helper program that is not on the packing list, **When** the check runs, **Then** it fails and names the unpacked helper.
3. **Given** a helper program that a packed program imports but that is itself not on the packing list, **When** the check runs, **Then** it fails and names it — an indirect need counts the same as a direct one.
4. **Given** the packing list containing an entry that no shipped command needs, directly or indirectly, **When** the check runs, **Then** it fails and names the unused entry.
5. **Given** the check, **When** the project's automated test run executes, **Then** the check runs as part of it, so a disagreement blocks the change rather than surfacing after release.

### User Story 3 - The publish flow reads the packing list instead of restating it (Priority: P2)

A maintainer cutting a release follows the publish steps. Today those steps embed a literal list of files to copy, duplicated in two documents, either of which can drift from reality. After this change the publish step asks the packing list what to copy, so the release archive and the automated check are guaranteed to agree by construction — there is nothing left to keep in sync by hand.

**Why this priority**: The check in Story 2 prevents a silent break, but as long as the publish flow restates the list independently, a maintainer can still produce an archive that disagrees with the checked list. Sourcing both from one place closes the loop. It's P2 because Story 2 already turns this failure from silent into loud.

**Independent Test**: Run the publish flow's archive step and compare the archive's contents against the packing list — they match exactly, with no file list written out anywhere in the publish instructions.

**Acceptance Scenarios**:

1. **Given** the publish instructions, **When** they are read, **Then** they contain no hand-written list of helper programs to copy.
2. **Given** the archive step is run, **When** the resulting archive is inspected, **Then** its helper programs are exactly the packing list's entries.
3. **Given** a helper is added to the packing list, **When** the archive step is re-run with no edit to the publish instructions, **Then** the new helper appears in the archive.

## Edge Cases

- A helper is referenced from a command only inside a code fence or an illustrative example, not as a real instruction. It still needs to ship, because the assistant reading the command body may run it — treat any reference as a real need.
- A helper is reached only indirectly, never named by any command (loaded by another helper). It must ship, and the check must find it by following the chain, not just by scanning command text.
- A helper imports something from the standard library. The check must not mistake that for a project program it should demand be packed.
- Two helpers reference each other, or a chain loops back on itself. Following the chain must terminate rather than spin.
- A helper's name contains a hyphen and so cannot be imported by name the usual way; it gets loaded by filename instead. The check must recognize that form of dependency too.
- A program exists in the project but is only used at build or test time. It must be excluded from the archive, and the check must not demand it be packed.
- The publish flow runs where the packing list cannot be consulted. It must fail loudly rather than quietly produce an archive with some files missing.

## Requirements

### Functional Requirements

- **FR-001**: The release archive MUST contain every helper program that a shipped command invokes, including those reached only indirectly through another helper.
- **FR-002**: The release archive MUST NOT contain programs used only for building or testing the project, nor documentation, examples, or test files. It remains an explicit list of what to include, never a list of what to leave out.
- **FR-003**: The project MUST have exactly one machine-readable list of the programs that ship at runtime; no other document may restate that list.
- **FR-004**: An automated check MUST fail when a shipped command needs a program, directly or indirectly, that the packing list does not include, and MUST name the offending program.
- **FR-005**: The same automated check MUST fail when the packing list includes a program that no shipped command needs, directly or indirectly, and MUST name it.
- **FR-006**: The automated check MUST determine what a command needs by reading the shipped command text and then following each referenced program's own dependencies to their conclusion, terminating even when those dependencies form a cycle.
- **FR-007**: The automated check MUST run as part of the project's existing automated test run, so a disagreement blocks the change before release.
- **FR-008**: The publish flow MUST obtain the files to copy from the single packing list rather than restating them, and MUST fail loudly if the list cannot be read.
- **FR-009**: The extension's own changelog and readme MUST record the fix under the pending-release section, so an existing user can tell a repaired build from the broken one once it ships. The version itself MUST NOT be raised here — the release flow owns that bump when it cuts the build.
- **FR-010**: The change MUST NOT alter what any command instructs the assistant to do; only what ships alongside those commands changes.

### Key Entities

- **Packing list** — the single, machine-readable set of helper programs that ship inside the release archive. Consumed by both the automated check and the publish flow.
- **Shipped command** — a command declared by the extension's manifest, whose text an assistant reads and acts on, and which may invoke helper programs by path.
- **Helper program** — a program invoked by a shipped command, or reached from one through another helper's own dependencies. Every one of these must be on the packing list.
- **Build-only program** — a program used to build, verify, or test the project, never invoked by a shipped command. Never on the packing list.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A user installing from the published archive can run all shipped commands; zero of them abort because a helper program is absent (today three do, and two more degrade silently).
- **SC-002**: 100% of helper programs reachable from a shipped command are present in the release archive.
- **SC-003**: Zero build-only or test-only programs, and zero documentation or example files, are present in the release archive.
- **SC-004**: The packing list is stated in exactly one place; a search of the project finds no second hand-written copy of it.
- **SC-005**: Introducing a command that needs an unpacked helper causes the automated test run to fail, in under a minute, with a message naming that helper.
- **SC-006**: The archive produced by the publish flow and the set the automated check validates are identical for every release, by construction rather than by review.

## Assumptions

- The reported defect needs no new helper programs written. Every program the commands call already exists and works; the fix is packaging and the process that keeps packaging honest.
- The three helpers the archive currently carries stay; the fix adds the ones that are missing rather than reorganizing what ships.
- The fix is patch-level, since no command's behavior or interface changes for someone who already had a working install. The bump itself is the release flow's to make, not this change's — notes accumulate under the pending-release section until then.
- The publish flow's other steps (tagging, the rolling download, the catalog entry) are out of scope and unchanged.
- Actually cutting a new release is a separate, human-triggered action; this change makes the next release correct but does not publish one.

## Verbatim Constraints

The following are pinned by the request and must be matched exactly.

Helper programs that MUST ship (the full set reachable from shipped commands):

- `write-context.py`
- `status-context.py`
- `derive-from-files.py`
- `resolve-spec-paths.py`
- `companion_config.py`
- `register-capability.py`
- `drift.py`
- `check-coverage.py`

Programs that MUST NOT ship (build/test only):

- `build-commands.py`
- `check-shape-parity.py`
- `assemble-nodes.py`
- `capture-golden.py`
- `_command_parts.py`

Documents that carry the duplicated copy-files instruction and must stop restating it:

- `speckit-extension/docs/publishing.md`
- `.claude/commands/publish-speckit-ext.md`

Scope fence: only `speckit-extension/README.md` and `speckit-extension/CHANGELOG.md` may be updated for docs. `speckit-extension/extension.yml`'s `extension.version` MUST be left alone — `/publish-speckit-ext` bumps it at release time, and the changelog entry lands under `[Unreleased]` until then. The root `README.md`, `CHANGELOG.md`, and `package.json` MUST NOT be touched.
