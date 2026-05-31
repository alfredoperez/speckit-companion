# Quickstart: Sidebar Icon Adjustments

## Implementation target

Update the SpecKit explorer title-bar contributions so the create-spec action stays first on the right and the manual refresh icon is removed.

## Files to touch first

1. `package.json` — edit `contributes.menus.view/title` for `speckit.views.explorer`
2. `docs/sidebar.md` — update the title-bar description
3. `README.md` — update the sidebar summary if it mentions the old toolbar contents

## Supporting audit

Review but do not necessarily change these unless the implementation reveals a mismatch:

1. `src/features/specs/specCommands.ts` — confirms existing refresh and create command wiring
2. `src/core/fileWatchers.ts` — confirms automatic refresh still covers normal spec changes
3. `src/speckit/detector.test.ts` or other nearby tests — extend only if command exposure or create flow coverage needs adjustment

## Verification

1. Run `npm run compile`
2. Run `npm test`
3. Launch the Extension Development Host and verify:
   - The SpecKit explorer title bar shows create-spec as the leading right-side action
   - No manual refresh icon is visible in the explorer title bar
   - Filter, clear-filter, sort, and collapse/expand actions still behave normally
   - The explorer still updates after normal spec file changes or workflow actions
