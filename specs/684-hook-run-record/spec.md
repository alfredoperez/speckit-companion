# Feature Specification: A record of which hooks ran

**Source**: Workflow Builder Trial, section 7, gap 1 (vault `Projects/speckit companion/plans/workflow-builder/Workflow Builder Trial.md`)

## User Scenarios & Testing

### User Story 1 - The assistant says whether each hook ran (Priority: P1)

A project attaches hooks to its Companion pipeline: a skill to invoke, a prompt to follow, a shell line to run, a node to splice in. Today a run leaves no trace of them, so after a run nobody can tell whether a hooked skill was used. In the trial only two of six hooked skills were really followed. With this change each hook's own text ends with one short instruction: record whether you ran it or chose to skip it, riding on a record call the step already makes. The record lands in the spec's run record, beside everything else the run wrote.

**Why this priority**: without the record there is nothing for the board to show.

**Independent Test**: build a project with a skill hook, render the command, and see that the hook block ends with the record instruction naming that exact hook. Run the recording call it names and see one entry land in the spec's run record.

**Acceptance Scenarios**:

1. **Given** a project with an `after finalize` skill hook on specify, **When** the commands are built, **Then** the hook's rendered block ends with one line telling the assistant how to record `ran` or `skipped` for that hook, naming its step, when, anchor, place, type and skill.
2. **Given** that instruction, **When** the assistant adds the record flag to a record call it was already making (a batch, a step close, a substep finish), **Then** the call still does its own work and one hook entry is appended.
3. **Given** the assistant skipped the hook, **When** it records `skipped` with a reason, **Then** the entry keeps the reason as one line.
4. **Given** two records for the same hook in one spec, **When** both land, **Then** both are kept in order; nothing is rewritten.

### User Story 2 - The Workflow Builder reads the last run's outcome per hook (Priority: P1)

The redesigned board shows, on each hook, "ran", "skipped" or "not seen". The panel asks the host for the outcomes of the most recent spec run in the project. The host answers with that spec's name and, for each hook it has a record of, the last outcome, when it was recorded and why it was skipped. A hook in the pipeline with no record in that run is "not seen"; that is never written, it is what the board concludes.

**Why this priority**: the record is only useful once a person can see it where the hooks are drawn.

**Independent Test**: put two specs with fixture run records in a project, ask the host, and get the newer spec's outcomes, the last one per hook.

**Acceptance Scenarios**:

1. **Given** a project with no spec runs, **When** the panel asks, **Then** the answer says there is no run.
2. **Given** two specs, the newer one with hook records, **When** the panel asks, **Then** the answer names the newer spec and lists its hook outcomes, one per hook, the latest of each.
3. **Given** the newest spec has no hook records, **When** the panel asks, **Then** the answer names that spec with an empty list, so every hook reads "not seen".
4. **Given** a spec whose run record is unreadable, **When** the panel asks, **Then** that spec is passed over and the answer still comes back.

### User Story 3 - The hook reference names every hook type (Priority: P3)

The reference an assistant reads when a command has hooks lists `command`, `prompt` and `node`, and omits `skill`. It also does not say how to record the outcome. After this change it names all four and the record rule.

**Why this priority**: documentation, cheap, and the assistant reads it on every hooked run.

**Independent Test**: read the reference and find `skill` and the record flag.

**Acceptance Scenarios**:

1. **Given** the node-hooks reference, **When** read, **Then** it lists the `skill` type and says how to record ran or skipped.

### Edge Cases

- A hook after the step's last record call has nothing left to ride on: the instruction allows one call of its own then.
- A malformed record (unknown outcome, missing parts) is refused with a message and writes nothing, and the call's other work still happens.
- A record call that carries only the hook record still writes it, with no step boundary added.
- Hooks reordered since the run: the record carries the type and ref as well as the place, so a reader can tell a stale record from a current one.
- A background hook: the record is written when its result is known, never from a background process, because the run record is a shared file.
- The `shipped` workflow renders no project hooks, so it asks for no records.

## Requirements

### Functional Requirements

- **FR-001**: Each rendered Companion hook MUST end with one instruction to record its outcome, naming the hook by step, when, anchor, place, type and ref.
- **FR-002**: The record MUST be accepted on any call of the existing run-record writer, alongside whatever else that call does, so recording adds no call when the step makes another one later.
- **FR-003**: The writer MUST append each record, stamped with when and `by: ai`, to the spec's run record under the same lock as every other write, never rewriting or removing an earlier record.
- **FR-004**: A record's outcome MUST be `ran` or `skipped`; a `skipped` record MAY carry a one-line reason. Anything else MUST be refused without writing.
- **FR-005**: The step boundary log MUST NOT change meaning: hook records MUST NOT be read as step starts or finishes by any existing reader.
- **FR-006**: The host MUST offer the panel a read that returns, for the most recent spec run in the project, that spec and its last outcome per hook with when it was recorded; or that there is no run.
- **FR-007**: The read MUST pass over a spec whose run record cannot be read rather than fail.
- **FR-008**: "Not seen" MUST never be written; the message MUST give each outcome a key the panel can match against a hook it draws.
- **FR-009**: The node-hooks reference MUST list the `skill` hook type and the record rule.

### Key Entities

- **Hook record**: one hook's outcome in one run. Step, when, anchor, place among the hooks there, type, ref, outcome (`ran` or `skipped`), optional reason, when recorded, who (`ai`).
- **Run record** *(existing)*: the spec's `.spec-context.json`; gains one append-only list.
- **Hook outcomes answer**: the spec the latest run belongs to, and its last record per hook.

## Success Criteria

### Measurable Outcomes

- **SC-001**: After a run in which the assistant follows the instruction, 100% of the hooks it reached have a record in the run record.
- **SC-002**: Recording adds zero calls for a hook followed by any other record call in the same step, and at most one otherwise.
- **SC-003**: The rendered instruction adds at most one line per hook.
- **SC-004**: The panel gets an answer for a project with 50 specs in under a second.

## Non-goals

- Proving a hook ran. A record is the assistant's own report (`by: ai`); it is better than no trace and still not proof.
- Records for stock Spec Kit hooks in `.specify/extensions.yml`; this covers Companion's own node hooks.
- Drawing the outcomes on the board; the webview is rebuilt elsewhere.
- Changing what a hook does or when it runs.

## Change-level rules

- One writer: the existing run-record writer and its lock. No second writer.
- Add to the panel message contract; never remove or rename a message or field.
- The pipeline's shape stays derived once in the graph script; the host never re-derives which hooks exist.

## Verification plan

1. Build a fixture project with one hook of each type and check each rendered block ends with the record line.
2. Run the writer with a record alone, with a batch, and with a step close; check one entry each and the other work intact.
3. Run the host read against fixture specs: none, newest without records, two specs with records, one unreadable.

## Assumptions

- "Most recent spec run" is the spec whose run record shows the latest activity: its newest history or hook record time.
- "Last outcome per hook" is the newest record for that hook in that spec, across re-runs of the spec.
- The records live in their own list in the run record rather than in the step history, because every existing history reader would count an unknown entry as a step start.

## Verbatim Constraints

- Outcomes: `ran`, `skipped`.
- Hook types: `command`, `prompt`, `node`, `skill`.
