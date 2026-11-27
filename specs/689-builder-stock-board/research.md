# Research

**Decision**: a stock add modal of its own, styled with the `pb-modal` classes and `useModal`.
**Rationale**: `HookModal` is typed against a Companion `PipelineStep` and its choices (phases, nodes, skill catalog), none of which a stock project has; stock supports four fields only.
**Alternatives considered**: generalising `HookModal` with a stock mode, rejected because it would thread a second data shape through a 780-line component.

**Decision**: Add Companion sends a new `installCompanion` message that runs `speckit.companion.installSpecKitExtension`.
**Rationale**: that command is the one every other install surface reuses; the webview cannot run a VS Code command itself.
**Alternatives considered**: a link to the install docs, kept only as the fallback text when nothing else applies.

**Decision**: the "With Companion" copy is fixed per command, naming no counts.
**Rationale**: the stock view carries no node or phase counts, and the spec forbids drawing data the host does not send.
**Alternatives considered**: reading the shipped Companion graph for counts, rejected as a host change outside this slice.

**Decision**: no "ran" status on stock hooks.
**Rationale**: the run record is written by Companion's hooks, which a stock project does not have.
