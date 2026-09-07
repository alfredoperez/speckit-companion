# Prompt Shaping — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

How the assembled prompt is reshaped for the surface that receives it: bookkeeping stays out of what a human reads, command verbs take the target's registered form, and arguments are made readable where they land.

## Requirements

### Bookkeeping instructions travel separately from the user-facing command

The extension prepends spec-context bookkeeping to the prompt, delimited by markers so it can be separated again. Every surface a human reads — a chat input, a GUI panel prefill, a TUI input line — MUST show only the command, never the bookkeeping. Surfaces that can carry the bookkeeping out of band SHOULD do so; surfaces that cannot MUST drop it rather than display it.

#### Scenario: dispatching to a chat the user is looking at
- **WHEN** the prompt carries a bookkeeping preamble
- **THEN** the chat input receives only the command
- **AND** the bookkeeping is either routed through a side channel the assistant still reads, or dropped

#### Scenario: a CLI that accepts a system-prompt channel
- **WHEN** the prompt carries a preamble and the CLI supports appending to its system prompt
- **THEN** the preamble is staged separately and passed through that channel so it neither pollutes scrollback nor interferes with slash-command resolution

### Command names are rewritten to whatever the target actually registered

The canonical dotted command form SHALL be translated to the form the target assistant resolves — some tools register these commands with dots, others as dash-named skills. The translation MUST be driven by per-target configuration and MUST be overridable by an explicit user setting. It MUST apply to the command verb only, never to its argument, and MUST leave non-SpecKit commands untouched.

#### Scenario: a namespaced command reaches a dash-form target
- **WHEN** a multi-segment SpecKit command is dispatched to a target whose commands are dash-named
- **THEN** every separator in the verb becomes a hyphen so the whole name matches the registered skill
- **AND** an argument that happens to contain a dot or the word "companion" is not rewritten

### Arguments are reshaped for the surface that will display them

An argument that is a filesystem path is meaningful to a terminal agent but useless in a chat input a human reads, and unreadable to a CLI sandboxed to the project directory. Providers SHALL reshape the argument for their surface: inline a staged description file's contents where the target cannot open it, shorten a spec directory path to the spec's name where a human will read it, and leave free-text arguments alone.

#### Scenario: creating a spec from a staged description file
- **WHEN** the create flow dispatches a command whose argument is a path to a staged description outside the project
- **THEN** a chat or panel surface receives the description text inlined, with the appended bookkeeping stripped
- **AND** a project-sandboxed CLI receives the file's full contents inlined rather than the unreadable path
