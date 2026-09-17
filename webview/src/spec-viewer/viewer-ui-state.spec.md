# Viewer UI State — Living Spec

<!-- reviewed: d589a63e -->
> Adopted from existing code on 2026-07-19 and split by concern on 2026-09-07. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

How the webview takes in what the extension knows without adding facts of its own: state arrives whole, is applied whole, and one derivation says whether anything is running.

## Requirements

### The webview never decides the run's state — it renders the state it is given

Status, the running step, the available actions and their labels MUST come from the state the extension sends. The webview SHALL NOT re-derive any of them from documents, file presence or progress numbers. Its own derivations are limited to presentation: which given facts to show, in what order, and in what words.

#### Scenario: an action set arrives
- **WHEN** the extension sends the catalog of available actions
- **THEN** exactly those actions render, in their declared zones, with their declared scope in the tooltip
- **AND** no action is invented, suppressed or relabelled from anything the webview computed itself

#### Scenario: a step is reported in flight
- **WHEN** the state says the current step is running
- **THEN** the forward-motion action is withheld until the step settles
- **AND** the re-run and closure actions remain available

### A state message replaces the snapshot, it never merges into it

Each state message MUST be applied wholesale and SHALL NOT be merged onto the snapshot already held. The webview MUST tolerate a state message arriving before any content message. Merging lets a fresh field sit beside a stale one, showing a combination the spec was never in.

#### Scenario: a state update arrives before the first content
- **WHEN** a state message is the first thing the webview receives
- **THEN** it renders from that state alone
- **AND** nothing waits for a content message that may not come

Incoming messages SHALL be routed through a compiler-checked handler map, using the same dispatcher as the extension side, not a hand-written switch, so an unhandled variant fails the build. Every variant that carries a state snapshot SHALL apply it through one routine that updates both the signals and the renderer's flags, because a leftover renderer flag paints the next render in a stale mode.

#### Scenario: the protocol gains a message variant
- **WHEN** the webview has no handler for it
- **THEN** the webview build fails rather than the message being dropped at runtime

#### Scenario: two variants both carry a state snapshot
- **WHEN** either arrives
- **THEN** the same routine applies it, so neither can update the signals while leaving a renderer flag stale

### One derivation decides whether a step is running

Whether a step is in flight MUST be answered in one place, and every surface that shows motion (the step's spinner, its live progress label, its elapsed timer and the footer's forward-motion gate) MUST read that answer. A settled spec-level status SHALL stop all of them, even when a step's completion record never landed. A progress percentage below complete MUST NOT on its own be read as evidence that anything is running.

#### Scenario: a spec settles with a step's completion unrecorded
- **WHEN** the status names a settled state
- **THEN** no step spins and no elapsed timer runs
- **AND** the forward action reappears

#### Scenario: a status value that names no step
- **WHEN** the status gives no guidance
- **THEN** the answer falls back to local signals: a recorded completion settles the step, and an active-step match runs it
- **AND** the step with no document of its own reads as running only while the workflow sits on it with work outstanding

### Status values from the record are untrusted keys

A value from the spec's record or user configuration (a status, a step name, a document type) MUST NOT be used as a key into a plain object literal, because inherited properties resolve as hits. Such lookups SHALL use a prototype-free structure.

#### Scenario: a record carries an unexpected status
- **WHEN** a status value that matches an inherited property name is looked up
- **THEN** the lookup misses
- **AND** the surface falls back to its neutral default rather than rendering an inherited value

### Tolerance for an old on-disk shape lives at the one conversion point

When an older version persisted a field in a different shape, the widened type SHALL be declared only on the function that converts it, not on the contract every consumer reads. Consumers all take the current shape, so only the converter handles the legacy form.

#### Scenario: a spec persisted its substeps in the older keyed form
- **WHEN** the viewer reads it
- **THEN** the converter accepts that shape and emits the current one
- **AND** no consumer after the converter branches on which shape it was

## Uncovered

_None recorded by the original adoption for this concern._
