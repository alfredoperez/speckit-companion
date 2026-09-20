# Core Spec Context — Living Spec

<!-- reviewed: d589a63e -->

## Purpose

What a spec's recorded state means: the per-spec context file, its append-only history, how steps pair with statuses, and which timings can be trusted. The extension, the prompt preamble and the Python writers share this one contract.

## Requirements

### Recorded spec state has one on-disk shape and one append-only log
<!-- touches: apps/vscode/src/core/types/specContext.ts, apps/vscode/src/core/types/spec-context.schema.json -->

A spec's lifecycle SHALL be recorded in its context file's history, which is append-only: entries are never reordered, edited or removed. Step and substep timing SHALL be derived from that history in memory and never persisted beside it.

#### Scenario: a step's timing is displayed
- **WHEN** the viewer shows how long a step took
- **THEN** the figure is derived from the history, and no stored duration exists in the file

### A writer keeps the fields it does not recognize
<!-- touches: apps/vscode/src/core/types/specContext.ts, apps/vscode/src/core/types/spec-context.schema.json -->

Every writer SHALL preserve unknown and legacy fields when it rewrites the context file, so no writer loses another's data.

#### Scenario: a writer that predates a field updates the file
- **WHEN** it rewrites the context file
- **THEN** fields it does not recognize survive unchanged

### Unchecked test coverage is not reported as missing tests
<!-- touches: apps/vscode/src/core/types/specContext.ts -->

A coverage row SHALL distinguish "its named tests were checked and not found" from "nobody checked", because only the first is a finding.

#### Scenario: coverage is recorded without a workspace to resolve against
- **WHEN** no check could be performed
- **THEN** the row reads as unchecked, not as tests that were not found

### The recorded status and the recorded step must not disagree
<!-- touches: apps/vscode/src/core/types/specContext.ts -->

Each non-terminal status SHALL name one owning step and whether that step is running or settled. A status ahead of the history MUST NOT be written, because it renders as work in progress that nobody is doing.

#### Scenario: a step is advanced
- **WHEN** the current step changes
- **THEN** a matching history entry is appended in the same write

#### Scenario: a step is still running
- **WHEN** the status is one of the in-progress forms
- **THEN** the extension reports that step as active, not settled

### The TypeScript and Python sides pair steps with the same statuses
<!-- touches: apps/vscode/src/core/types/specContext.ts -->

The step-to-status pairing SHALL be declared once per language and held together by a test, and every other consumer reads it from there. Finishing implement settles at `implemented`, never `completed`, because closing the spec is its own step.

#### Scenario: the two runtimes disagree about where a step lands
- **WHEN** one side settles a step at a different status than the other
- **THEN** the test comparing them fails, naming the step

#### Scenario: implement finishes
- **WHEN** its completion is recorded
- **THEN** the status becomes `implemented`, not `completed`

### A step the project added leaves the status unchanged
<!-- touches: apps/vscode/src/core/types/specContext.ts -->

A step outside the built-in lifecycle has no status of its own. Recording its start or finish SHALL append the history entry and keep the spec's current status, and the pairing lookup answers "no status" instead of throwing.

#### Scenario: a project-added step starts or finishes
- **WHEN** the writer records its boundary
- **THEN** the history entry is appended and the spec's status is unchanged

### A duration is only shown when the writers at both ends can be trusted with a clock
<!-- touches: apps/vscode/src/core/types/specContext.ts, apps/vscode/src/features/specs/stepHistoryDerivation.ts -->

A span SHALL be trusted only when both boundaries come from an instrumented writer, or from an agent's own script at both ends. A close SHALL NOT outrank the start it finishes, so an agent finishing what the extension started reads as untrusted: that shape is a premature finish, not a measurement.

#### Scenario: the assistant journaled a step's completion
- **WHEN** a step's start or end was written by something other than the extension
- **THEN** no elapsed time is shown for that step

#### Scenario: the whole run's elapsed time is requested
- **WHEN** any expected phase lacks a trusted closed span
- **THEN** no start, end or total is shown, only how many phases were measured

### Every field a script writes is declared in the shared context type
<!-- touches: apps/vscode/src/core/types/specContext.ts, apps/vscode/src/core/types/spec-context.schema.json -->

A field any writer puts in the context file SHALL be declared in the shared context type and the schema reference in the same change. Writers and readers are in different languages, so an undeclared field is one no reader can find.

#### Scenario: a script starts writing a new field
- **WHEN** that change lands
- **THEN** the field is declared in the type and the schema reference

## Uncovered

_None. Every file in the area was read._
