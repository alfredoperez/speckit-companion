# Recover a Step That Never Ran — Living Spec

## Purpose

Pressing a step's button records the step as started before its command reaches the terminal, so the viewer can show it running at once. When the command then fails to start (a CLI that is not installed, a shell that swallowed its first keys), nothing will ever finish the step, and the viewer would sit on "Step running" with a counting timer and every action locked. This is how a dispatch that never ran is noticed and undone without lying in the run record.

## Requirements

### A command that exits non-zero before anything is recorded puts the run back
<!-- touches: apps/vscode/src/features/specs/dispatchFailure.ts, apps/vscode/src/features/specs/stepLifecycle.ts, apps/vscode/src/features/spec-viewer/messageHandlers.ts, apps/vscode/src/features/specs/specCommands.ts -->

When a step dispatched from the viewer (forward or Regenerate) or the sidebar fails to hand over its command, or its command exits non-zero within a minute of starting, while the run record still stands exactly where the dispatch's own start left it, the extension SHALL return `status` and `currentStep` to where they stood before the dispatch. A zero exit, a later exit, an exit after anything was recorded, and a command typed without shell integration SHALL change nothing, because an interactive assistant that quits with an error after working has run.

#### Scenario: the CLI never starts
- **WHEN** Plan is pressed on a `specified` spec and the terminal reports `command not found` with exit code 127
- **THEN** the spec is back on specify at `specified`, and the footer offers Plan again

#### Scenario: the assistant ran, then failed
- **WHEN** the step recorded a substep before the CLI exited non-zero
- **THEN** the record is left as it is

#### Scenario: the assistant is quit with Ctrl+C an hour in
- **WHEN** the session exits 130 long after it started and nothing was recorded
- **THEN** the step stays as it is

#### Scenario: a re-run that fails
- **WHEN** Regenerate on a `planned` spec dispatches plan and the command exits non-zero
- **THEN** the spec returns to `planned` with its history unchanged

### Putting the run back never rewrites history or invents a completion
<!-- touches: apps/vscode/src/features/specs/stepLifecycle.ts, apps/vscode/src/features/specs/terminalStepTracker.ts -->

The dispatch's start entry SHALL stay, since history only grows. When the dispatch had moved the run off a step whose status was already settled, that step's completion SHALL be recorded again after the stray start, which makes the abandoned attempt read as not started and its forward button reachable. No completion SHALL be written for the step that failed, and its terminal SHALL stop counting as the step's, so closing it records nothing.

#### Scenario: the failed terminal is closed afterwards
- **WHEN** the user closes the sidebar's terminal for a plan dispatch that failed
- **THEN** no plan completion is written

#### Scenario: reading the record after a failed Plan
- **WHEN** the record is read after the failure
- **THEN** it holds the plan start followed by a specify completion, and no plan completion

### The user is told plainly which step did not run and where to look
<!-- touches: apps/vscode/src/features/specs/dispatchFailure.ts -->

A dispatch put back this way SHALL raise one error naming the step, the terminal it was sent to and the exit code, with a **Show Terminal** action that brings that terminal forward, so the user can read what the shell printed.

#### Scenario: Plan dispatched to Claude Code fails
- **WHEN** the plan command exits with 127 in the "SpecKit - Claude Code" terminal
- **THEN** the error reads that Plan did not run, names that terminal and code 127, and offers Show Terminal

## Uncovered

- A retried step reuses the failed attempt's start, because a step is started once, so its timer and duration count from the first attempt.
- A project-added step that never ran keeps its stray start, which the history derivation reads as a zero-length finished span because it is not ranked against the built-in order.
- Without shell integration no exit code is available, and a dispatch that never ran still reads as running until the user sets the status.
