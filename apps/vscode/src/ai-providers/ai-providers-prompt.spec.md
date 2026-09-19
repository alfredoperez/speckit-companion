# Ai providers prompt — Living Spec

## Purpose

What the extension puts in front of the AI assistant: the bookkeeping preamble, the creation seed, and how the command and its argument are reshaped for the surface that shows them.

## Requirements

### Bookkeeping instructions travel separately from the user-facing command
<!-- touches: src/ai-providers/promptBuilder.ts, src/ai-providers/claudeCodeProvider.ts, src/ai-providers/ideChatProvider.ts, src/ai-providers/claudePanelProvider.ts -->

The spec-context bookkeeping is prepended between markers so it can be split off again. A surface a human reads, such as a chat input, a panel prefill or a TUI input line, shows only the command; the bookkeeping goes through a side channel the assistant reads, or is dropped where none exists.

#### Scenario: dispatching to a chat the user is looking at
- **WHEN** the prompt carries a bookkeeping preamble
- **THEN** the chat input shows only the command

#### Scenario: a CLI with a system-prompt channel
- **WHEN** the prompt carries a preamble and the CLI can append to its system prompt
- **THEN** the preamble goes through that channel, out of the scrollback and away from slash-command resolution

### The creation preamble seeds every fact the new spec's record must be born with
<!-- touches: src/ai-providers/promptBuilder.ts, src/ai-providers/promptPreamble.ts -->

The record does not exist at dispatch, so the preamble tells the assistant to write the run's workflow and the dispatching surface's correlation id into it. The seeded id joins the spec's later events and marks it as created through a form rather than first seen on disk.

#### Scenario: the create form minted a correlation id
- **WHEN** the creation preamble is built for that dispatch
- **THEN** it instructs writing that id into the new record alongside the workflow

#### Scenario: creation is dispatched with no id
- **WHEN** the preamble is built
- **THEN** it omits the id field rather than writing an empty one

### A project-added step closes at implemented
<!-- touches: src/ai-providers/promptPreamble.ts -->

A step outside the lifecycle set has no settled status of its own, so the preamble names `implemented` so the record can still close.

#### Scenario: the dispatched step is one the project added
- **WHEN** the preamble seeds the settled status for it
- **THEN** it names `implemented`, and the instruction is otherwise the same as for a shipped step

### The dispatch preamble names the main agent as the per-task serializing writer
<!-- touches: src/ai-providers/promptPreamble.ts -->

#### Scenario: implement fans tasks out to workers
- **WHEN** the implement preamble is rendered
- **THEN** it tells the main agent to journal each returned task itself, one at a time in the foreground
- **AND** it says workers never write the shared context file

### A Companion dispatch leaves step closure to the command bodies and hooks
<!-- touches: src/ai-providers/promptPreamble.ts -->

#### Scenario: a companion command is dispatched
- **WHEN** the slim preamble is rendered
- **THEN** it says the extension stamps step starts and completes, and asks the AI to self-close only clarify and analyze

### A stock dispatch tells the AI to close its own step
<!-- touches: src/ai-providers/promptPreamble.ts -->

Stock spec-kit has no command body or hook to stamp the boundary, so without this a step sticks at its in-flight status.

#### Scenario: specify is dispatched without companion installed
- **WHEN** the stock preamble is rendered for specify, plan or tasks
- **THEN** it instructs the AI to write that step's completion with the context writer
- **AND** it tells the AI not to close implement, which the tasks watcher closes

### Command names are rewritten to whatever the target actually registered
<!-- touches: src/ai-providers/aiProvider.ts, src/ai-providers/ideChatProvider.ts -->

The dotted command form becomes the target's form (dotted commands or dash-named skills), set per target and overridable by a user setting. Only SpecKit command names are rewritten, never the argument, and every provider goes through the same rewrite.

#### Scenario: a namespaced command reaches a dash-form target
- **WHEN** a multi-segment SpecKit command is dispatched to a dash-named target
- **THEN** every separator in the name becomes a hyphen
- **AND** an argument with its own dots, such as a spec document path, is unchanged

#### Scenario: a caller already formatted the command
- **WHEN** a command arrives with its leading slash, or already in the target's form
- **THEN** the result is the same as for the bare dotted name

### Arguments are reshaped for the surface that will display them
<!-- touches: src/ai-providers/promptBuilder.ts, src/ai-providers/openCodeProvider.ts, src/ai-providers/claudePanelProvider.ts, src/ai-providers/ideChatProvider.ts -->

A path means nothing in a chat input and is unreadable to a CLI sandboxed to the project. Free-text arguments are left alone.

#### Scenario: creating a spec from a staged description file
- **WHEN** the create flow dispatches with a path to a description staged outside the project
- **THEN** a chat or panel receives the description text with the bookkeeping stripped
- **AND** a project-sandboxed CLI receives the file's full contents instead of the path

#### Scenario: a step runs against a spec directory in a chat
- **WHEN** the argument is the spec's directory path and the surface is human-read
- **THEN** it shows the spec's name instead of the path
