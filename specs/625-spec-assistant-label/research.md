# Research: Assistant name and Show terminal on a spec

## Where the assistant is recorded

**Decision**: Store the provider id in a new optional `assistant` field on `.spec-context.json`, written at the dispatch seam after the provider's run resolves.

**Rationale**: The id is stable and is re-resolved on read, so the file never supplies display text. Writing after the run means a dispatch that throws records nothing. The write copies the telemetry-id backfill: guarded on an existing context, one key, fire-and-forget, failure swallowed. It appends no history.

**Alternatives considered**: Memory only (the name would vanish on reload). Storing the display name (lets the file put arbitrary text in the UI, and the IDE Chat name depends on the host editor).

## Which dispatches count

**Decision**: The two paths through `dispatchStep` (sidebar workflow steps, viewer Approve) plus the sidebar's clarify, analyze and checklist path.

**Rationale**: Those are the spec-scoped step dispatches. Create Spec and Auto have no spec folder when they dispatch, so they record nothing; the next step run from Companion does.

**Alternatives considered**: Recording later from the file watcher when a new spec folder appears. It would have to guess which dispatch created the folder.

## One name, two surfaces

**Decision**: `resolveSpecAssistant(context)` coerces the stored value through `coerceProviderType`, an allow-list over `AIProviders`, then calls `getProviderDisplayName`. The sidebar row calls it; the viewer receives the resolved string in `navState`.

**Rationale**: The webview cannot re-derive the name, so the two cannot drift. A `find` over the id list never touches an object's prototype keys.

**Alternatives considered**: The `in PROVIDER_PATHS` check that the settings reader uses. `'constructor' in PROVIDER_PATHS` is true.

## The spec's terminal

**Decision**: A separate registry, `specTerminals`, keyed by the resolved spec directory, holding the newest terminal. It listens for terminal close, forgets the entry and fires a change callback that refreshes the sidebar and open viewers.

**Rationale**: `terminalStepTracker` completes the step when its terminal closes, and is skipped for steps that do not record a start. Sharing it would either write lifecycle on close or miss terminals. Each dispatch creates a new terminal, so "newest" is the last one remembered.

**Alternatives considered**: Adding a reverse lookup to `terminalStepTracker`.

## Offering Show terminal per row

**Decision**: A spec row with a live terminal carries its lifecycle `contextValue` plus a `+terminal` suffix, and every spec-row `when` clause tolerates the suffix.

**Rationale**: A tree row's menu can only be gated per row through `viewItem`. The clauses are pinned by `manifest.test.ts`, so a missed one fails the build.

**Alternatives considered**: A global "some spec has a terminal" key (offers the action on rows that have none). A selection key (right-click does not select).

## Viewer panels

**Decision**: Feature spec panels only. Living and bug panels show neither the label nor the button.

**Rationale**: Those panels are not dispatched as pipeline steps, and their refresh path already skips them.
