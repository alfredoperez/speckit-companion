# Research: Sidebar Icon Adjustments

## Explorer scope

**Decision**: Treat the request as a change to the SpecKit explorer title bar only.

**Rationale**: The user asked for sidebar icon changes and specifically referenced removing refresh while moving create-spec to the leading right-side position. In this repository, that behavior is owned by the `contributes.menus.view/title` entries for `speckit.views.explorer` in `package.json`, which is the narrowest surface that directly controls the visible icons.

**Alternatives considered**:

- Broaden the change to every sidebar surface that exposes similar commands: rejected because the request did not mention steering or context menus.
- Remove refresh-related commands across the whole extension: rejected because the request is about icon behavior, not command availability everywhere.

## Title-bar ordering

**Decision**: Use the existing VS Code `view/title` `group` ordering as the source of truth for icon placement.

**Rationale**: The SpecKit explorer toolbar order is declarative in `package.json`. `speckit.create` already sits at `navigation@0`, while filter/sort/clear are grouped after it. This makes `package.json` the correct place to preserve create-spec as the first visible action without adding runtime ordering logic.

**Alternatives considered**:

- Reorder commands in runtime registration code: rejected because title-bar placement is not controlled there.
- Add custom UI logic in the provider: rejected because VS Code already owns title-bar rendering from contributions.

## Refresh behavior after icon removal

**Decision**: Rely on the existing automatic refresh paths for normal explorer updates and verify whether the `speckit.refresh` command should remain available without a visible toolbar icon.

**Rationale**: `specCommands.ts` already triggers `specExplorer.refresh()` from workflow commands and tree mutations, and both `specCommands.ts` and `core/fileWatchers.ts` register debounced file watchers that refresh the explorer on create/change/delete events. That means removing the manual refresh icon should not strand normal sidebar updates.

**Alternatives considered**:

- Keep the refresh icon as a fallback: rejected because it conflicts with the request to remove it.
- Remove every trace of `speckit.refresh` immediately: deferred pending implementation audit, because the toolbar request does not by itself prove the command must disappear from all contribution surfaces.

## Validation approach

**Decision**: Validate with compile, Jest, and a manual explorer smoke test in the Extension Development Host.

**Rationale**: The feature touches menu contributions and existing explorer wiring. Compile/test protect against regressions in the extension package, while a manual check is still required to confirm actual title-bar ordering and visibility in VS Code.

**Alternatives considered**:

- Rely only on manual inspection: rejected because compile/test are cheap and already supported by the repo.
- Add heavy UI automation up front: rejected because the change is small and the repo already has adequate compile/test baselines for this slice.
