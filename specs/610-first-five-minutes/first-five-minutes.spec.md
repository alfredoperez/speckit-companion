# Feature Specification: Finish the first five minutes

**Feature Branch**: `610-first-five-minutes`
**Created**: 2026-09-09
**Status**: Draft
**Input**: Issue #703, re-verified against `main` before drafting

## Why this spec is smaller than the issue

Issue #703 listed six defects in a new user's first five minutes. Five of them were fixed on 2026-09-07 by the commit "make the first five minutes work", which said `Refs #703` rather than `Closes #703`, so the issue stayed open and read as untouched. Each seam was re-verified against `main` before this spec was written:

| Issue item | State on `main` |
| --- | --- |
| Panel first-run state | Fixed. Three welcome entries: install Companion, set up living specs, adopt a first area. |
| Initialize living specs | Fixed. `speckit.livingSpecs.init` asks central or colocated and writes the registry. |
| Adopt asks which area | Fixed. A quick pick with a typed-path branch, and cancel returns early. |
| Coverage rendering | Fixed. Covered, no coverage file, and no coverage in use each render differently. |
| Dashed command names, in code | Fixed. Every provider normalizes at one shared helper, and the IDE chat conversion no longer stops at the first dot. |
| Dashed command names, in shipped prose | **Open.** 19 mentions still print a slash in front of a dotted name. |
| Stale-extension banner | **Open in practice.** The comparison was built, but nothing it learns survives long enough to raise the banner. |

What is left is those two rows. The rest of the issue is done and this spec does not revisit it.

## User Scenarios & Testing

### User Story 1 - The banner about a stale spec-kit extension actually appears (Priority: P1)

A developer has SpecKit Companion running and their spec-kit extension is several versions behind what has been published. Today the extension learns the published version from GitHub, but only inside a network call that starts after the decision to show the banner has already been made, and only on the roughly one activation in a day that is not skipped by the once-a-day gate. What it learns is held in memory and thrown away when the window closes. So the developer is never told, sits on stale commands indefinitely, and blames the commands rather than their version.

**Why this priority**: this is the one item in the issue's "done when" list that the previous pass did not actually deliver. The comparison exists and is correct; nothing reaches it in time to matter.

**Independent Test**: put a workspace on an old spec-kit extension version, let the extension check for updates once, restart the window, and confirm the out-of-date warning is there. It must also appear on a later start when the daily check is skipped entirely.

**Acceptance Scenarios**:

1. **Given** the extension has never learned a published version, **When** the update check runs and finds a newer published spec-kit extension than the one installed in the workspace, **Then** that published version is remembered across restarts.
2. **Given** a published version was remembered on an earlier run, **When** the extension starts and the daily gate skips the network check entirely, **Then** the comparison still uses that remembered version and the out-of-date warning appears.
3. **Given** the workspace's installed spec-kit extension is newer than anything published, **When** the comparison runs, **Then** no warning appears.
4. **Given** the extension has never learned a published version and no check has succeeded, **When** the comparison runs, **Then** it falls back to the copy bundled in this build and behaves exactly as it does today.

### User Story 2 - No pipeline command ever prints a name a user cannot type (Priority: P2)

The pipeline's own instructions still tell the assistant to "dispatch `/speckit.companion.plan`". On Claude Code the registered name is dashed, so a slash in front of a dotted name is a name that resolves to nothing. Every command already carries a rule saying to use the spelling the project registered, but a rule competing with 19 literal examples is a rule the model can lose.

**Why this priority**: the rule already mitigates it, so this is hardening rather than a break. It is still the difference between the issue's "a Claude user never sees a dotted slash command, anywhere" being true and being nearly true.

**Independent Test**: read the built commands and find no slash in front of a dotted command name outside the one place that is teaching the spelling rule itself.

**Acceptance Scenarios**:

1. **Given** a node or preset names a pipeline command in its prose, **When** that text is built into a shipped command, **Then** the name appears without a leading slash.
2. **Given** the part whose whole subject is how commands are spelled, **When** it shows both forms as examples, **Then** it keeps them, because removing them removes the lesson.
3. **Given** the reworded prose, **When** the shape-parity and golden checks run, **Then** they pass with the goldens regenerated.

## Edge Cases

- The remembered published version is corrupt or from an older storage format. It is ignored and the bundled version is used, rather than crashing activation.
- The published version is remembered, then the user updates past it. The comparison reports current, not outdated.
- The network check succeeds during a session that had already decided not to warn. The warning is allowed to wait for the next start rather than interrupting mid-session.
- A node's prose names a command that is not part of the pipeline. It is left alone.

## Requirements

### Functional Requirements

- **FR-001**: The extension MUST persist the newest published spec-kit extension version it learns, so a later session can compare against it without a network call.
- **FR-002**: The extension MUST seed its comparison from that persisted version at startup, before deciding whether to show the out-of-date warning.
- **FR-003**: The comparison MUST use whichever is newer of the bundled copy and the persisted published version, and MUST fall back to the bundled copy alone when nothing has been persisted.
- **FR-004**: A persisted value that cannot be read as a version MUST be ignored rather than allowed to break activation.
- **FR-005**: The published-version selector and the expected-version comparison MUST each be covered by tests, including the case where only one of the two sources is known.
- **FR-006**: Shipped node and preset prose MUST name a pipeline command without a leading slash.
- **FR-007**: The part that teaches how commands are spelled MUST keep its own examples of both spellings.
- **FR-008**: The built commands and their goldens MUST be regenerated so the shipped text matches the reworded sources.

## Key Entities

- **Published version**: the highest `speckit-ext-v` release tag on the shared releases list, excluding drafts and prereleases. Learned from the network, now also stored.
- **Bundled version**: the spec-kit extension version shipped inside this build of the VS Code extension.
- **Installed version**: the spec-kit extension version present in the user's workspace. The thing being judged.
- **Expected version**: the newer of bundled and published. What installed is compared against.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A workspace on a stale spec-kit extension shows the out-of-date warning on the first start after one successful update check, with no further network call needed.
- **SC-002**: The warning appears on a start where the daily update check is skipped, which is the majority of starts.
- **SC-003**: Zero occurrences of a slash before a dotted pipeline command name in the built commands, outside the part that teaches the spelling rule.
- **SC-004**: The full test suite passes, and the spec-kit extension's shape-parity, manifest, emissions, and instruction-budget checks stay clean.

## Assumptions

- Persisting to the extension's own global storage is the right home for the published version: it is a cache of something public, not user data, and it should survive a window reload.
- Raising the warning mid-session, immediately after the network call lands, is deliberately out of scope. It would mean threading a refresh through activation for a case that resolves itself on the next start, and the next start is soon.
- The prose rewording drops the leading slash and keeps the dotted name, because the dotted name is the canonical command id and only the slash invites a verbatim copy.

## Verbatim Constraints

- `speckit-ext-v` — the release tag prefix the selector matches.
- `companion-latest` — the fixed prerelease tag the installer downloads from. Unchanged by this work.

## Approach

- `src/core/constants.ts` gains one global-storage key for the published spec-kit extension version.
- `src/speckit/companionVersionGap.ts` filters what it is told through the same version check the rest of the module uses, so neither a GitHub tag nor a value written by an older build can become the yardstick. It also exposes what it currently holds, so a caller can persist it.
- `src/speckit/updateChecker.ts` writes the accepted version to global storage when a check learns one, and seeds itself from storage in its constructor. The constructor is the right moment because the gap is first resolved later in the same activation.
- Raising the warning mid-session is deliberately not done. It resolves on the next start.
- The nineteen prose mentions across four nodes, two handoffs and one preset part lose their leading slash and keep the dotted id. `presets/_parts/command-spelling.md` keeps both spellings, because they are its lesson.
- The built commands and goldens are regenerated from the reworded sources.
- `docs/getting-started.md` said the check is local and never needs the network. That stopped being true when the published-version comparison landed, so it is corrected here.
