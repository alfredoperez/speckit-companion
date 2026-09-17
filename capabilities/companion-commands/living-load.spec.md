# Living-Spec Load — Living Spec

<!-- reviewed: d589a63e -->

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The specify and plan steps deterministically load the right living-spec requirements and the project's authored rules, narrowing by file when the resolver allows and reading whole when it does not. This keeps the load from silently skipping and each step seeing the brief written for it.

## Requirements

### The specify-time living-spec load is recorded deterministically, not by AI judgment

Given the files the change will touch, a recorder script SHALL re-read the registry (`living-specs.yml`, or the legacy `livingSpecs` block), gate on `enabled`, run the resolver, and write the matched capabilities leaf-first onto `livingSpecs.loaded` plus the one-line audit breadcrumb, all on `.spec-context.json` and never on the lifecycle log. The AI only reads `livingSpecs.loaded` back to pull those specs in, as best-effort background. The recorder SHALL exit 0 silently when the feature is off, nothing matches, or the registry or resolver cannot be read, and is skipped without failing when the interpreter is unavailable.

#### Scenario: the project keeps living specs for a touched area

- **WHEN** the recorder runs with the change's in-scope files against an enabled registry that matches
- **THEN** it writes the matched capabilities leaf-first onto `livingSpecs.loaded` with the audit breadcrumb, and the AI reads those specs back from the record

#### Scenario: nothing is configured or nothing matches

- **WHEN** the recorder runs with the feature off or no capability owning the touched files
- **THEN** it is a silent no-op that exits successfully, and the breadcrumb marks "correctly did nothing" apart from a broken capture

### The load steps read a living spec by requirement, and fall back to the whole file

The specify and plan load steps SHALL ask the resolver what each capability contributes for the touched files and read only that, including each named requirement's own text, not just its heading. When the resolver is unavailable or the call fails, they SHALL read each capability's spec whole, because narrowing must never cost a step its brief.

#### Scenario: the resolver answers
- **WHEN** a load step runs against a capability carrying markers
- **THEN** it reads that capability's purpose and the named requirements only
- **AND** each named requirement arrives with its prose and scenarios, so no second read is needed

#### Scenario: a purpose containing a fenced example
- **WHEN** the purpose is handed to the load step
- **THEN** it arrives whole, fences included, because fence-stripping only decides where the section ends and is never what the reader is given

#### Scenario: the resolver is unavailable
- **WHEN** the call fails
- **THEN** the step reads the whole spec and continues, without failing the command

### A load follows one hop to a rule that lives outside the change

The plan load and each implement worker's slice SHALL ask the resolver to follow a requirement's edge one hop to a rule under another capability, and the command body MUST actually pass that request. A rule reached this way arrives marked unmatched and MUST still be honored, since it governs the change without owning any touched file. Specify does not take the hop, because a wider brief changes nothing about the feature spec it writes.

Without the hop, a worker handed only its phase's files never sees the rule guarding the code it writes.

#### Scenario: a plan touches code governed by a rule elsewhere
- **WHEN** the plan load resolves requirements
- **THEN** it asks for the hop, and the named rule is loaded alongside the file matches

#### Scenario: a worker is handed one phase of that change
- **WHEN** its slice is resolved
- **THEN** it asks for the hop too, so the rule reaches the agent writing the code

#### Scenario: the rule's own capability names a further one
- **WHEN** the hop is followed
- **THEN** it stops after one, so a chain of edges cannot pull in the whole registry

### A project's authored guidance reaches the step it was written for

The specify and plan steps SHALL read their own step's rules from the registry, via the resolver call each already makes, and treat each line as guidance for writing that step's artifact. Neither step SHALL see the other's rules, and a registry with no rules SHALL behave exactly as one written before rules existed.

#### Scenario: a project authors rules for both steps
- **WHEN** a specify run loads living specs
- **THEN** it holds the spec rules and does not hold the plan rules

#### Scenario: the rules cannot be read
- **WHEN** the rules block will not parse
- **THEN** the step runs unchanged and says once that the rules were skipped

## Uncovered

_None. Re-adopted from `capabilities/companion-commands/companion-commands.spec.md`; every requirement was moved verbatim from that spec, not re-read from the code._
