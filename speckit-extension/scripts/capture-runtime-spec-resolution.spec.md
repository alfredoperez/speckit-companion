# Spec Resolution — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Finding which spec and which configuration a call belongs to: pointer resolution, precedence, project boundaries, workflow-family dispatch, and the all-or-nothing reading of registries and configuration.

## Requirements

### An unresolvable pointer is named, not passed over

Resolution is best-effort and MUST NOT raise, but failing in silence is how a stale or misspelled pointer becomes an audit of the wrong spec — or of nothing at all — that still reports clean. Where the active-spec pointer exists and cannot be used, the runtime SHALL say which file, and whether it is stale or carries no key it recognises, then continue trying the remaining ways of finding the spec rather than stopping.

#### Scenario: the pointer names a directory that is gone
- **WHEN** the recorded active spec no longer exists
- **THEN** the run says the pointer is stale, names the file, and still resolves by other means where it can

#### Scenario: the pointer carries an unrecognised key
- **WHEN** the pointer file parses but holds no key the resolver reads
- **THEN** the run names the file, the keys that would have worked, and what it actually found

### The spec a write lands on is resolved by a fixed precedence, and a conflict refuses rather than guesses

Several signals can name the active spec, and they can disagree — especially when a later spec is "active" while an earlier one is being settled. The runtime SHALL apply one documented precedence, and where a caller supplies a signal that is authoritative for the operation (the task list being synced names its own spec), that signal MUST override the ambient pointers. When two explicit signals conflict, the writer MUST refuse to write and name the mismatch, rather than silently picking one and settling the wrong spec.

#### Scenario: two explicit signals disagree
- **WHEN** an explicit spec directory and an explicit task list point at different specs
- **THEN** nothing is written and the mismatch is reported

#### Scenario: an older spec settles while a newer one is active
- **WHEN** a task list belonging to an earlier spec is synced
- **THEN** the earlier spec settles, regardless of which spec the ambient pointers name

### Living-spec path resolution stops at a nested project boundary

A directory carrying its own companion config is a separate project. Discovery SHALL stop there and never report, claim, or promote anything inside it — otherwise a sample or vendored project nested in the tree gets its specs attributed to the parent. Resolution is the single source of these rules; the sync, fold, drift, and coverage tools call it rather than re-interpreting the configuration themselves.

#### Scenario: a sample project is nested in the tree
- **WHEN** discovery walks into a directory holding its own companion config
- **THEN** the walk stops and nothing inside is reported as the parent's

### Status resolution dispatches commands from the family the spec has been running

A spec's context records which workflow drives it, and every next-step command that status and resume resolution emit MUST come from that workflow's command family: the companion commands when the context records `workflow: companion`, the stock commands otherwise. Handing a run a command from the other family mid-pipeline would silently switch its capture and completion behavior, so the recorded workflow is the single signal for the choice. Contexts written before the workflow field existed carried a retired marker instead (`profile: turbo`); resolution SHALL keep honoring that marker as meaning the companion workflow, so older specs resume on the flow they started rather than being demoted to the stock family.

#### Scenario: a companion spec resumes
- **WHEN** resolution computes the next command for a context recording the companion workflow
- **THEN** the command is drawn from the companion family

#### Scenario: an older context carries only the retired marker
- **WHEN** a context predating the workflow field records the retired companion marker
- **THEN** resolution still selects the companion family

#### Scenario: no workflow is recorded
- **WHEN** a context names neither the workflow nor the retired marker
- **THEN** resolution emits the stock command family

### A reader of a captured list MUST accept every form its writer stores

Capture writes decisions, verifications, and concerns as entries carrying an identity value plus supporting detail, while hand-authored and pre-coercion contexts carry bare strings for the same fields. Any reader of one of these lists SHALL accept both forms — a non-empty string reads as itself, an entry reads through its identity value, and its supporting detail stays reachable rather than being discarded at the boundary. A reader that recognizes only one form silently drops everything real runs record while continuing to pass on hand-authored fixtures, so its emptiness reads as a fact about the run rather than a defect in the reader. An entry with no usable identity value SHALL be skipped on its own, never taking the rest of the list with it. Widening such a reader MUST NOT change the shape of what it emits — only which entries reach it — because the machine-readable resolution other commands parse is part of that shape. Lists whose writer stores plain strings only are exempt: their readers are correct by construction, and a widened branch there would be unreachable.

#### Scenario: a real run's decisions are read back
- **WHEN** status resolves a spec whose decisions were recorded by the pipeline
- **THEN** every decision appears, in the order it was recorded
- **AND** hand-authored string decisions in the same list appear unchanged alongside them

#### Scenario: one entry in the list is unusable
- **WHEN** a captured list carries an entry with no identity value among well-formed ones
- **THEN** that entry is skipped and the remaining entries are still read
- **AND** the command still exits successfully

### A configuration the reader cannot fully read is rejected whole, never applied in part

Every configuration this runtime reads is either understood completely or not used at all. A reader that meets syntax outside the subset it supports, or that stops before the end of the file for any reason, MUST report the file as malformed and fall back to the shipped defaults — it MUST NOT return the portion it happened to understand. A partially applied configuration is worse than none, because the author reads their own file and believes all of it is live while some of it silently is not. The report SHALL name the line at fault, and, per the never-fail contract, SHALL reach the caller as a warning rather than an exception.

#### Scenario: the file uses syntax the reader does not support
- **WHEN** a configuration reaches for a YAML feature outside the supported subset
- **THEN** one warning reports the file as malformed and names the line
- **AND** the shipped defaults are used, with nothing from the file applied

#### Scenario: the reader stops before the last line
- **WHEN** parsing ends with part of the file unread, whatever the cause
- **THEN** the file is reported as malformed rather than returning what was understood so far

### The registry carries per-step guidance, normalized to one shape

The registry reader SHALL normalize an optional `rules` block to a list per known pipeline step, always present and empty when unset, dropping an unknown step key or an unusable value with a warning rather than raising. `rules` SHALL be a key the registry owns, so re-emitting the registry preserves it.

#### Scenario: a capability is added to a registry that carries rules
- **WHEN** the registry is rewritten to record the new capability
- **THEN** the authored rules are still in the file afterwards

#### Scenario: a step key nobody recognizes
- **WHEN** the block names a step that takes no rules
- **THEN** that key is dropped with a warning and every other step's rules are unaffected

## Uncovered

- `register-capability.py` — read only its contract docstring.
- `companion_config.py` — read its contract docstring and failure table, not its YAML reader.
- `status-context.py` — read its docstring and function list, not its resolution logic.
