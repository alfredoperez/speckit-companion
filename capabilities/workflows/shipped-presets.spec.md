# Shipped Presets and Routing — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

The workflow files the spec-kit extension ships: named presets a user starts from, and the routing switches inside the Companion pipeline definition.

## Requirements

### Shipped presets are starting points, not fixed shapes

The extension SHALL ship named presets a user can start a new workflow from, each declaring only what it changes — the node list and phase grouping for a command, or the template sections a command emits — and each carrying a plain-language summary of who it is for. A preset SHALL be editable afterwards, node by node and section by section; picking one MUST NOT lock any of its choices.

#### Scenario: a new workflow is created from a preset
- **WHEN** the user picks a preset in the pipeline panel
- **THEN** the new workflow starts from that preset's nodes, phases, and template sections
- **AND** every one of them can still be changed afterwards

### A routing switch matches the verdict the classifier actually emits

Any branch keyed on a classifier's output SHALL use the vocabulary that classifier emits, not the vocabulary of the threshold it is named after. A key that names the bar rather than the verdict matches nothing, and the failure is silent: every run simply takes the default branch, so a fast path can appear to exist while never once being entered.

#### Scenario: a small change is classified
- **WHEN** the classifier returns its simple-size verdict
- **THEN** the workflow's switch matches that branch and runs the folded path
- **AND** the folded path still runs plan and tasks, without their review-gate pauses — fewer stops, not fewer artifacts
