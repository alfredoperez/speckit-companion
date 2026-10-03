# Research: Find the Spec Kit project in a multi-root workspace

## What marks a folder as the project

**Decision**: A Spec Kit marker (`.specify`, or one of the two `.github/agents/speckit.*.agent.md` files), then a literal `specs` directory, then the first folder. The detector calls the same marker function.

**Rationale**: The detector already treats the agent files as "initialized". Two different probes would let the sidebar and the welcome view disagree about the same folder.

**Alternatives considered**: Probing every `speckit.specDirectories` pattern. Globs are not cheap to test per folder, and the default list already contains `specs`.

## Caching

**Decision**: None. A one-folder workspace returns its folder with no disk read. With several folders each call stats one or two paths per folder.

**Rationale**: Nine test suites reassign the workspace folders between tests with no change event, and `specify init` creates the marker without telling the extension. A cache would be wrong in both cases.

**Alternatives considered**: A cache cleared by the change watcher.

## Probe errors

**Decision**: Only "not found" counts as no marker. Any other error skips that folder for this resolve and is logged once.

**Rationale**: An unreadable folder must not be mistaken for an empty one.

## The setting's scope

**Decision**: `window`, read with no resource.

**Rationale**: The choice is about the whole window, and reading it with the project root as the resource would be circular. A consistency test already requires every setting to be window or machine scoped.

**Alternatives considered**: `resource` scope, so each folder could opt in.

## Reacting to change

**Decision**: One watcher listens for workspace-folder and setting changes, logs the pick, and fires `onDidChangeProjectRoot` only when the resolved root differs. The extension's handler refreshes the three tree views and open viewer panels, re-runs detection, re-runs `wireCompanionSurfaces` and asks the steering view to rebuild its project watchers.

**Rationale**: `wireCompanionSurfaces` is already torn down and rebuilt on a folder change; this makes it follow the setting too.

## What stays window-wide

**Decision**: The spec file watchers keep their window-wide globs.

**Rationale**: They only trigger refreshes, and the views now read from the project root, so an event from another folder redraws the same list. Scoping them needs teardown plumbing they do not have.

## Specs that carry their own folder

**Decision**: `workflowSelector` and `pipelineResolution` keep resolving from the spec's own workspace folder first.

**Rationale**: That behaviour is pinned by tests and is correct for a spec opened from another folder. Only the fallback changes.
