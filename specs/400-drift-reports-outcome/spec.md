# Drift and fold-back summaries report outcome, not intent

## User Scenarios & Testing

### User Story 1 - A drift run that checked nothing must not claim everything is fine (Priority: P1)

A developer adopts a batch of capabilities and immediately asks the drift command whether their code has drifted from its living specs. None of the new capability specs are committed yet, so drift has no baseline to diff against and correctly skips every one of them. Today the run still ends with a green "all in sync" line. The developer — or a script that reads only the last line — walks away believing the code was checked and found clean, when in fact nothing was checked at all.

**Why this priority**: This is the reported defect and the most dangerous shape of it. A false clean bill of health on a check that never ran is worse than no output, because it actively suppresses the follow-up.

**Independent Test**: Configure a project with capabilities whose specs are not committed, run the drift command, and confirm the output states that zero capabilities were checked and names the reason, with no success claim anywhere in the output.

**Acceptance Scenarios**:

1. **Given** a project with nine configured capabilities and no committed capability specs, **When** the drift command runs, **Then** the summary reports zero capabilities checked and nine skipped, and the output contains no "in sync" success claim.
2. **Given** the same run, **When** a reader looks only at the final line, **Then** that line communicates that the check did not run rather than that the code is clean.
3. **Given** a project where the drift feature is switched off, **When** the drift command runs, **Then** it stays silent as it does today — an inert feature reports nothing, not a "zero checked" line.

### User Story 2 - A partly-skipped run reports both halves honestly (Priority: P1)

A project has some capabilities with committed specs and some freshly adopted ones. The run genuinely checks the committed ones and skips the rest. The developer needs to see both numbers, so they can tell a real all-clear on four capabilities apart from an all-clear that quietly ignored five others.

**Why this priority**: The mixed case is the common steady state in a live project, and a summary that mentions only the checked half repeats the same lie at smaller scale.

**Independent Test**: Configure a project with a mix of committed and uncommitted capability specs, run the drift command, and confirm both the checked count and the skipped count appear in the summary.

**Acceptance Scenarios**:

1. **Given** four capabilities with committed specs, all clean, and five without, **When** the drift command runs, **Then** the summary states that four were checked and found in sync and that five were skipped.
2. **Given** a mixed run where at least one checked capability has drifted, **When** the drift command runs, **Then** the drift findings are reported as they are today and the skipped count is still stated.

### User Story 3 - A genuinely clean run still reads as clean (Priority: P1)

A developer with all capability specs committed and no code drift runs the check and gets the familiar success line. Nothing about the fix should make a real all-clear harder to recognize.

**Why this priority**: The fix must narrow the success claim, not remove it. Losing the positive signal would trade one bad summary for another.

**Independent Test**: Configure a project where every capability spec is committed and no source file has changed since, run the drift command, and confirm the success line appears.

**Acceptance Scenarios**:

1. **Given** every configured capability is checked and none has drifted, **When** the drift command runs, **Then** the output states that all capabilities are in sync and names how many were checked.
2. **Given** that same run, **When** a caller inspects the machine-readable output, **Then** it carries the checked and skipped counts as data, not only as rendered text.

### User Story 4 - A caller can tell "clean" from "did not run" (Priority: P2)

An automation step runs the drift check as part of a larger routine and branches on the result. It needs to distinguish a run that checked capabilities and found them clean from a run that checked nothing, without parsing prose.

**Why this priority**: It generalizes the fix from a human-readable line to the programmatic surface, but a human reading the output is the reported harm, so it follows the first three.

**Independent Test**: Run the drift command in an all-skipped state and in a clean state, and confirm a caller can distinguish the two from the result alone.

**Acceptance Scenarios**:

1. **Given** an all-skipped run, **When** a caller inspects the result, **Then** the checked count is zero and the skipped entries name their reasons.
2. **Given** any run at all, including one that finds drift, **When** the command exits, **Then** it exits successfully, because neither a skip nor a finding is a failure of the command itself.

### User Story 5 - Fold-back reports what it applied, not what it attempted (Priority: P2)

A developer folds a feature spec's requirement changes back into a living spec. Three of the changes name requirement headings that do not exist in the living spec, so they match nothing and are silently dropped. The summary line still announces three modified. The developer believes their changes landed; they did not.

**Why this priority**: It is the same defect in a second place, named in the report as a live instance, and it is a contained change. It is P2 only because the drift command is the filed ticket.

**Independent Test**: Fold a spec whose change blocks name headings absent from the living spec, and confirm the summary counts only the changes that actually altered the living spec.

**Acceptance Scenarios**:

1. **Given** a fold where three requirement changes match no heading in the living spec, **When** the fold runs, **Then** the summary does not claim three were modified.
2. **Given** a fold where two of three changes match and one does not, **When** the fold runs, **Then** the summary reports the two that applied and the reader can tell one was dropped.
3. **Given** a fold where every change applies cleanly, **When** the fold runs, **Then** the counts are unchanged from today's output.

## Edge Cases

- Every capability is skipped, but for mixed reasons — some uncommitted, some unresolvable, some because the project is not a repository. The summary must not imply a single cause.
- Zero capabilities are configured at all. This is neither clean nor skipped; the summary must not claim a successful check of an empty set.
- The feature is switched off entirely. The command must stay silent, as it does today.
- A fold where a change block applies to one target capability but matches nothing in a second target. Each target's summary must describe its own outcome.
- A fold where a change is genuinely a no-op because the living spec already carries the identical text. This is "already up to date", which the command already reports separately, and must not be recounted as applied.
- A rename change whose old heading is absent, so nothing is renamed, alongside an addition that does land. The line must not average the two into a single misleading count.

## Requirements

### Functional Requirements

- **FR-001**: The drift command MUST report how many capabilities it actually checked and how many it skipped, in every run where the feature is enabled and at least one capability is configured.
- **FR-002**: The drift command MUST NOT emit a success claim stating that capabilities are in sync when zero capabilities were checked.
- **FR-003**: When at least one capability was checked and none of the checked ones drifted, the drift command MUST state that the checked capabilities are in sync and MUST include the number checked.
- **FR-004**: When capabilities were skipped, the drift command MUST report the skipped count and the per-capability reasons, whether or not any capability was also checked.
- **FR-005**: The drift command's machine-readable output MUST carry the checked count and the skipped count as data, so a caller can distinguish a clean run from a run that checked nothing without parsing rendered text.
- **FR-006**: The drift command MUST continue to exit successfully in all cases — a skip is not a failure, and reporting drift is not a failure of the command.
- **FR-007**: The drift command MUST remain silent and report nothing when the living-specs feature is disabled.
- **FR-008**: The fold-back operation MUST report the number of requirement changes it actually applied to a living spec, not the number it parsed from the feature spec.
- **FR-009**: When the fold-back operation drops a requirement change because its target heading was not found, the reader MUST be able to tell from the output that a change was dropped.
- **FR-010**: The fold-back operation's reported counts MUST be unchanged from today's output when every parsed change applies cleanly.

## Key Entities

- **Capability check outcome** — the per-capability result of a drift run. It is one of: checked and in sync, checked and drifted, or skipped with a stated reason. The summary is a roll-up of these, and every configured capability resolves to exactly one.
- **Drift result** — the whole run's outcome. Carries the list of checked capabilities with their findings, the list of skipped capabilities with reasons, and the counts a caller reads.
- **Applied delta count** — per requirement verb (added, modified, removed, renamed), the number of changes that actually altered the living-spec text, as distinct from the number parsed out of the feature spec.

## Success Criteria

### Measurable Outcomes

- **SC-001**: In a run where every capability is skipped, the phrase claiming capabilities are in sync appears zero times in the output.
- **SC-002**: In a run where every capability is skipped, the output states the checked count as zero and the skipped count as the number of configured capabilities.
- **SC-003**: In a mixed run, both the checked count and the skipped count appear in the summary, and both are accurate.
- **SC-004**: In a fully clean run, the success claim still appears, and it names the number checked.
- **SC-005**: The command exits successfully in 100% of runs, including all-skipped, mixed, clean, and drifted.
- **SC-006**: For a fold where N parsed changes match no heading, the reported applied count for that verb is reduced by exactly N.
- **SC-007**: Every one of the four states above is covered by a regression test that fails when the change is reverted.

## Assumptions

- The correct exit code for an all-skipped run remains 0. A skip is not an error, and the drift command's documented contract is that it never halts; a surrounding routine may gate on findings, the command itself does not. The caller's need to distinguish "clean" from "did not run" is served by the counts in the output and in the machine-readable result, which is a richer signal than an exit code could carry — a single non-zero code could not tell "skipped" apart from "drifted".
- Reporting a dropped fold-back change is best-effort and belongs in the same log line as the counts, rather than becoming a new failure mode. The fold operation is explicitly best-effort today and that stays true.
- The disabled-feature path stays silent rather than gaining a "0 checked" line, because reporting nothing is the documented opt-in contract for a feature that is switched off.
- Only the two named surfaces are changed. Other reporting lines in the same script directory are audited and reported separately rather than modified here.

## Verbatim Constraints

- The all-skipped summary shape named in the request: `0 checked, 9 skipped (spec not yet committed)`
- The success claim to be narrowed: `✓ All capabilities in sync`
- The fold-back count fragment showing attempted rather than applied values: `~3 modified`
