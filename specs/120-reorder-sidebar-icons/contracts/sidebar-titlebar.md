# Contract: SpecKit Explorer Title Bar

## Scope

This contract defines the expected user-visible behavior of the SpecKit explorer title bar for the sidebar icon adjustment feature.

## Explorer toolbar contract

### View

- Applies only to `speckit.views.explorer`

### Required actions

1. `speckit.create` is visible in normal explorer states and is the first visible right-side action.
2. `speckit.specs.filter` remains available after create.
3. `speckit.specs.filter.clear` appears only while a filter is active.
4. `speckit.specs.sort` remains available.
5. Collapse/expand all remains available through the existing toggle entries.

### Removed action

1. The explorer title bar does not display `speckit.refresh`.

## Behavioral guarantees

1. Triggering `speckit.create` from the title bar opens the existing create-spec flow.
2. Routine explorer updates continue through existing automatic refresh paths.
3. Removing the refresh icon does not change the lifecycle grouping, filtering, sorting, or collapse behavior of the explorer.

## Non-goals

1. No changes to steering view toolbar actions.
2. No changes to spec context menus or viewer footer actions.
3. No changes to the create-spec command semantics.
