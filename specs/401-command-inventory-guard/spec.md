# Guard the command inventory against drift, and complete the command reference

## User Scenarios & Testing

### User Story 1 - Catch a renamed or removed command before it ships (Priority: P1)

A maintainer renames or deletes a Companion command. Today nothing notices that the old name is still registered and still installed in every project that ever ran the extension, and nothing notices that the new name was never recorded. The maintainer gets a clean build, ships, and users end up with two versions of the same command living side by side — the old one frozen at whatever text it had when it was written.

This story gives the repo a single check that reads the extension's declared command list and compares it against both the project's install records and the command files actually sitting on disk, then reports every disagreement by name and exact path.

**Why this priority** — This is the only part of the report that prevents the problem from recurring. Everything else in this feature documents or repairs a mess that already happened; this is what stops the next one. It also stands alone: the check is useful with no other change.

**Independent Test** — Add a command file on disk under a name the extension does not declare, run the check, and confirm it fails and names that path. Remove a declared command's file, run the check, and confirm it fails and names the missing command. Run it on a healthy tree and confirm it passes.

**Acceptance Scenarios**

1. **Given** the declared command list and the installed command files agree, **When** the check runs, **Then** it reports success and exits with a success status.
2. **Given** a command file on disk under a name the extension no longer declares, **When** the check runs, **Then** it reports that name as an orphan, prints the exact path, and exits with a failure status.
3. **Given** a declared command that has no file on disk, **When** the check runs, **Then** it reports that command as missing and exits with a failure status.
4. **Given** an install record listing a command name the extension no longer declares, **When** the check runs, **Then** it reports that record as stale and names it.
5. **Given** a location the check cannot make sense of — an install area it does not recognize, or a file whose name does not fit any known pattern — **When** the check runs, **Then** it reports that explicitly and fails, rather than quietly ignoring it.
6. **Given** the frozen sample projects kept under `examples/`, **When** the check runs, **Then** it does not inspect them, because they are deliberately preserved snapshots of older command names.

### User Story 2 - Repair the stale install records in this repo (Priority: P1)

This repository's own install records still describe the command set as it was before the last rename. The four automatic capture steps are registered under names that no longer exist, and the records list eight old command names while listing none of the eight new ones. Anyone reading those records — or any tool that acts on them, including the uninstall path — is working from an out-of-date picture.

**Why this priority** — It is a live, wrong state in the repository right now, and it is the exact failure the check in Story 1 exists to surface. Fixing it is what makes the check pass, and it removes a real trap from the uninstall path.

**Independent Test** — Run the check from Story 1 before the repair and confirm it reports the stale records; run it after and confirm it passes.

**Acceptance Scenarios**

1. **Given** install records naming the pre-rename capture steps, **When** the repair is applied, **Then** those records name the current capture steps instead.
2. **Given** install records listing eight retired command names, **When** the repair is applied, **Then** they list the current command names and none of the retired ones.
3. **Given** the repair is applied, **When** the check from Story 1 runs, **Then** it passes.

### User Story 3 - Find every command in one place (Priority: P2)

Someone wanting to know what the extension actually offers has no complete list. The overview table omits one command entirely, and the detailed reference covers only a third of them. The commands are also presented as one flat list, so nothing signals that four of them run themselves and must never be typed by hand.

**Why this priority** — It is the second half of the reported problem and the part a user meets first, but it changes no behavior, so it ranks below the two correctness stories.

**Independent Test** — Compare the declared command list against the two documents and confirm every declared command appears in both, grouped by family, with the automatic ones marked as automatic and labelled with the event that triggers them.

**Acceptance Scenarios**

1. **Given** the extension's declared command list, **When** the overview table is read, **Then** every declared command appears in it, including the one currently missing.
2. **Given** the overview table, **When** it is read, **Then** commands are grouped by family — the pipeline, the run-state commands, the living-specs commands, and the automatic ones.
3. **Given** an automatic command in either document, **When** it is read, **Then** it states which event triggers it and that it is not meant to be invoked by hand.
4. **Given** the detailed reference, **When** it is read, **Then** every declared command is described there.

### User Story 4 - Keep the reference honest as commands change (Priority: P3)

A future maintainer adds a command and updates the manifest but forgets the documentation, and the reference silently falls behind again.

**Why this priority** — Valuable, but it only pays off on the next change, and it is meaningless until Story 3 has brought the documents up to date.

**Independent Test** — Add a declared command without documenting it and confirm the check reports the gap.

**Acceptance Scenarios**

1. **Given** a declared command absent from the overview table or the detailed reference, **When** the check runs, **Then** it reports which document is missing which command and fails.

## Edge Cases

- An install area that exists but holds no Companion commands at all — is that a fresh install or a wiped one? The check must not treat an empty area as agreement by default.
- A file inside a known install area whose name matches no declared command and no known naming pattern.
- An install area the check has never heard of appearing in the repository later.
- A declared command present in some install areas but not others — a partial install, which must be reported per area, not collapsed into one verdict.
- The check running in a repository where the extension was never installed, so there are no install records at all.
- Two install areas that use different naming shapes for the same command, so a name must be translated per area rather than compared literally.

## Requirements

### Functional Requirements

- **FR-001** The check MUST read the authoritative command list from the extension manifest's declared commands, and MUST NOT carry a second hand-maintained copy of that list.
- **FR-002** The check MUST compare that list against the command files present in each install area in this repository.
- **FR-003** The check MUST report, per install area, any command file whose name is not in the manifest, naming the exact path.
- **FR-004** The check MUST report, per install area, any manifest command that has no corresponding file, naming the command and the area.
- **FR-005** The check MUST compare the manifest against the project's install records and report any recorded command name absent from the manifest, and any manifest command absent from the records.
- **FR-006** The check MUST fail loudly on any input it cannot resolve — an unrecognized install area, or a file it cannot map to a command name — rather than skipping it silently.
- **FR-007** The check MUST NOT inspect the preserved sample projects under `examples/`.
- **FR-008** The check MUST exit with a success status when it finds no disagreement, and a failure status when it finds any.
- **FR-009** The check MUST run using only the standard library, consistent with the repository's other checks.
- **FR-010** The check MUST verify that every manifest command appears in both the overview table and the detailed reference, and report which document omits which command.
- **FR-011** The check MUST be covered by tests that exercise each direction of drift it claims to catch, each with an input that genuinely fails the check.
- **FR-012** The project's install records MUST be corrected so the automatic capture steps are registered under their current names.
- **FR-013** The project's install records MUST be corrected so the recorded command list matches the manifest.
- **FR-014** The overview table MUST list every manifest command, grouped by family.
- **FR-015** The overview table MUST identify each automatic command as automatic and name the event that triggers it.
- **FR-016** The detailed reference MUST describe every manifest command.
- **FR-017** The release notes MUST record the change in user-facing terms, naming no internal files or symbols.

## Key Entities

- **Command** — one entry the extension declares it provides: a name, the file holding its instructions, and a one-line description. The manifest's list of these is the single authority for what exists.
- **Install area** — a directory belonging to one AI tool where the installer writes the command files, each with its own naming shape and file extension.
- **Install record** — the project's stored account of which commands were registered for which tool, plus which command each automatic event triggers. This is the record that goes stale, because a reinstall adds to it and never removes from it.
- **Orphan** — a command present in an install area or an install record that the manifest no longer declares.
- **Gap** — a command the manifest declares that is absent from an install area, an install record, or a document.

## Success Criteria

### Measurable Outcomes

- **SC-001** The check reports every one of the four drift directions it covers — orphan on disk, gap on disk, stale record, undocumented command — with a test per direction that fails when the check is broken.
- **SC-002** Running the check on the repository as it stands today reports the stale install records; running it after the repair reports no disagreement.
- **SC-003** Every command the manifest declares appears in the overview table, and every one appears in the detailed reference — a count of undocumented commands of zero, down from one and eleven respectively.
- **SC-004** The check inspects every install area in the repository that holds command files, with none skipped silently.
- **SC-005** The check completes in under five seconds on this repository, so it is cheap enough to run on every change.
- **SC-006** No command name, install area, or documentation requirement is written down in more than one place, so a future rename has exactly one list to update.

## Assumptions

- The manifest's declared command list is the single authority; install records and files on disk are downstream of it and are wrong when they disagree.
- The pruning of stale commands during a reinstall belongs to the spec-kit CLI, not this repository, because the CLI owns the install records and the delete path. This feature therefore covers detection and repair only, and reports the pruning gap upstream rather than working around it.
- The sample projects under `examples/` are deliberately frozen at older command names and are documentation of past decisions, so they are excluded rather than repaired.
- The command files written into install areas are local install output, not committed source, so the check inspects the working tree rather than tracked files.
- Grouping the overview table by family follows the families already implied by the command names: the pipeline, run state, living specs, and the automatic capture steps.
- The four automatic capture steps are the ones a user must never invoke by hand; every other command is user-invokable.

## Verbatim Constraints

- Detector script name: `check-command-emissions.py`
- Detector script location: `speckit-extension/scripts/`
- Manifest command list: `provides.commands` in `speckit-extension/extension.yml`
- Overview table location: `speckit-extension/README.md`
- Detailed reference location: `speckit-extension/docs/commands.md`
- Release notes location: `[Unreleased]` in `speckit-extension/CHANGELOG.md`
- Install areas to inspect: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/prompts/`, `.github/agents/`, `.qwen/commands/`, `.gemini/commands/`
- Excluded from inspection: `examples/`
- Command family groups: Pipeline, Run state, Living specs, Hooks (never invoke)
