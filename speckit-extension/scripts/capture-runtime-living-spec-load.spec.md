# Living Spec Load — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

How a run learns which living specs cover a change: deterministic recording of loaded capabilities, requirement-sliced loads, and the resolver that serves both.

## Requirements

### Recording which living specs cover a change MUST be deterministic, not AI-judged

The capture runtime SHALL provide a script that, given a feature directory and the changed files, reads the living-specs registry, gates on `enabled: true`, runs the shipped resolver to find the capabilities that own those files, and records their names (most-specific first) onto `livingSpecs.loaded`. The specify command bodies call this script instead of asking the model to gate-and-decide, so the record cannot be lost to a misjudged "not configured." Like every capture script it is best-effort, opt-in, and read-only: any miss is a silent no-op that exits successfully. The recorder also returns its own outcome — `loaded`, `no-match`, or `not-configured` — and writes a deterministic `last_action` breadcrumb from that outcome, so the one-line audit trail the specify command used to ask the AI to author is now derived from what the script actually did rather than the model's reading of it. This is what stops "correctly did nothing" from being misjudged as "not configured."

#### Scenario: an enabled registry with a matching change
- **WHEN** the recorder runs with changed files a configured capability owns
- **THEN** `livingSpecs.loaded` lists the matched capabilities most-specific first
- **AND** the command is never failed or slowed by the recording

#### Scenario: the feature is off or nothing matches
- **WHEN** the registry is absent or disabled, or no capability owns the changed files
- **THEN** the recorder writes nothing and exits successfully

#### Scenario: the recorder writes its own audit breadcrumb
- **WHEN** the recorder finishes — whether it matched, found no match, or found the feature not configured
- **THEN** it writes a `last_action` breadcrumb naming that outcome itself, rather than the specify command asking the model to author the line

### A living-spec load is sliced by requirement, and a spec with no markers is read whole

The resolver SHALL report, for each capability a change matches, either that its spec is read whole — the case when the spec carries no file marker anywhere — or the capability's purpose plus the requirements to contribute: those whose marker matches a changed file, and every requirement carrying no marker. What it reports SHALL be text a step can act on rather than references it must resolve: each requirement carries its own prose and scenarios, the purpose arrives whole, and neither is stripped of the fenced examples inside it. A report SHALL distinguish "nothing was checked" from "nothing was wrong": a registry that could not be read, and a run started from below the repository root, both examined nothing, and rendering either as a clean result is the one failure a report of this kind must never have. Removing fences is how the parser finds a heading, and it must never be what a reader is given. A capability whose markers all miss still appears, with its purpose and no requirements, because it was consulted and completion accounting must still see it. A marker can only narrow: an unmarked requirement is contributed by every load, so a missing or too-narrow marker costs a run an extra requirement rather than starving it of one.

#### Scenario: a marked capability and a change it claims
- **WHEN** a load resolves a capability whose requirements carry markers
- **THEN** it reports the purpose plus the matching and unmarked requirements, and not the whole file
- **AND** each of those requirements arrives with its own text, so the step needs no second read

#### Scenario: a purpose or a requirement containing a fenced example
- **WHEN** the load payload is built
- **THEN** the example is still there, because a reader handed prose with a hole in it cannot tell that anything is missing

#### Scenario: a report runs where it cannot find the registry
- **WHEN** it renders
- **THEN** it says nothing was checked and why, rather than reporting a clean result over files it never opened

#### Scenario: a capability with no markers
- **WHEN** a load resolves it
- **THEN** it is reported as read whole, byte-identical to the behaviour before markers existed

### Which requirements a run read is recorded beside which capabilities it loaded

The capture runtime SHALL record the requirement headings a run read, per capability, as a sibling of the existing loaded-capability list rather than as a change to it — that list is a plain list of names several readers already consume, including the completion accounting that requires every loaded capability to end with a delta or a recorded skip. A capability read whole receives no entry, because naming all of its requirements would say nothing the capability record does not. The write is additive and idempotent, and a failure to record it MUST NEVER fail the host command.

#### Scenario: a capability read by requirement
- **WHEN** the recorder runs
- **THEN** the sibling record names the requirements read, and the capability list keeps its plain-list shape

#### Scenario: a capability read whole
- **WHEN** the recorder runs
- **THEN** the capability is listed as loaded and the sibling record carries no entry for it

#### Scenario: the recorder runs while the editor is writing the same record
- **WHEN** it takes its several read-modify-write turns
- **THEN** each queues on the shared write lock like any other writer, because a script that mutates the record and does not take the lock is the lost write the lock exists to prevent, whichever script it is

#### Scenario: a capability consulted whose markers all missed
- **WHEN** the recorder runs
- **THEN** it records that capability with an empty requirement list, because "consulted and contributed nothing" and "read whole" are different facts and only the second is the absent entry

### The resolver answers for one capability, one requirement, or one file

The resolver SHALL expose the slice a caller asks for — a capability's headings, one requirement in full, or the requirements matching a file — from the same slicing that serves the load steps, so the count it reports equals the coverage denominator and the viewer's outline. A requirement carrying no marker SHALL be returned for every file its capability claims.

#### Scenario: a capability is registered but its spec file is gone
- **WHEN** the resolver is asked for that capability's headings
- **THEN** it reports that there is no spec on disk, never a spec with zero requirements

## Uncovered

- `check-coverage.py` — read only its contract docstring, not its matching logic.
