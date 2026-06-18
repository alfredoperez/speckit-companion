# Tasks: Slim, dismissible install banner

**Feature**: `353-install-banner-slim` · **Issue**: #353

Line format: `- [ ] **T###** [P?] [US#] Description · file`. `[P]` = independent within its wave.

## Phase 1: Setup

_No setup tasks — this change extends existing modules; no new tooling or structure._

## Phase 2: Foundational (blocks all stories)

Shared state key and message types every surface depends on.

**Wave 1 — independent (different files):**

- [x] **T001** [P] [US1] Add `installBannerDismissed: 'speckit.installBannerDismissed'` to `ConfigKeys.globalState` · src/core/constants.ts
- [x] **T002** [P] [US1] Add `{ type: 'dismissInstallBanner' }` to the spec-editor webview→extension message union · src/features/spec-editor/types.ts
- [x] **T003** [P] [US1] Add `{ type: 'dismissInstallBanner' }` to the webview-side spec-editor message union · webview/src/spec-editor/types.ts
- [x] **T004** [P] [US1] Add `{ type: 'dismissInstallBanner' }` to the spec-viewer message union · src/features/spec-viewer/types.ts

**⟶ Wait for Wave 1, then proceed to the story phases.**

## Phase 3: User Story 1 — Dismiss the banner for good (P1)

**Goal**: Clicking × hides the banner and persists the choice in globalState; the banner stays gone across reloads and workspaces.

**Independent Test**: Banner shows (extension absent); click ×; it disappears; reload + open another workspace; still absent.

### Implementation

**Wave 1 — extension-side gate + handlers (different files):**

- [x] **T005** [P] [US1] In `renderInstallBannerHtml`, gate the Create-Spec banner on `!dismissed` (read `globalState[installBannerDismissed]` at the call site) and add a `case 'dismissInstallBanner'` to `handleMessage` that sets the flag and re-renders · src/features/spec-editor/specEditorProvider.ts
- [x] **T006** [P] [US1] Gate `computeShowInstallPrompt()` on `!dismissed` (read the globalState flag via `this.context`) · src/features/spec-viewer/specViewerProvider.ts
- [x] **T007** [P] [US1] Add a `dismissInstallBanner` entry to the spec-viewer `messageHandlers` map that sets the globalState flag and refreshes the panel · src/features/spec-viewer/messageHandlers.ts

**⟶ Wait for Wave 1, then wire the webview click delegation:**

**Wave 2 — webview click → dismiss message (different files):**

- [x] **T008** [P] [US1] Add a `dismissInstallBanner` branch to the Create-Spec banner click delegation (already guards `e.target instanceof Element`) · webview/src/spec-editor/index.ts
- [x] **T009** [P] [US1] Add a `dismissInstallBanner` branch to the spec-viewer document-delegated banner click handler · src/features/spec-viewer/html/generator.ts

**Checkpoint**: Dismissing on either surface persists to globalState and removes the banner everywhere after re-render. US1 is independently functional.

## Phase 4: User Story 2 — A lighter, single-row banner (P1)

**Goal**: The banner renders as one compact row (glyph + line + Install + Learn more + ×) on both surfaces.

**Independent Test**: Open Create Spec / Activity panel with the extension absent and not dismissed; confirm the slim single-row layout with a × control.

### Implementation

**Wave 1 — markup + styles (different files):**

- [x] **T010** [P] [US2] Slim the server-rendered banner markup to a single row and add the × button (`data-action="dismissInstallBanner"`, `aria-label="Dismiss install prompt"`) · src/features/spec-editor/installBanner.ts
- [x] **T011** [P] [US2] Slim the Preact `InstallBanner` markup to match (single row + × button with the same `data-action`/`aria-label`) · webview/src/spec-viewer/components/ActivityPanel.tsx
- [x] **T012** [P] [US2] Restyle `.install-banner` to a single compact row and add `.install-banner__dismiss` using VS Code theme tokens · webview/styles/spec-viewer/_install-banner.css

**Checkpoint**: Both surfaces present the slim one-row banner with a working ×. US2 is independently testable.

## Phase 5: Polish

- [x] **T013** [US2] Update `ActivityPanel.stories.tsx` to cover the slim banner state and the dismissed (hidden) state · webview/src/spec-viewer/components/ActivityPanel.stories.tsx
- [x] **T014** [US1] Add a user-facing CHANGELOG entry for the slim, dismissible banner · CHANGELOG.md
- [x] **T015** [US1] `npm run compile && npm test` — fix any failures; webview bundle builds clean · (validation)

## Dependencies & Execution Order

- **Phase 2 (Foundational)** blocks everything: the globalState key (T001) and the three message-type additions (T002–T004) are read/handled by the story phases. Its Wave 1 is fully parallel (four different files).
- **Phase 3 (US1)** depends on Phase 2. Wave 1 (extension gate + handlers, T005–T007) precedes Wave 2 (webview click wiring, T008–T009), since the click messages need the handlers to exist.
- **Phase 4 (US2)** markup/CSS (T010–T012) is parallel and depends only on the × `data-action` contract from Phase 3; can follow Phase 3.
- **Phase 5 (Polish)** runs last: stories (T013) after the markup settles, CHANGELOG (T014) any time, validation (T015) last.
