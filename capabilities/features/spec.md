# Features — Living Spec

> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.

## Purpose

The features layer is where every user-visible capability of the extension lives — sidebar trees, webview panels, and the commands that connect them to the AI provider and the workspace. Without a shared shape here, each feature would invent its own registration, refresh, and messaging conventions, and the extension entry point would become the only place that understands how anything works.

## Requirements

### Every feature is a self-contained folder with a single entry surface

Each capability MUST live in its own folder under the features layer and expose its public surface through a barrel module, so that consumers depend on the feature rather than on its internal file layout. A folder that has been retired MUST leave its barrel in place as an explicit empty surface rather than being silently deleted, so callers get a compile-time signal instead of a missing module.

#### Scenario: Adding a capability
- **WHEN** a new capability is introduced
- **THEN** it gets its own folder with a barrel that re-exports only what other layers may use
- **AND** internal helpers stay unexported from the barrel

#### Scenario: Retiring a capability
- **WHEN** a capability's behavior moves elsewhere
- **THEN** its folder keeps a barrel documenting where the behavior went
- **AND** no other feature imports its internals

### Features register their commands through their own registration function

A feature that contributes commands MUST expose a registration function that takes the extension context and its collaborators, register every command inside it, and push each disposable onto the context subscriptions. The extension entry point MUST NOT reach into a feature to wire individual commands itself.

#### Scenario: Activation
- **WHEN** the extension activates
- **THEN** it calls each feature's registration function once, passing the shared output channel and any managers the feature needs
- **AND** all commands the feature contributes become available together

#### Scenario: Deactivation
- **WHEN** the extension is disposed
- **THEN** every command a feature registered is disposed with it, because registration pushed onto the context subscriptions

### Command identifiers follow a stable, feature-scoped naming contract

Public command ids MUST follow the `speckit.{feature}.{action}` pattern so that menu contributions, keybindings, and cross-feature dispatch can be reasoned about without reading implementations. Because these ids are the contract with the manifest, a command that is renamed or added MUST be reflected in the manifest contributions in the same change or it becomes unreachable.

#### Scenario: New action on an existing feature
- **WHEN** a feature gains a user-invocable action
- **THEN** its id is scoped under that feature's segment
- **AND** the manifest declares it alongside any menu or view placement it needs

### Business logic lives in managers, not in command handlers or providers

Each feature MUST place its file access, parsing, and workspace mutation behind a manager-style class, and command handlers MUST stay thin adapters that translate a user action into a manager call and surface the result. This keeps behavior testable without the editor host and prevents the same logic being reimplemented per entry point.

#### Scenario: Invoking a feature action
- **WHEN** a user triggers a feature command
- **THEN** the handler delegates to the manager and reports success or failure to the user
- **AND** the manager returns a result the handler can act on rather than raising UI itself

### Tree views derive from a shared provider base that owns refresh and disposal

Sidebar views MUST extend the shared tree-data-provider base rather than implementing the editor's tree contract directly, so that change notification, loading affordances, logging, and disposal behave identically across views. A provider MUST expose a refresh entry point that callers invoke after any data change instead of mutating tree state in place.

#### Scenario: Underlying data changes
- **WHEN** a manager writes a file the view represents
- **THEN** the caller asks the provider to refresh
- **AND** the view re-queries its children rather than being patched incrementally

#### Scenario: View is torn down
- **WHEN** the extension deactivates
- **THEN** the provider disposes its change emitter and any file watchers it created

### Providers receive their collaborators after construction rather than importing them

A tree provider that needs a manager MUST accept it through an explicit setter or constructor injection from the activation path, so that a single view can aggregate several features' data without those features depending on each other. The provider MUST tolerate being asked for children before its collaborators are attached. [inferred]

#### Scenario: One view aggregates several features
- **WHEN** a view surfaces content owned by more than one manager
- **THEN** activation attaches each manager to the provider
- **AND** the provider groups the results into sections without the managers knowing about each other

### Views stay live by watching the files they represent

A feature whose view reflects on-disk state MUST register file watchers for the locations it reads and refresh on change, so the sidebar does not go stale when files are edited outside the extension. Watchers MUST be disposed with the provider.

#### Scenario: A file is edited outside the extension
- **WHEN** a watched file is created, changed, or deleted on disk
- **THEN** the owning view refreshes without any user action

### Webview panels talk to the extension only through typed, discriminated messages

A feature that owns a webview MUST define its message contract in both directions as discriminated unions and route incoming messages through a single dispatcher, so an unhandled message type is a visible gap rather than silent behavior. The extension side MUST NOT expose arbitrary capability to the webview beyond the declared message types.

#### Scenario: Webview requests an action
- **WHEN** the webview posts a message
- **THEN** the dispatcher matches its type and invokes exactly one handler
- **AND** every inbound message is logged on arrival, so an unhandled type still leaves a trace even though no handler runs

#### Scenario: Extension reports progress or failure
- **WHEN** a long-running action starts, completes, or errors
- **THEN** the extension posts a corresponding message so the webview can reflect state instead of polling

### Webview HTML is generated with a locked-down content policy

Every webview a feature creates MUST serve HTML with an explicit content security policy that restricts scripts, styles, fonts, and images to the webview's own resource origin, and MUST resolve local assets through the webview's URI mapping rather than embedding filesystem paths.

#### Scenario: Panel is opened
- **WHEN** a feature builds its panel HTML
- **THEN** the document declares a content security policy and references only mapped webview URIs
- **AND** remote script sources are not permitted

### All AI work is dispatched through the shared provider, never spawned by a feature

A feature that needs the AI assistant to act MUST build the prompt text itself and hand it to the shared AI provider for dispatch, with a human-readable label for the session. Features MUST NOT create terminals, shell out, or assume a particular assistant, because the configured provider decides how a prompt is delivered.

#### Scenario: A feature asks the assistant to do something
- **WHEN** a user triggers an action that needs the assistant
- **THEN** the feature composes the full instruction as prompt text and dispatches it through the shared provider with a descriptive title
- **AND** the feature does not depend on which assistant is configured

#### Scenario: The assistant cannot do what the feature needs
- **WHEN** the required behavior is not something the extension can perform directly
- **THEN** the instruction is embedded in the dispatched prompt rather than written into workspace AI configuration files

### The workflow model is configuration, not code branches

The pipeline a spec follows MUST be expressed as workflow configuration — an ordered set of steps with their commands and optional checkpoints — that is validated on activation and re-validated when settings change. Features MUST resolve the current step and its command through this model rather than hardcoding step order, so a workflow can gain or reorder steps without touching feature code.

#### Scenario: Workflow configuration is invalid
- **WHEN** the extension activates with a malformed workflow
- **THEN** validation reports the problem and the built-in workflows remain usable

#### Scenario: A spec advances
- **WHEN** a feature needs the command for the next step
- **THEN** it asks the workflow model to resolve it from the spec's recorded workflow
- **AND** the step order is never assumed by the caller

### A spec's chosen workflow is recorded with the spec and reused

The workflow selection for a feature directory MUST be persisted alongside the spec and reloaded on subsequent actions, and the user MUST only be prompted to choose when no selection exists and more than one workflow is selectable. A workflow that the configured AI provider cannot support MUST NOT be offered.

#### Scenario: Second action on the same spec
- **WHEN** a user triggers another step for a spec that already has a recorded workflow
- **THEN** the recorded workflow is used without re-prompting

#### Scenario: Only one workflow is available
- **WHEN** the environment makes only one workflow selectable
- **THEN** it is used silently instead of showing a picker

### Checkpoints gate step transitions and are user-approvable

A workflow step MAY declare checkpoints that run at defined transition points, and each checkpoint MUST be presented for approval before it acts and MUST report whether it completed or was skipped. Skipping a checkpoint MUST NOT block the pipeline.

#### Scenario: A checkpoint triggers
- **WHEN** a step completes and a checkpoint is configured for that transition
- **THEN** the user is asked to approve it
- **AND** declining records the checkpoint as skipped and lets the workflow continue

### The extension reconciles the companion spec-kit assets it depends on

When a feature's behavior requires companion assets to be present in the workspace, the extension MUST detect what is installed and reconcile the gap through the spec-kit tooling rather than writing those assets directly, and MUST degrade to a working fallback when the companion side is absent.

#### Scenario: Companion assets are missing
- **WHEN** a user selects behavior that needs the companion spec-kit extension and it is not installed
- **THEN** the user is told what is missing and the action falls back to the stock path instead of failing silently

## Uncovered

_None — every file in the area was read._
