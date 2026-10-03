# Implementation Plan: Dark Mode Toggle

**Branch**: N/A (no git repository; feature dir `001-dark-mode-toggle`) | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-dark-mode-toggle/spec.md`

## Summary

Add a header toggle that switches the Tiny Todo app between light and dark. Colors become CSS custom properties; a `data-theme` attribute on `<html>` selects the set. The choice is saved in `localStorage` and applied by a small blocking script in `<head>` so there is no flash. First visit follows the system setting. Plain HTML, CSS and ES modules, no build step, no dependencies. See [research.md](research.md) for the decisions.

## Technical Context

**Language/Version**: Plain HTML5, CSS (custom properties), JavaScript ES modules (browser-native); Node 20+ for tests only

**Primary Dependencies**: None (constitution I)

**Storage**: `localStorage`, new key `tiny-todo.theme` ([contract](contracts/theme-storage.md))

**Testing**: `node:test` via the existing `npm test` (`node --test src`); manual browser checks in [quickstart.md](quickstart.md)

**Target Platform**: Current evergreen desktop and mobile browsers (needs `data-*`, custom properties, `matchMedia`, ES modules)

**Project Type**: Static single-page web app, no build step

**Performance Goals**: Theme change visible in under 100 ms for 500 todos (SC-002); no flash on load (SC-003)

**Constraints**: No network, no cookies, no third-party code; WCAG 2.x AA; light appearance unchanged

**Scale/Scope**: One page, one user, one device; 1 new entity (a 2-value preference); 4 new files, 2 edited

## Constitution Check

*GATE: passed before Phase 0, re-checked after Phase 1.*

| Principle | Status | How |
|---|---|---|
| I. No Runtime Dependencies | Pass | Only first-party HTML, CSS and JS. No imports from the network. |
| II. Accessible by Default (WCAG AA) | Pass | Native `<button>` with `aria-pressed` and stable name, visible focus, 4.5:1 text and 3:1 non-text contrast computed in [research.md](research.md) D10, 44px target. |
| III. State Lives in localStorage Only | Pass | One `localStorage` key. No cookie, IndexedDB, or network. Init script reads the same key. |
| IV. Every Store Function Has a node:test | Pass | `loadTheme`, `saveTheme`, `resolveTheme`, `nextTheme` are exported from a DOM-free module with injected storage, each tested. `THEME_KEY` parity and init-script behavior also tested. |

No violations. Complexity Tracking not needed.

**One tension, accepted**: the resolve logic is duplicated in `theme-init.js` because a blocking classic script cannot import a module. A `node:vm` test keeps the two in agreement ([research.md](research.md) D3).

## Project Structure

### Documentation (this feature)

```text
specs/001-dark-mode-toggle/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── theme-storage.md
│   ├── theme-store-api.md
│   └── toggle-ui.md
├── checklists/
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
index.html               # edit: head script, toggle button in <header>
src/
├── theme-init.js        # new: blocking classic script, sets data-theme pre-paint
├── theme-store.js       # new: pure logic, injected storage (tested)
├── theme-store.test.js  # new: node:test for store + init-script parity
├── theme.js             # new: DOM wiring, binds button, aria-pressed, save on click
├── style.css            # edit: colors to custom properties, dark overrides, toggle styles
├── app.js               # edit: import './theme.js' (one line)
├── store.js             # unchanged
└── store.test.js        # unchanged
```

**Structure Decision**: Keep the existing flat `src/` layout. Theme code sits beside the todo code but shares nothing with it (FR-009). No `tests/` folder is introduced, matching `package.json` (`node --test src`).

## Design notes

- **Load order in `index.html`**: `<script src="src/theme-init.js">` first in `<head>`, then the stylesheet link. The init script sets `data-theme` before the stylesheet applies.
- **Startup in `theme.js`**: read `data-theme` (already set), set `aria-pressed`, and attach the click handler. No second resolve, so the page and the button cannot disagree.
- **Header layout**: `<header>` becomes a flex row (`justify-content: space-between`, `flex-wrap: wrap`) so the toggle wraps under the title on narrow screens.
- **Light unchanged**: light tokens equal today's literals. Controls get dark-only overrides ([contracts/toggle-ui.md](contracts/toggle-ui.md)).

## Phase 1 re-check

Design artifacts introduce no new storage, dependency, or untested store function. Constitution Check still passes.

## Artifacts

- [research.md](research.md)
- [data-model.md](data-model.md)
- [quickstart.md](quickstart.md)
- [contracts/theme-storage.md](contracts/theme-storage.md), [contracts/theme-store-api.md](contracts/theme-store-api.md), [contracts/toggle-ui.md](contracts/toggle-ui.md)
