# Feature Specification: One command to sync living specs from your current changes

**Feature Branch**: `510-living-sync`
**Created**: 2026-07-21
**Status**: Draft
**Input**: GitHub issue #508 — one command / one action that syncs the living specs from your current changes, including uncommitted ones, in a single pass.

## User Scenarios & Testing

### User Story 1 - Sync every affected living spec in one pass (Priority: P1)

A developer who codes directly — no Companion pipeline — has just written or edited code, some of it not yet committed. They run one command and every living spec whose area they touched is brought up to date with the code, without them reading a drift report, hand-picking capabilities, or losing any clarification already written into those specs. The updated spec files are left as ordinary working-tree edits so they commit together with the code that caused them.

**Why this priority**: This is the whole point of the issue — the direct-dev loop is currently three steps with a blind spot (drift can't see uncommitted work, updates are hand-picked one capability at a time). One command closes the loop.

**Independent Test**: In a repo with living specs enabled, edit files in two different capability areas (leave the edits uncommitted, include one brand-new untracked file), run the sync command, and verify both capability specs were updated, the untracked file's behavior is reflected, hand-written clarifications survive, and the spec edits sit uncommitted in the working tree.

**Acceptance Scenarios**:

1. **Given** living specs are enabled and files in two capability areas have uncommitted edits, **When** the sync command runs, **Then** both capabilities are identified automatically and each spec is updated from that capability's changed files only.
2. **Given** a capability spec containing hand-written clarifications and acceptance scenarios untouched by the code change, **When** the sync updates that spec, **Then** those sections survive verbatim — the spec is updated, not regenerated.
3. **Given** a brand-new file (never committed, untracked) inside a capability's area, **When** the sync runs, **Then** that file counts as a change and its behavior is folded into the capability's spec.
4. **Given** files that changed in commits made since a capability's spec was last committed, **When** the sync runs, **Then** those committed-but-never-folded changes are included alongside the uncommitted ones.
5. **Given** the sync has updated one or more specs, **When** it finishes, **Then** it reports which capabilities were synced (and which were skipped, with reasons) and leaves every spec edit uncommitted in the working tree.
6. **Given** living specs are disabled or unconfigured, **When** the sync command runs, **Then** it reports nothing to do and exits cleanly without failing the run.
7. **Given** no file under any capability has changed, **When** the sync runs, **Then** it says everything is already in sync and edits nothing.

### User Story 2 - Read-only drift check that sees the working tree (Priority: P2)

A developer wants to know what has drifted — including work they haven't committed yet — without changing anything. They run the existing drift report with a working-tree option and see uncommitted and untracked changes counted as drift, with the same honest checked/skipped accounting the report already has.

**Why this priority**: It is the read-only preview of what the P1 sync would touch, and the issue names it explicitly as part of the same feature. It is also the grouping engine the sync reuses, so it ships first internally.

**Independent Test**: In a repo with a committed capability spec, make an uncommitted edit to a file in that capability's area; the default drift report shows nothing, the working-tree mode reports the file as drifted; the command exits successfully in both modes.

**Acceptance Scenarios**:

1. **Given** a capability whose area has only uncommitted changes, **When** drift runs in its default mode, **Then** the capability reads as in sync; **When** drift runs in working-tree mode, **Then** the same capability reports the uncommitted file as drifted.
2. **Given** an untracked new file inside a capability's area, **When** drift runs in working-tree mode, **Then** the file is reported as drifted.
3. **Given** any repository state (no git, shallow clone, uncommitted spec, nothing configured), **When** drift runs in working-tree mode, **Then** it still never fails — it exits successfully and reports checked/skipped counts with reasons, exactly as the default mode does.

### User Story 3 - One-click sync from the sidebar (Priority: P3)

A developer working in the editor clicks a "Sync living specs from my changes" action on the Living Specs view and the same one-pass sync is dispatched to their AI assistant — no terminal, no command name to remember.

**Why this priority**: Convenience surface over the P1 command; valuable but strictly additive.

**Independent Test**: With the Companion spec-kit extension installed, click the action in the Living Specs view title area and verify the sync command is dispatched to the active AI provider; without the extension installed, verify the action degrades the same way the other Companion-dependent living-spec actions do.

**Acceptance Scenarios**:

1. **Given** the Companion spec-kit extension is installed, **When** the user triggers the sidebar action, **Then** the sync command is dispatched to the AI provider exactly like the existing adopt/drift actions.
2. **Given** the Companion spec-kit extension is not installed, **When** the user triggers the action, **Then** it degrades per the existing Companion-command gating (no unresolvable command is dispatched).

### Edge Cases

- A capability's spec has never been committed (fresh draft from adoption): there is no committed baseline to diff against — the sync must skip it with a reason rather than guessing, and point at the adoption flow that owns bootstrap.
- The only "changed" file in a capability's area is the living spec itself (or a reserved sibling tier document): that is the spec, not drift — it must not trigger a sync of that capability.
- A changed file matches the registry's exempt globs (tests, config, migrations): it is filtered out, same as the existing drift report.
- Git is unavailable, the directory is not a repository, or history is unreachable (shallow clone): every capability is skipped with a reason; nothing fails.
- Files deleted in the working tree: a deletion is a change to the capability's area and counts as drift to sync.
- The same file appears both in commits since the spec's baseline and in the uncommitted diff: it is reported once, not twice.
- Living specs enabled but zero capabilities configured: the run reports nothing to check and exits cleanly.

## Requirements

### Functional Requirements

- **FR-001**: The spec-kit extension MUST provide a new command, `/speckit.companion.living-sync`, registered in the extension manifest's command inventory so the installer ships it to every agent surface.
- **FR-002**: The sync MUST collect changed files from the working tree — uncommitted modifications (staged and unstaged, including deletions) plus untracked files — and additionally the files changed in commits made since each capability's spec was last committed, de-duplicated into one changed set per capability.
- **FR-003**: The sync MUST group changed files by capability using the same resolver membership rules the existing drift and fold paths use (match globs, most-specific-first, exempt globs honored, own-spec documents excluded, nested project boundaries respected). It MUST NOT introduce a second membership derivation.
- **FR-004**: For each affected capability, the sync MUST apply the established update flow — edit the existing spec in place, preserving every requirement, clarification, and acceptance scenario the code change does not invalidate — scoped to that capability's changed files, automatically for every affected capability with no hand-picking.
- **FR-005**: The sync MUST end with a report naming each capability it synced and each it skipped with the reason, and MUST leave all spec edits uncommitted in the user's working tree.
- **FR-006**: The sync MUST be opt-in and non-halting: with living specs disabled or unconfigured it reports nothing to do and exits successfully, and no failure inside the sync may fail the host run.
- **FR-007**: The drift report MUST gain an opt-in working-tree mode (`--working`) that includes uncommitted and untracked changes in the drifted set, while preserving the existing contract: always exit successfully, report checked/skipped counts with reasons, and never let a clean marker cover unexamined capabilities. The default (no flag) behavior MUST be byte-identical to today's.
- **FR-008**: The sync's grouping MUST be the same derivation the working-tree drift mode computes — one fact, one derivation — so the read-only report and the sync can never disagree about what is out of date.
- **FR-009**: The VS Code extension SHOULD offer a top-level "Sync living specs from my changes" action on the Living Specs view that dispatches `/speckit.companion.living-sync` through the same provider path and Companion-install gating as the existing living-spec actions.
- **FR-010**: A capability whose spec has never been committed MUST be skipped with a reason directing the user to the adoption flow, never redrafted by the sync.

### Key Entities

- **Capability**: a named code area with a living spec (central `capabilities/<name>/spec.md` or colocated), match globs, and an optional exempt list — as already defined by the capability registry.
- **Sync plan**: the per-capability grouping of changed files (committed-since-baseline + uncommitted + untracked) that the working-tree drift derivation produces and the sync consumes.
- **Sync report**: the end-of-run statement of capabilities synced, capabilities skipped with reasons, and the reminder that spec edits are left uncommitted.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A developer with changes spanning multiple capability areas (some uncommitted, some untracked) syncs every affected living spec with exactly one command invocation and zero manual capability selection.
- **SC-002**: After a sync, 100% of the spec content untouched by the code change survives byte-for-byte — no clarification or scenario is lost to regeneration.
- **SC-003**: The drift report in working-tree mode detects an uncommitted change that the default mode reports as clean, and both modes exit successfully in every repository state exercised by the test suite.
- **SC-004**: With living specs disabled, both the sync command and the working-tree drift mode produce no edits, no errors, and a clean exit.
- **SC-005**: The default drift mode's output is unchanged for every existing test case (no regression in the never-fails / counts contract).

## Assumptions

- The sync command is an AI-executed command body (like adopt and drift): the deterministic grouping comes from the shipped scripts, and the spec editing is performed by the AI following the update-not-regenerate instructions, mirroring the editor's existing per-capability Update action.
- "Optionally also include commits since each capability spec was last committed" from the issue is resolved as **always include them**: the working-tree diff is taken against each capability's spec baseline commit, so committed-but-never-folded changes and uncommitted ones arrive in one set. A separate opt-out adds a knob with no clear user.
- The sidebar action ships in this feature (it is small: one command registration, one menu item, one dispatch handler following the existing adopt pattern).
- Deleted files are named in the changed set; the AI is instructed to treat a deletion as behavior removal when updating the spec.

## Verbatim Constraints

- New command name: `/speckit.companion.living-sync`
- Drift flag: `--working`
- Sidebar action label: `Sync living specs from my changes`
- Registration surface: `speckit-extension/extension.yml` `provides.commands` (no `version` bump on this branch)

## ADDED Requirements
<!-- capability: companion-commands -->

### One command syncs every affected living spec from the current changes, uncommitted included

The living-spec family SHALL include a sync command that, in a single pass, groups the working tree's changes — uncommitted edits, deletions, and untracked files, plus commits since each capability spec's baseline — by capability using the same derivation as the drift report's working-tree mode, and updates every affected capability spec in place. Updates are update-not-regenerate: content the change does not invalidate survives verbatim. The run ends with a synced/skipped report, never commits the spec edits, never redrafts a never-committed spec (that belongs to adoption), and inherits the family's opt-in, never-halt contract.

#### Scenario: changes span several capabilities
- **WHEN** the sync runs with working-tree changes touching multiple capability areas
- **THEN** every affected capability's spec is updated, each scoped to its own changed files, with no hand-picking

#### Scenario: nothing is configured
- **WHEN** the sync runs with living specs disabled or absent
- **THEN** it reports nothing to do and exits successfully

## ADDED Requirements
<!-- capability: capture-runtime -->

### The drift detector offers an opt-in working-tree mode

The drift script SHALL accept a working-tree mode that widens each capability's changed set from committed history to the baseline→worktree diff plus untracked files, de-duplicated, with the tracked-vs-unspeced scan widened the same way. The default invocation issues exactly the pre-existing git commands and renders identical human output; the machine-readable result names which mode produced it. The never-fails exit contract and the checked/skipped counts semantics hold in both modes.

#### Scenario: an uncommitted edit in a capability's area
- **WHEN** drift runs without the flag and then with it
- **THEN** the default run reads the capability as in sync and the working-tree run reports the file as drifted

## ADDED Requirements
<!-- capability: specs -->

### The Living Specs view offers a one-pass sync action

The Living Specs view's title bar SHALL carry a sync action that dispatches the living-spec sync command through the active AI provider, following the same dispatch path and companion-install gating as the adoption action. The action itself performs no grouping or file edits — the dispatched command owns the work.

#### Scenario: the action is triggered
- **WHEN** the user triggers the sync title action with the companion extension installed
- **THEN** the sync slash command is dispatched to the AI provider and nothing is edited by the extension itself
