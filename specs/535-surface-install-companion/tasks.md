# Tasks: Surface "Install Companion" prominently

**Branch**: `535-surface-install-companion` | **Plan**: `plan.md`

## Phase 1 — Shared plumbing

- [x] T001 Extend `InstallPromptSurface` in `src/core/telemetry.ts` to add `sidebarBadge`, `pinnedRow`, `welcome`; add a `coerceInstallPromptSurface` allow-list helper.
- [x] T002 Add `installNudgeDismissed` globalState key (`src/core/constants.ts`) and `companionInstallNudgeDismissed` context key (`src/core/utils/contextKeys.ts`).
- [x] T003 Register `speckit.companion.installNudge` (surface-tagged install) and `speckit.companion.dismissInstallNudge` commands.

## Phase 2 — Surface 1: Create Spec picker (US1)

- [x] T004 `specEditorProvider.getWorkflows()` always offers Companion with an `installed` flag + "Install to enable" hint.
- [x] T005 `WorkflowDefinition` type gains `installed?: boolean`.
- [x] T006 `handleSubmit` shows the benefits + one-click-install modal on a not-installed Companion pick; install proceeds, decline downgrades gracefully, dismiss aborts.

## Phase 3 — Surface 2: Activity-bar badge (US2)

- [x] T007 Set/clear `specsTreeView.badge` in `extension.ts` from the install signal, initially and in the watcher refresh; fire `shown(sidebarBadge)`.

## Phase 4 — Surface 3: Pinned CTA row (US3)

- [x] T008 Prepend the `companion-install-cta` row in `specExplorerProvider.getChildren()` when not installed and specs exist; yellow rocket icon; fire `shown(pinnedRow)`.

## Phase 5 — Surface 4: Empty-state welcome (US4)

- [x] T009 Add the `viewsWelcome` block + dismiss link in `package.json`; wire `dismissInstallNudge` to persist + set context key; mirror the key at activation.

## Phase 6 — Surface 5: Retire Steering badge (US5)

- [x] T010 `buildCompanionHeaderNode()` returns undefined when not installed; refresh Steering + Specs on install-state change.

## Phase 7 — Tests + docs

- [x] T011 Tests: picker offers Companion + install-first branch; pinned row gating; telemetry per-surface + coercion; dismiss-and-remember; steering node absence; manifest lock.
- [x] T012 Docs: README "Sidebar at a Glance", `docs/sidebar.md`, root `CHANGELOG.md` Unreleased.
- [x] T013 Verify `npm run compile && npm test && npm run package`.
