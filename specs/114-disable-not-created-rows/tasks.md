# Tasks: Disable Not Created Rows

**Plan**: [plan.md](./plan.md)

## Phase 1: Core Implementation

- [x] **T001** Skip open-command for not-created step rows — `src/features/specs/specExplorerProvider.ts` | R001, R002, R003, R004
  - **Do**: In the step-row loop near line 602, replace the unconditional `createOpenCommand(resolvedFilePath, `Open ${label}`)` argument passed to `new SpecItem(...)` with `status === 'empty' ? undefined : createOpenCommand(resolvedFilePath, `Open ${label}`)`. Leave every other argument (label, contextValue, status, etc.) unchanged so the row still renders with its "not created" description and right-click menu.
  - **Verify**: `npm run compile` succeeds. Reload the Extension Development Host; in a spec where Plan / Tasks files don't exist, clicking those rows in the SPECS sidebar does nothing (no viewer opens), the "not created" label still shows, and right-click still surfaces the context menu. Clicking a row whose file does exist still opens the viewer as before.
