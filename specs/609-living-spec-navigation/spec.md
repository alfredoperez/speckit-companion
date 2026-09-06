# Feature Specification: Reach one requirement, from anywhere

**Feature**: Wave 3 of living specs by requirement ([#672](https://github.com/alfredoperez/speckit-companion/issues/672)) — "adopt from the best"
**Created**: 2026-09-06
**Status**: Specifying

## Context

Waves 1 and 2 shipped. A living spec already carries file markers on its requirements, a run already loads only the requirements a change touches, the viewer already draws a requirement outline, and a shape check already refuses to fold a broken delta. What is missing is reach: everything that knows about a single requirement lives inside a command body or inside the viewer. A person in a terminal still opens a 500-line file to read one rule. Guidance about how to write a spec still gets retyped into chat on every run. And someone editing a source file has no way to ask which durable rules describe the file in front of them.

This wave closes those three gaps and adds one paragraph of documentation so a spec-kit user is not misled by the phrase "living spec".

## User Scenarios & Testing

### User Story 1 - Read one requirement without opening the file (Priority: P1)

Someone working in a terminal — or a command body composing its own context — wants to see one rule, or the list of rules, from a capability's durable spec. Today the only options are opening a file that runs to hundreds of lines or scrolling a viewer. They ask for the slice they want and get exactly that printed back: the headings of one capability, one named requirement in full, or the requirements that describe one source file.

**Why this priority**: It is the terminal twin of the selective load that already exists, it needs no editor, and every other item in this wave is easier to trust once a person can read the same slice a run reads.

**Independent Test**: With living specs configured, ask for the headings of one capability and get its requirement titles; ask for one of those titles and get that requirement and its scenarios; ask for a source file and get only the requirements whose markers claim it.

**Acceptance Scenarios**:

1. **Given** a capability whose spec carries several requirements, **When** a reader asks for that capability's headings, **Then** every requirement heading is printed in file order and nothing else is.
2. **Given** a requirement heading that exists, **When** a reader asks for that requirement by name, **Then** the requirement's full body and its scenarios are printed, and no other requirement is.
3. **Given** a requirement name that matches nothing, **When** a reader asks for it, **Then** the reader is told it was not found and is shown the headings that do exist, and the command still exits successfully.
4. **Given** a source file claimed by two capabilities, **When** a reader asks which requirements describe that file, **Then** the requirements from both capabilities are printed, grouped by capability, most-specific capability first.
5. **Given** a spec whose requirements carry no file markers, **When** a reader asks which requirements describe a file that capability claims, **Then** every requirement is returned, because an unmarked requirement describes the whole capability.
6. **Given** living specs are disabled or not configured, **When** the reader runs the command, **Then** it says so in one line, prints nothing else, and exits successfully.

---

### User Story 2 - Write the house rule once, not in every chat (Priority: P1)

A team has conventions for how its specs and plans should read — "scenarios are WHEN/THEN with one outcome", "name the file a rule describes". Today those sentences are retyped into a chat window on every run, so they are applied unevenly and are invisible to anyone reading the repository. The team writes them once in the living specs registry, and from then on every specify run sees the spec rules and every plan run sees the plan rules.

**Why this priority**: It is the smallest change in the wave and it removes a repeated manual step from every single run.

**Independent Test**: Add a rules block with one spec rule and one plan rule, run specify, and confirm the spec rule reached the step and the plan rule did not; then run plan and confirm the reverse.

**Acceptance Scenarios**:

1. **Given** a registry carrying rules for the spec step, **When** a specify run loads living specs, **Then** those rules are present in the step's context and are attributed to the registry.
2. **Given** the same registry, **When** a plan run loads living specs, **Then** the plan rules are present and the spec rules are not.
3. **Given** a registry with no rules block, **When** any step runs, **Then** it behaves exactly as it does today and says nothing about rules.
4. **Given** a rules block written in a form the registry reader cannot parse, **When** a step runs, **Then** the run continues normally, the rules are skipped, and one short line names the problem.
5. **Given** rules are defined, **When** a run records what it worked from, **Then** the rules that applied are recorded alongside the capabilities that loaded.

---

### User Story 3 - See which rules describe the file you are editing (Priority: P2)

A developer opens a source file. Somewhere in the repository, one or more durable specs claim that file, and some of their requirements describe it specifically. Today nothing in the editor says so, and finding out means reading the registry by hand. Instead, the editor shows a small count for the open file, and one click lists the capabilities that claim it and the requirements that describe it; picking one opens that requirement.

**Why this priority**: It makes the durable specs discoverable from the code rather than only from the specs view, but the two P1 stories deliver value without it.

**Independent Test**: Open a file inside a capability's match globs and confirm the count appears; click it, pick a requirement, and confirm the viewer opens on that requirement.

**Acceptance Scenarios**:

1. **Given** a source file claimed by two capabilities, **When** the file is the active editor, **Then** the editor shows that two living specs claim it.
2. **Given** that indicator, **When** it is clicked, **Then** a picker lists the claiming capabilities and, under them, the requirements whose markers match this file.
3. **Given** the picker, **When** a requirement is picked, **Then** that capability's spec opens with that requirement in view.
4. **Given** a file no capability claims, or a file the registry exempts, **When** it becomes the active editor, **Then** no indicator is shown.
5. **Given** living specs are disabled, **When** any file is opened, **Then** no indicator is ever shown.
6. **Given** the active editor changes between two files with different claims, **When** the switch happens, **Then** the indicator reflects the newly active file.

---

### User Story 4 - Know which "living spec" is meant (Priority: P3)

A reader arriving from spec-kit's own documentation has already met the phrase "living spec" with a different meaning: keep editing a feature's spec and regenerate the plan and tasks underneath it. Our meaning is a durable spec per capability that feature deltas fold into. Reading our docs with the upstream meaning in mind produces a quiet, lasting misunderstanding of the whole feature.

**Why this priority**: Documentation only; nothing breaks without it, but it costs one paragraph.

**Independent Test**: Read the living specs reference cold and confirm the two meanings are named and separated before any mechanism is described.

**Acceptance Scenarios**:

1. **Given** the living specs reference, **When** a reader reaches the introduction, **Then** both meanings of the phrase are stated and ours is identified.

## Edge Cases

- A capability registered with no spec file on disk: the slice reader names it as having no spec rather than reporting zero requirements.
- A requirement name given with different casing or surrounding whitespace: matched case-insensitively on trimmed text, and an ambiguous match lists the candidates instead of guessing.
- A requirement heading that appears inside a fenced code block: never counted, in every reader, so the terminal slice, the viewer outline and the coverage denominator stay equal.
- A file marker whose glob matches nothing: the slice reader still returns the requirement when asked for it by name; only the shape check complains.
- A rules block containing an empty list, or a step key nobody recognizes: ignored without failing the run.
- A very long requirement body: printed whole; truncation would make the output untrustworthy for the command bodies that consume it.
- A source file outside the workspace, or an untitled editor buffer: no indicator, no error.
- The registry changes while the editor is open: the indicator recomputes on the next editor change rather than holding a stale count.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST provide a read-only command that prints one capability's requirement headings.
- **FR-002**: The command MUST print a single named requirement in full, including its scenarios, when asked for it by name.
- **FR-003**: The command MUST print the requirements that describe a given source file, grouped by capability, ordered most-specific capability first.
- **FR-004**: A requirement carrying no file marker MUST be treated as describing every file its capability claims, so a partly-marked spec never returns an empty slice.
- **FR-005**: The command MUST identify requirements using the same heading rules as the existing requirement-id reader and the resolver, with fenced code blocks ignored by all of them.
- **FR-006**: The command MUST exit successfully in every case, including no configuration, a disabled feature, a missing spec file, and a name that matches nothing.
- **FR-007**: A name that matches nothing MUST be answered with the headings that do exist.
- **FR-008**: The registry MUST accept an optional rules block carrying separate one-line guidance lists for the spec step and the plan step.
- **FR-009**: The spec step MUST receive only the spec rules and the plan step MUST receive only the plan rules.
- **FR-010**: A registry with no rules block MUST produce behaviour identical to today's, with no mention of rules anywhere.
- **FR-011**: A rules block the registry reader cannot parse MUST be skipped with one short line, never failing the step.
- **FR-012**: The rules that applied to a run MUST be recorded alongside the capabilities that loaded, so a reader can tell what guidance the run was given.
- **FR-013**: The editor MUST show, for the active source file, how many living specs claim it, and MUST hide the indicator when the count is zero or the feature is off.
- **FR-014**: Clicking the indicator MUST list the claiming capabilities and the requirements whose markers match the active file.
- **FR-015**: Picking a listed requirement MUST open that capability's spec positioned on that requirement.
- **FR-016**: The indicator MUST be computed in the editor's own process from the registry and the file path, with no command dispatch.
- **FR-017**: The indicator MUST refresh when the active editor changes.
- **FR-018**: The living specs reference MUST distinguish our meaning of "living spec" from spec-kit's own use of the phrase.
- **FR-019**: Specs that adopt neither markers nor rules MUST keep working unchanged across fold-back, drift, sync, coverage and adoption.

## Key Entities

- **Requirement slice**: one requirement of a living spec — its heading, its body including scenarios, and the file patterns its marker names, if any. Already the unit Wave 1 introduced; this wave only gives it more readers.
- **Rules block**: registry-level guidance, a list of one-line sentences per pipeline step. Applies to every capability in the project, not to one capability.
- **File claim**: the relationship between a source file and a capability, decided by the capability's match globs and the registry's exemptions. A file may be claimed by several capabilities.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A reader can print one requirement of any capability in a single command, reading fewer than 40 lines instead of opening a file of several hundred.
- **SC-002**: The requirement count printed for a capability equals the count the viewer outline draws and the count the coverage denominator uses, for every capability in the project.
- **SC-003**: A house rule written once in the registry appears in 100% of subsequent spec or plan runs, with no one retyping it.
- **SC-004**: Opening a claimed source file surfaces its living specs within one editor interaction, and reaching the requirement that describes it takes at most two clicks.
- **SC-005**: Every command and editor path added by this wave exits or degrades without error when living specs are disabled, unconfigured, or partly configured.
- **SC-006**: A project that adopts none of this wave produces byte-identical results from fold-back, drift, sync and coverage.

## Assumptions

- The rules block lives in the living specs registry rather than in a new file, because that registry is already the one place a project describes its durable specs.
- Rules apply project-wide. Per-capability rules would need a resolution order nobody asked for yet; the registry-level block is the smaller thing that covers the stated need.
- Only the spec and plan steps take rules in this wave. Other steps can be added later without changing the shape.
- The terminal slice reader is a companion command backed by a script, matching every other member of the living-spec command family, and reuses the existing resolver rather than parsing specs a second time.
- The editor indicator lives in the status bar, which is where a passive per-file fact belongs, and stays silent rather than showing a zero.
- Item 11 of the issue, the guided first change, is a separate track and is not in this wave.
- Item 7 of the issue, splitting the four large specs, is a measurement follow-up rather than code, and is not in this wave.
- Whether `/speckit.converge` ships in the pinned spec-kit version is a question the docs task answers; the answer is recorded, and any overlap with the doctor command is noted rather than acted on here.

## Verbatim Constraints

- Registry key for the guidance block: `rules:`, with the step keys `spec:` and `plan:`.
- Requirement marker comment, unchanged from Wave 1: `<!-- touches: … -->`
- Command flags: `--headings`, `--requirement "name"`, `--file <path>`
- The resolver and model functions the slice reader must agree with: `requirementIds()` in `src/features/specs/livingSpecsModel.ts`, and `requirement_slices` in `speckit-extension/scripts/resolve-spec-paths.py`

## ADDED Requirements
<!-- capability: companion-commands -->

### A living spec is readable one slice at a time, from a terminal

A command SHALL print a capability's requirement headings, one named requirement with its scenarios, or the requirements whose file markers describe a given path, using the same requirement parser the load steps use. It SHALL be read-only, and every outcome — including an unregistered capability, a missing spec file, a name matching nothing, an ambiguous name, and a file nothing claims — SHALL exit successfully with the alternatives named.

#### Scenario: a reader asks for one requirement
- **WHEN** the command is given a requirement heading that exists in exactly one capability
- **THEN** that requirement's prose and scenarios are printed and no other requirement is

#### Scenario: a heading names two capabilities
- **WHEN** the requested heading exists in more than one registered capability
- **THEN** every candidate is listed with its capability and none is chosen

#### Scenario: living specs are off
- **WHEN** the command runs in a project with no registry, or one that is disabled
- **THEN** it reports nothing and exits successfully

### A project's authored guidance reaches the step it was written for

The specify and plan steps SHALL read their own step's rules from the registry, off the resolver call each already makes, and treat each line as guidance for how to write that step's artifact. Neither step SHALL see the other's rules, and a registry with no rules SHALL produce behaviour identical to one written before rules existed.

#### Scenario: a project authors rules for both steps
- **WHEN** a specify run loads living specs
- **THEN** it holds the spec rules and does not hold the plan rules

#### Scenario: the rules cannot be read
- **WHEN** the rules block will not parse
- **THEN** the step runs unchanged and says once that the rules were skipped

## ADDED Requirements
<!-- capability: capture-runtime -->

### The registry carries per-step guidance, normalized to one shape

The registry reader SHALL normalize an optional `rules` block to a list per known pipeline step, always present and empty when unset, dropping an unknown step key or an unusable value with a warning rather than raising. `rules` SHALL be a key the registry owns, so re-emitting the registry preserves it.

#### Scenario: a capability is added to a registry that carries rules
- **WHEN** the registry is rewritten to record the new capability
- **THEN** the authored rules are still in the file afterwards

#### Scenario: a step key nobody recognizes
- **WHEN** the block names a step that takes no rules
- **THEN** that key is dropped with a warning and every other step's rules are unaffected

### The resolver answers for one capability, one requirement, or one file

The resolver SHALL expose the slice a caller asks for — a capability's headings, one requirement in full, or the requirements matching a file — from the same slicing that serves the load steps, so the count it reports equals the coverage denominator and the viewer's outline. A requirement carrying no marker SHALL be returned for every file its capability claims.

#### Scenario: a capability is registered but its spec file is gone
- **WHEN** the resolver is asked for that capability's headings
- **THEN** it reports that there is no spec on disk, never a spec with zero requirements

## ADDED Requirements
<!-- capability: specs -->

### A source file reports the living specs that claim it, in the editor's own process

The extension SHALL resolve, for a workspace-relative path, the capabilities whose membership globs claim it — most-specific first, honouring exclusions and the registry's exempt list — and the requirements of each whose marker matches that path. The resolution SHALL happen in the extension process, never by dispatching a command, and SHALL order capabilities by the same specificity rule the resolver uses.

#### Scenario: two capabilities claim one file
- **WHEN** the claims for that file are resolved
- **THEN** the more specific capability is first

#### Scenario: the file is exempt
- **WHEN** the path matches the registry's exempt globs
- **THEN** no capability claims it

#### Scenario: a claiming capability has no spec file
- **WHEN** its claims are resolved
- **THEN** the capability still appears with no requirements, so the claim is not lost

### The status bar names the living specs for the active file and reaches one requirement

A status bar item SHALL show how many living specs claim the active editor's file, hidden when the count is zero, when living specs are off, and when the editor holds no workspace file. Activating it SHALL list the claiming capabilities with their matching requirements, and choosing one SHALL open that capability's spec positioned on that requirement.

#### Scenario: the active editor changes to an unclaimed file
- **WHEN** the indicator refreshes
- **THEN** it is hidden rather than showing a zero

## ADDED Requirements
<!-- capability: spec-viewer -->

### Opening a spec can name the requirement to bring into view

The viewer's open command SHALL accept an optional requirement heading and, once the spec renders, bring the matching requirement into view. A heading matching nothing SHALL leave the document where it is rather than failing the open.

#### Scenario: a requirement heading that does not exist
- **WHEN** the spec is opened with it
- **THEN** the spec still opens and no error is shown

## ADDED Requirements
<!-- capability: viewer-ui -->

### The viewer can be told which requirement to bring into view

The viewer SHALL accept a requirement heading from the extension and scroll the matching requirement into view, honouring the reader's reduced-motion preference. A heading matching no rendered requirement SHALL leave the scroll position untouched.

#### Scenario: the named requirement is on the page
- **WHEN** the viewer is told to reveal it
- **THEN** that requirement is scrolled into view

#### Scenario: the heading matches nothing rendered
- **WHEN** the viewer is told to reveal it
- **THEN** the document stays where the reader left it
