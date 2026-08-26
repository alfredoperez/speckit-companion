# Feature Specification: A companion config the reader cannot handle fails loudly

**Feature Branch**: `602-loud-malformed-config`
**Created**: 2026-08-26
**Status**: Draft
**Input**: Fix #602 — a `.specify/companion.yml` written with YAML the constrained reader does not support is silently truncated instead of being reported as malformed.

## User Scenarios & Testing

### User Story 1 - A config with anchors and aliases is reported, not quietly ignored (Priority: P1)

Someone writing their project's companion config reaches for an ordinary YAML convenience — they name one block with an anchor and reuse it under another command with an alias — so their review and pull-request hooks do not have to be typed out three times. Today the pipeline runs, says nothing, and the reused hooks never fire: the config looks configured and is not. They should instead be told, in a single warning that names the offending line, that the config could not be read and the shipped defaults are in effect, so the mistake is visible the first time the command runs rather than weeks later when a step that was supposed to catch something silently was not there.

**Why this priority**: This is the reported defect and the whole reason the failure table exists. A silent partial parse is strictly worse than a hard failure, because the user is actively misled about what their pipeline does.

**Independent Test**: Write the reported config to `.specify/companion.yml`, load it, and confirm the loader returns the shipped defaults plus one warning naming the line — rather than a config missing everything from the anchor onward.

**Acceptance Scenarios**:

1. **Given** a config that names a block with an anchor and reuses it through an alias, **When** the pipeline reads the config, **Then** one warning reports the config as malformed and names the line, and the shipped defaults are used.
2. **Given** that same config, **When** the pipeline reads it, **Then** no part of the config is applied — never the half that happened to sit above the anchor.
3. **Given** a config whose anchor sits on its very last line, so nothing follows it to look wrong, **When** the pipeline reads the config, **Then** it is still reported as malformed.

### User Story 2 - Every other unreadable shape fails the same way (Priority: P1)

The anchor is one instance of a broader failure: whenever the reader meets syntax it was never built for, it stops making sense of the file but keeps going as though it had finished. Indenting with tabs, or writing a multi-line value as a YAML block scalar, both produce a config that is quietly wrong. Whichever unsupported shape someone reaches for, the outcome should be the same single, honest warning.

**Why this priority**: Fixing only the anchor leaves the same defect in place under three other spellings, and the next person to hit one gets the identical invisible failure.

**Independent Test**: Load a config indented with tabs, and one carrying a block scalar, and confirm each yields the shipped defaults plus one warning rather than a partial config.

**Acceptance Scenarios**:

1. **Given** a config indented with tab characters, **When** the pipeline reads it, **Then** it is reported as malformed and the shipped defaults are used.
2. **Given** a config whose value is written as a multi-line block scalar, **When** the pipeline reads it, **Then** it is reported as malformed and the shipped defaults are used.
3. **Given** a config carrying a document separator, **When** the pipeline reads it, **Then** it is reported as malformed — the behavior it already has.
4. **Given** a config whose overall shape leaves part of the file unread for any reason at all, **When** the pipeline reads it, **Then** it is reported as malformed rather than returning the part that happened to be understood.

### User Story 3 - Configs that work today keep working, byte for byte (Priority: P1)

Everyone who already has a companion config — including this project itself — must see no change whatsoever. The point of this work is to widen what is *reported*, never to narrow what is *accepted*.

**Why this priority**: A fix that quietly rejects a working config would cause exactly the outage it is meant to prevent, on a much larger population.

**Independent Test**: Load this repository's own companion config and confirm it still resolves the same hooks, in the same order, with no warnings.

**Acceptance Scenarios**:

1. **Given** this repository's own companion config, **When** the pipeline reads it, **Then** it parses with no warnings and resolves six hooks for the implement command and one each for specify, plan, and tasks.
2. **Given** any config that parses cleanly today, **When** the pipeline reads it, **Then** the result is identical to what it produces today.
3. **Given** a value that merely contains a character used by an unsupported shape — a shell command joining two parts, a quoted glob — **When** the pipeline reads it, **Then** it is still accepted as an ordinary value.

## Edge Cases

- An unsupported token appears inside a comment, which is discarded before the file is read — the config must still be accepted.
- An unsupported token appears inside a quoted value, where it is ordinary text — the config must still be accepted.
- The unsupported syntax is the last line of the file, so nothing is left unread to betray it.
- An empty config, or one that is only comments, stays a valid empty config.
- A config whose top level is not a mapping keeps its existing rejection.

## Requirements

### Functional Requirements

- **FR-001**: The config reader MUST reject, rather than partially accept, a file that uses YAML syntax outside the subset it supports.
- **FR-002**: A rejected config MUST surface through the existing failure table as one "malformed … using shipped defaults" warning, and the caller MUST receive the shipped defaults.
- **FR-003**: A rejection MUST name the line of the file where the unsupported syntax appears.
- **FR-004**: An anchor declaration MUST be rejected, whether or not anything follows it in the file.
- **FR-005**: An alias reference MUST be rejected.
- **FR-006**: Indentation written with tab characters MUST be rejected.
- **FR-007**: A value written as a block scalar MUST be rejected.
- **FR-008**: A file the reader does not read to the end MUST be rejected, whatever the reason — this is the general guarantee that no partially-applied config can be returned.
- **FR-009**: The reader MUST NOT reject any file it accepts today, and MUST produce an identical result for every such file.
- **FR-010**: An unsupported token that appears only inside a comment or inside a quoted value MUST NOT cause a rejection.
- **FR-011**: This project's own companion config MUST continue to parse without warnings and resolve the same hooks it resolves today.
- **FR-012**: The reported failure MUST NOT be able to fail the host command — a bad config degrades to defaults, exactly as it does today.

### Key Entities

- **Companion config** — the project's optional per-command hook and recipe file. Read at the start of every pipeline command; absent means shipped defaults, unreadable means shipped defaults plus a warning.
- **Failure table** — the documented contract mapping each config condition (absent, malformed, unknown anchor, missing node reference) to its outcome. This work moves several conditions out of "silently wrong" and into the malformed row.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The exact config reported in the issue yields one warning and zero applied settings — no configuration is partially applied.
- **SC-002**: All four unsupported shapes — anchor, alias, tab indentation, block scalar — produce the same single-warning outcome.
- **SC-003**: This project's own config resolves 6 hooks for implement and 1 each for specify, plan, and tasks, with zero warnings.
- **SC-004**: The full existing test suite passes unchanged, proving no currently-accepted config was narrowed.
- **SC-005**: Each new test fails against the current reader for the defect's own reason, proving it pins the behavior rather than describing it.

## Assumptions

- Supporting anchors properly is out of scope: a hook config gains little from reuse syntax, and the cost is a substantially larger reader.
- Rejecting the whole file is the right granularity. Applying the readable half is precisely the behavior this work removes.
- The document separator already rejects, so it needs coverage confirming that, not new detection.
- An unquoted value that begins with an anchor or alias marker is invalid in real YAML too, so rejecting it aligns this reader with every other YAML tool rather than diverging from them.

## Verbatim Constraints

- `malformed companion.yml (…); using shipped defaults` — the existing warning wording the failure table documents.
- `&name` / `*name` — the anchor and alias syntax the issue names.
- `|` / `>` — the block scalar indicators the issue names.
- `.specify/companion.yml` — the config path.

## ADDED Requirements
<!-- capability: capture-runtime -->

### A configuration the reader cannot fully read is rejected whole, never applied in part

Every configuration this runtime reads is either understood completely or not used at all. A reader that meets syntax outside the subset it supports, or that stops before the end of the file for any reason, MUST report the file as malformed and fall back to the shipped defaults — it MUST NOT return the portion it happened to understand. A partially applied configuration is worse than none, because the author reads their own file and believes all of it is live while some of it silently is not. The report SHALL name the line at fault, and, per the never-fail contract, SHALL reach the caller as a warning rather than an exception.

#### Scenario: the file uses syntax the reader does not support
- **WHEN** a configuration reaches for a YAML feature outside the supported subset
- **THEN** one warning reports the file as malformed and names the line
- **AND** the shipped defaults are used, with nothing from the file applied

#### Scenario: the reader stops before the last line
- **WHEN** parsing ends with part of the file unread, whatever the cause
- **THEN** the file is reported as malformed rather than returning what was understood so far
