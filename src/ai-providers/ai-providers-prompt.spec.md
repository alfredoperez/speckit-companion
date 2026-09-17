# Ai providers prompt — Living Spec

> [DRAFT] Surface-first draft from existing code. Every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

What the extension puts in front of the AI assistant: the bookkeeping preamble, the creation seed, and how the command and its argument are reshaped for the surface that shows them.

## Requirements

### Bookkeeping instructions travel separately from the user-facing command
<!-- touches: src/ai-providers/promptBuilder.ts, src/ai-providers/claudeCodeProvider.ts, src/ai-providers/ideChatProvider.ts, src/ai-providers/claudePanelProvider.ts -->

The extension prepends spec-context bookkeeping to the prompt between markers so it can be separated again. Every surface a human reads, such as a chat input, GUI panel prefill, or TUI input line, MUST show only the command. Surfaces that can carry the bookkeeping out of band SHOULD do so, and surfaces that cannot MUST drop it.

#### Scenario: dispatching to a chat the user is looking at
- **WHEN** the prompt carries a bookkeeping preamble
- **THEN** the chat input receives only the command
- **AND** the bookkeeping is either routed through a side channel the assistant still reads, or dropped

#### Scenario: a CLI that accepts a system-prompt channel
- **WHEN** the prompt carries a preamble and the CLI supports appending to its system prompt
- **THEN** the preamble is staged separately and passed through that channel, so it neither pollutes scrollback nor interferes with slash-command resolution

### The creation preamble seeds every fact the new spec's record must be born with
<!-- touches: src/ai-providers/promptBuilder.ts, src/ai-providers/promptPreamble.ts -->

The creation preamble SHALL instruct the assistant to write the run's workflow and the dispatching surface's correlation identifier into the new spec's record, because the record does not exist yet at dispatch. A seeded field SHALL be emitted only when the dispatcher supplied it.

The seeded identifier lets one spec's events be joined, since an unseeded record mints a different id later. Seeding it also marks the spec as created through a form, which tells it apart from a spec first observed on disk.

#### Scenario: the dispatching surface minted a correlation identifier
- **WHEN** the creation preamble is built for that dispatch
- **THEN** the instruction writes that identifier into the new spec's record alongside the workflow
- **AND** later events for the spec carry the same identifier, not a freshly minted one

#### Scenario: creation is dispatched with no identifier to seed
- **WHEN** the preamble is built
- **THEN** it omits the identifier field entirely instead of writing an empty one

The preamble SHALL read a step's settled status from the shared step→status map. For a project-added step outside that map, it SHALL name `implemented` so the record can still close.

#### Scenario: the dispatched step is one the project added
- **WHEN** the preamble seeds the settled status for a step outside the lifecycle set
- **THEN** it names `implemented`
- **AND** the instruction is otherwise identical to one built for a shipped step

### The dispatch preamble names the main agent as the per-task serializing writer
<!-- touches: src/ai-providers/promptPreamble.ts -->

The implement preamble SHALL instruct that the main agent journals each task, one at a time in the foreground, including fanned-out tasks, and that workers never write the shared context file. The slim companion preamble SHALL describe step closure as extension-stamped (bodies record starts, hooks and scripts record completes), reserving AI self-close for clarify/analyze.

#### Scenario: implement is dispatched with the full preamble
- **WHEN** the AI fans tasks out to workers
- **THEN** the preamble directs the main agent to journal each returned task itself, serially

#### Scenario: a companion command is dispatched
- **WHEN** the slim preamble is rendered
- **THEN** it defers step closure to the body-and-hook model and never asks the AI to self-close plan or tasks

#### Scenario: the same step is dispatched without companion installed
- **WHEN** specify, plan, or tasks is dispatched in stock mode, where no command body or hook stamps the boundary
- **THEN** the preamble instructs the AI to write that step's completion itself
- **AND** the step reaches its finished status instead of sticking at its in-flight one

### Command names are rewritten to whatever the target actually registered
<!-- touches: src/ai-providers/aiProvider.ts, src/ai-providers/ideChatProvider.ts -->

The canonical dotted command form SHALL be translated to the form the target resolves (dotted commands or dash-named skills), driven by per-target configuration and overridable by an explicit user setting. The rewrite MUST apply to the command name only, never its argument, and MUST leave non-SpecKit commands untouched. Every dispatching provider SHALL use one shared helper that performs the rewrite and adds the leading slash, so no provider sends an unresolvable name or a divergent copy of the rewrite.

#### Scenario: a namespaced command reaches a dash-form target
- **WHEN** a multi-segment SpecKit command is dispatched to a target whose commands are dash-named
- **THEN** every separator in the name becomes a hyphen, so the whole name matches the registered skill, not only its first segment
- **AND** an argument with dots of its own, such as a path to a spec document, survives unchanged

#### Scenario: a caller already formatted the command
- **WHEN** a command arrives with its leading slash, or already in the target's form
- **THEN** the result matches the bare dotted name's, so passing through the helper twice cannot mangle it

### Arguments are reshaped for the surface that will display them
<!-- touches: src/ai-providers/promptBuilder.ts, src/ai-providers/openCodeProvider.ts, src/ai-providers/claudePanelProvider.ts, src/ai-providers/ideChatProvider.ts -->

Providers SHALL reshape a path argument for their surface: inline a staged description file's contents where the target cannot open it, shorten a spec directory path to the spec's name where a human reads it, and leave free-text arguments alone. A path means nothing in a human-read chat input and is unreadable to a CLI sandboxed to the project.

#### Scenario: creating a spec from a staged description file
- **WHEN** the create flow dispatches a command whose argument is a path to a staged description outside the project
- **THEN** a chat or panel surface receives the description text inlined, with the appended bookkeeping stripped
- **AND** a project-sandboxed CLI receives the file's full contents inlined instead of the unreadable path

## Uncovered

_None. Every file in the area was read._
