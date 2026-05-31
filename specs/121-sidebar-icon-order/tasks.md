# Tasks: Sidebar Icon Order

**Plan**: [plan.md](./plan.md)

## Phase 1: Core Implementation

- [x] **T001** Pin `speckit.create` to navigation@0 in the explorer title bar — `package.json` | R001
  - **Do**: In `contributes.menus["view/title"]`, confirm the entry with `command: "speckit.create"` and `when: "view == speckit.views.explorer"` uses `group: "navigation@0"`. If a higher index is in place, fix it.
  - **Verify**: `npm run compile` succeeds; in an Extension Development Host the leftmost title-bar icon for the Specs view is Create Spec.

- [x] **T002** Remove any refresh contribution from the explorer title bar — `package.json` | R002
  - **Do**: In `contributes.menus["view/title"]`, delete any entry whose `command` is `speckit.refresh` (or equivalent) and whose `when` targets `view == speckit.views.explorer`. Leave `speckit.steering.refresh` (steering view) intact.
  - **Verify**: After reload, the Specs title bar shows no Refresh icon; Steering view still has its refresh.

- [x] **T003** [P] *(depends on T001, T002)* Sync sidebar reference doc — `docs/sidebar.md` | R001, R002
  - **Do**: Update the Specs title-bar action list so it reads Create → Filter → (Clear Filter, conditional) → Sort → Collapse/Expand, with no Refresh mention.
  - **Verify**: `git diff docs/sidebar.md` shows the action list updated; no stale Refresh references remain.

- [x] **T004** [P] *(depends on T001, T002)* Audit README for Specs-view refresh mentions — `README.md` | R002
  - **Do**: Search the "Sidebar at a Glance" section (and any other Specs-view callouts) for "refresh". If found in the Specs context, remove the mention.
  - **Verify**: `grep -n -i refresh README.md` returns no Specs-view hits (Steering-view mentions are fine).

- [ ] **T005** *(depends on T001–T004)* Manual UX check — Extension Development Host | R001, R002, R003
  - **Do**: Launch the Extension Development Host (F5), open the Specs sidebar in an empty workspace, in a populated workspace, and with a filter active. Confirm Create is leftmost, Refresh is gone, and Filter/Sort/Collapse behave as before.
  - **Verify**: All three states render as described in spec.md § Scenarios.
