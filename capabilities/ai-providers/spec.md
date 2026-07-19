# AI Providers — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

This capability is the extension's only outbound channel to an AI assistant: it turns an assembled prompt or SpecKit slash command into something a specific assistant — a terminal CLI, the host editor's built-in chat, or a GUI chat panel — will actually act on. Without it every feature that dispatches work (spec creation, plan, tasks, implement, resume) has no way to reach an agent, and each feature would have to re-learn the invocation quirks of every assistant.

## Requirements

### Every assistant is reached through a single dispatch contract

All assistants MUST be consumed through one common provider interface covering installation probing, interactive dispatch, background dispatch, slash-command dispatch, and permission-flag resolution. Callers SHALL never branch on which assistant is configured; adding an assistant MUST NOT require changes at any call site. Because some surfaces are not terminals at all, the interactive dispatch result MUST be optional rather than guaranteeing a terminal handle.

#### Scenario: A feature dispatches a step
- **WHEN** a feature needs to run a workflow step
- **THEN** it resolves the currently configured provider and calls the shared dispatch method
- **AND** it tolerates the absence of a terminal handle, because chat- and panel-backed providers return none

#### Scenario: A new assistant is added
- **WHEN** a new assistant is introduced
- **THEN** it is registered once alongside the others and implements the same contract
- **AND** no existing caller changes

### Provider choice is user configuration that never breaks activation

The active assistant MUST be selected by a persisted user setting (`speckit.aiProvider`), resolved fresh on each dispatch so a mid-session change takes effect. A value that no longer names a known assistant — a stale id left behind by a rename — MUST resolve to the default assistant rather than propagating an undefined configuration; a provider that cannot be constructed MUST likewise fall back with a logged note instead of failing the dispatch.

#### Scenario: Settings hold a retired provider id
- **WHEN** the persisted setting names an assistant the current build no longer knows
- **THEN** the extension resolves the default assistant
- **AND** activation and dispatch both proceed without an error

#### Scenario: The user has never chosen
- **WHEN** no explicit choice exists at any settings scope
- **THEN** the extension can detect that and offer a selection prompt before falling back to the default

### Per-assistant configuration is declared once and validated at load

Each assistant's environment — where its steering, agent, skill, and MCP configuration live, how it names commands, how it presents in the picker, and how it expresses auto-approval — MUST be declared as data in one registry rather than scattered across dispatch code. That registry MUST be validated when the module loads, so a malformed entry fails loudly at activation naming the offending field, instead of degrading silently at first dispatch. Validation SHALL accumulate all failures for an entry rather than reporting only the first.

#### Scenario: A registry entry is malformed
- **WHEN** an entry declares an unrecognized command-naming form, a blank display name, a flag missing its argument separator, a malformed picker icon, or a steering directory with no matching pattern
- **THEN** module load throws an error naming the assistant and every failing field
- **AND** no consumer ever observes the unvalidated form

### Prompt bodies travel out of band, not on the command line

Prompt text MUST reach a terminal CLI through a temporary file referenced by shell substitution, so the body never appears in terminal scrollback and length is not bound by argument limits. The temp files MUST be deleted after dispatch. Where a shell cannot perform that substitution, the prompt MAY be inlined with escaping, but the resulting line MUST be length-checked and MUST fail with actionable guidance rather than being truncated by the shell.

#### Scenario: A long prompt is dispatched on a substitution-capable shell
- **WHEN** the prompt is large
- **THEN** it is written to a temp file and the CLI is invoked against a substitution of that file
- **AND** the temp file is unlinked after the dispatch delay

#### Scenario: A long prompt is dispatched on a shell without substitution
- **WHEN** the inlined command line would exceed the shell's limit
- **THEN** dispatch fails with an error naming the limit and suggesting a different shell

### Bookkeeping instructions are separable from the user-facing command

A dispatched prompt MAY carry a machine-facing context-update preamble delimited by stable markers. Every provider MUST be able to split that preamble from the command, and each surface SHALL route it in the way that surface can honor: passing it as an out-of-band system instruction where the CLI supports one, carrying it as a workspace-file reference where the surface reads workspace files, or dropping it where the surface cannot act on it. The user-visible command MUST remain clean regardless.

#### Scenario: A step prompt carries a preamble
- **WHEN** the assembled prompt contains the bookkeeping block
- **THEN** the provider separates it from the command before dispatch
- **AND** the surface receives the command in its natural form, with the preamble routed or dropped per that surface's capability

### Permission posture is one setting, translated per assistant

Auto-approval MUST be expressed once by the user (`speckit.permissionMode`) and translated into whatever each assistant actually accepts, including "nothing" for assistants that manage approval in their own configuration. An assistant that cannot honor an interactive posture when driven non-interactively MUST be dispatched in its permissive form anyway, warning once per assistant rather than per dispatch, and the user SHOULD be offered a one-time prompt to align the setting with reality.

#### Scenario: Interactive mode on an assistant that cannot prompt
- **WHEN** the user has chosen interactive approval but the configured assistant cannot prompt in scripted mode
- **THEN** dispatch still uses the permissive form so the run does not stall
- **AND** the user is warned once and offered to switch the setting, with the decline remembered

### Commands are rewritten into the form the target surface resolves

The extension MUST author SpecKit commands in one canonical form and rewrite them into the naming convention the target surface actually resolves, since assistants disagree on separators. The rewrite SHALL apply only to the SpecKit command family and leave user-authored commands untouched, and a user setting MUST be able to override the per-assistant default in either direction. For an assistant with no client-side command registry, the extension MUST instead resolve the command to its underlying template body — searching both the current and the legacy on-disk layouts — substituting arguments itself, and falling back to an instructional wrapper when no template is found.

#### Scenario: A namespaced command targets a separator-style assistant
- **WHEN** a multi-segment SpecKit command is dispatched to an assistant using the alternate separator
- **THEN** every segment separator is converted, producing a name that matches the registered command
- **AND** a non-SpecKit custom command passes through unchanged

#### Scenario: The assistant has no slash-command registry
- **WHEN** a SpecKit command is dispatched to such an assistant
- **THEN** the extension locates the command's template on disk, substitutes the arguments, and sends the resulting body
- **AND** an unresolvable command degrades to an instruction naming the command rather than failing

### Path arguments are reshaped for the surface that will read them

An argument that is a filesystem path MUST be reshaped for the receiving surface. For surfaces a human reads, a spec-directory path SHALL be reduced to the spec name and a description staged in a temporary file SHALL be inlined so the reader is never shown an unopenable path. For agents sandboxed to the project directory, out-of-project staged content MUST be inlined into the prompt — including rewriting embedded asset references to in-project copies — rather than passed by a path the agent will refuse to read. Free-text and non-path arguments MUST pass through untouched.

#### Scenario: A new spec is created from staged content
- **WHEN** the create dispatch points at a staged description file outside the project
- **THEN** a human-facing surface receives the description inlined with bookkeeping stripped, and a sandboxed agent receives the full staged content inlined
- **AND** a typed free-text description is dispatched verbatim

### Non-terminal surfaces degrade visibly instead of throwing

Providers that dispatch to an editor chat or a GUI panel MUST verify a usable target before dispatching, MUST probe available integration paths at dispatch time and fall through to a clipboard-plus-open path when none exist, and MUST NOT throw on any failure. Every failure SHALL surface a user-visible message that names the alternative (switching to a terminal assistant). Where the surface cannot auto-submit, the user MUST be told what to do next. A background-execution request against such a surface MUST degrade to the interactive path and report a non-failure result. `[inferred]` The non-failure result is treated as success by callers; that contract lives outside this area.

#### Scenario: No chat target exists in the running editor
- **WHEN** none of the host's candidate chat entry points are registered
- **THEN** the dispatch reports failure internally without throwing
- **AND** the user sees a warning naming the fallback of switching to a terminal assistant

#### Scenario: The surface accepts text but cannot be submitted programmatically
- **WHEN** the target only prefills, or drops the supplied text entirely
- **THEN** the command is prefilled or copied to the clipboard and the surface is opened
- **AND** the user is told to paste and/or press Enter

### Terminal CLI providers share one dispatch skeleton

The install check, temp-file staging, command-line assembly, terminal creation, shell-readiness wait, send, and cleanup MUST live in one shared base for terminal CLIs, with concrete assistants supplying only their identity and a single hook returning the exact command line plus the files to clean up. An assistant whose interaction model does not fit — one that must be booted interactively and typed into afterwards — MUST stay outside that hierarchy rather than be forced through it. The skeleton is scoped to terminal CLIs deliberately: panel surfaces resemble it only superficially, and the resemblance is not a reason to merge them.

#### Scenario: A new terminal CLI is added
- **WHEN** the CLI takes its prompt via a flag and a file substitution
- **THEN** it declares its binary, install hint, titles, and log tag and inherits the whole dispatch flow
- **AND** it overrides a single hook only if it needs a different command line

#### Scenario: The CLI must be booted before it accepts input
- **WHEN** the assistant is a persistent interactive UI rather than a one-shot command
- **THEN** it implements the contract directly, reusing an already-running session where one exists

## Uncovered

- `src/ai-providers/promptPreamble.ts` — exported surface read (markers, step predicate, render entry points, workspace writer path); the preamble body text itself was not read
- `src/ai-providers/__tests__/` — all 13 test files unread (not part of the runtime surface)
- `src/ai-providers/.DS_Store` — binary, not readable
