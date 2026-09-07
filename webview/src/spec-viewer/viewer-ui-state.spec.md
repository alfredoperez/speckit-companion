# Viewer UI State — Living Spec

> Adopted from existing code on 2026-07-19 and split by concern on 2026-09-07. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

This is how the webview takes in what the extension knows and never adds a fact of its own: state arrives whole, is applied whole, and one derivation answers whether anything is running. Without it two surfaces could disagree about the run, and the reader would be shown a spec that does not exist.

## Requirements

### The webview never decides the run's state — it renders the state it is given

Status, which step is running, which actions exist, and their labels MUST come from the state the extension sends. The webview SHALL NOT re-derive any of them from documents, file presence, or progress numbers. Its own local derivations are limited to presentation: which of the given facts to show, in what order, and how to word them.

#### Scenario: an action set arrives
- **WHEN** the extension sends the catalog of available actions
- **THEN** exactly those actions render, in their declared zones, with their declared scope surfaced in the tooltip
- **AND** no action is invented, suppressed, or relabelled on the basis of anything the webview computed itself

#### Scenario: a step is reported in flight
- **WHEN** the state says the current step is running
- **THEN** the forward-motion action is withheld until the step settles
- **AND** the re-run and closure actions remain available

### A state message replaces the snapshot, it never merges into it

Each state message MUST be treated as complete and applied wholesale. The webview SHALL NOT merge an incoming message onto the snapshot it already holds, and MUST tolerate a state message arriving before any content message. Merging is what allows a fresh field to sit beside a stale one and produce a combination the real spec was never in.

#### Scenario: a state update arrives before the first content
- **WHEN** a state message is the first thing the webview receives
- **THEN** it renders from that state alone
- **AND** nothing waits for a content message that may not come

Incoming messages SHALL be routed through a handler map the compiler checks for completeness, using the same dispatcher the extension side routes with, rather than a hand-written switch. A switch silently ignores a variant nobody handled; a checked map fails the build until someone does. Applying a state snapshot to the signals and to the renderer's flags SHALL likewise be one routine every variant calls, because a renderer flag left behind by one message paints the next render in a stale mode.

#### Scenario: the protocol gains a message variant
- **WHEN** the webview has no handler for it
- **THEN** the webview build fails rather than the message being dropped at runtime

#### Scenario: two variants both carry a state snapshot
- **WHEN** either arrives
- **THEN** the same routine applies it, so neither can update the signals while leaving a renderer flag stale

### One derivation decides whether a step is running

"Is this step in flight?" MUST be answered in exactly one place, and every surface that shows motion — the step's spinner, its live progress label, its elapsed timer, and the footer's forward-motion gate — MUST read that one answer. A settled spec-level status SHALL stop every one of them, even when a step's own completion record never landed. Progress numbers are labels, not run signals: a percentage below complete MUST NOT on its own be read as evidence that anything is running.

#### Scenario: a spec settles with a step's completion unrecorded
- **WHEN** the status names a settled state
- **THEN** no step spins and no elapsed timer runs
- **AND** the forward action reappears

#### Scenario: a status value that names no step
- **WHEN** the status gives no guidance
- **THEN** the answer falls back to local signals — a recorded completion settles the step, an active-step match runs it
- **AND** the step that produces no document of its own is read as running only while the workflow sits on it with work outstanding

### Status values from the record are untrusted keys

Any value that originated in the spec's record or in user configuration — a status, a step name, a document type — MUST NOT be used as a key into a plain object literal for lookups, because inherited properties resolve as truthy hits and an arbitrary value then reads as a legitimate one. Such lookups SHALL use a prototype-free structure.

#### Scenario: a record carries an unexpected status
- **WHEN** a status value that matches an inherited property name is looked up
- **THEN** the lookup misses
- **AND** the surface falls back to its neutral default rather than rendering an inherited value

### Tolerance for an old on-disk shape lives at the one conversion point

Where a spec written by an older version persisted a different shape for a field, the widened type SHALL be declared only on the function that converts it, not on the contract every consumer reads. Consumers all take the current shape; putting the legacy form in the shared type would make every reader handle a case only the converter ever sees.

#### Scenario: a spec persisted its substeps in the older keyed form
- **WHEN** the viewer reads it
- **THEN** the converter accepts that shape and emits the current one
- **AND** no consumer downstream of the converter branches on which shape it was

## Uncovered

_None recorded by the original adoption for this concern._
