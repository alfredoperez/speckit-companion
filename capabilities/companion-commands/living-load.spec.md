# Living-Spec Load — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The specify and plan steps pull the right living-spec requirements and the project's authored rules into context deterministically, narrowing by file when the resolver allows and reading whole when it does not. Without this, the load silently skips on real runs and a step never sees the brief written for it.

## Requirements

### The specify-time living-spec load is recorded deterministically, not by AI judgment

Pre-briefing at specify no longer asks the AI to decide whether the project is configured or which capabilities apply — that hand-judgment is exactly what silently skipped the load on real runs. Given the files the change will touch, a deterministic recorder script re-reads the capability registry (`living-specs.yml`, or the legacy `livingSpecs` block), gates on `enabled`, runs the resolver, and writes the matched capabilities (leaf-first) onto `livingSpecs.loaded` **plus the one-line audit breadcrumb itself** — all on `.spec-context.json`, never touching the lifecycle log. The AI then only reads `livingSpecs.loaded` back to pull those specs into context; the reading is best-effort background, the recorder is the reliable write. The recorder is a silent no-op that exits 0 when the feature is off, nothing matches, or the registry/resolver can't be read, and is skipped without failing when the interpreter is unavailable — so it never fails or slows the command.

#### Scenario: the project keeps living specs for a touched area

- **WHEN** the recorder runs with the change's in-scope files against an enabled registry that matches
- **THEN** it writes the matched capabilities leaf-first onto `livingSpecs.loaded` with the audit breadcrumb, and the AI reads those specs back from the record

#### Scenario: nothing is configured or nothing matches

- **WHEN** the recorder runs with the feature off or no capability owning the touched files
- **THEN** it is a silent no-op that exits successfully, and the breadcrumb marks "correctly did nothing" apart from a broken capture

### The load steps read a living spec by requirement, and fall back to the whole file

The specify and plan load steps SHALL ask the resolver what each capability should contribute for the files the change touches, and read only what it names. What the resolver names SHALL include each requirement's own text, not only its heading: a list of headings is a table of contents the step would then have to resolve by hand, which is the reading the narrowing exists to avoid. Where the resolver is unavailable or the call fails, they SHALL read each capability's spec whole exactly as before: the narrowing is an optimization, and it must never cost a step its brief.

#### Scenario: the resolver answers
- **WHEN** a load step runs against a capability carrying markers
- **THEN** it reads that capability's purpose and the named requirements only
- **AND** each named requirement arrives with its prose and scenarios, so no second read is needed

#### Scenario: a purpose containing a fenced example
- **WHEN** the purpose is handed to the load step
- **THEN** it arrives whole, fences included — fence-stripping decides where the section ends and must never be what the reader is given

#### Scenario: the resolver is unavailable
- **WHEN** the call fails
- **THEN** the step reads the whole spec and continues, without failing the command

### A project's authored guidance reaches the step it was written for

The specify and plan steps SHALL read their own step's rules from the registry, off the resolver call each already makes, and treat each line as guidance for how to write that step's artifact. Neither step SHALL see the other's rules, and a registry with no rules SHALL produce behaviour identical to one written before rules existed.

#### Scenario: a project authors rules for both steps
- **WHEN** a specify run loads living specs
- **THEN** it holds the spec rules and does not hold the plan rules

#### Scenario: the rules cannot be read
- **WHEN** the rules block will not parse
- **THEN** the step runs unchanged and says once that the rules were skipped

## Uncovered

_None — re-adopted from `capabilities/companion-commands/companion-commands.spec.md`; every requirement was moved verbatim from that spec, not re-read from the code._
