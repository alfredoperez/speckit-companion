# Research: Dark Mode Toggle

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

No `NEEDS CLARIFICATION` items remain in the Technical Context. The two spec ambiguities were resolved in `/speckit-clarify` (system default on first visit, two-state switch). This file records the technical decisions.

## D1. How to theme: CSS custom properties switched by an attribute

- **Decision**: Define colors as custom properties on `:root`. Dark values live under `:root[data-theme="dark"]`. The switch sets `data-theme` on `<html>`.
- **Rationale**: One attribute write re-resolves every color at once, so 500 todos cost the same as 5 (SC-002). No per-element work, no class churn on list items. It matches the "CSS custom properties" input.
- **Alternatives considered**:
  - Class on `<body>`: the attribute on `<html>` is available before `<body>` parses, which D3 needs.
  - Two stylesheets swapped at runtime: extra request, flash risk, harder to keep in sync.
  - `light-dark()` CSS function: needs `color-scheme` per element and cannot be forced by an explicit user choice without the same attribute anyway.

## D2. Keep light literally unchanged

- **Decision**: Light values stay exactly as in `src/style.css` today (`#ffffff`, `#1b1b1b`, `#767676`). Native controls (input, button) get no light overrides. Dark sets `color-scheme: dark` plus explicit control colors.
- **Rationale**: The spec says light stays unchanged. Adding light overrides would change how the input and button look. `color-scheme: dark` darkens native scrollbars and control chrome for free.
- **Alternatives considered**: Full token set for both modes. Cleaner on paper, but it restyles light for no requirement.

## D3. Prevent the flash: a blocking classic script in `<head>`

- **Decision**: Add `src/theme-init.js`, a small classic (non-module) script loaded in `<head>` before the stylesheet. It reads the saved value, falls back to `matchMedia('(prefers-color-scheme: dark)')`, and sets `data-theme` on `<html>` before first paint.
- **Rationale**: `<script type="module">` is deferred, so it runs after first paint and would flash (FR-004, SC-003). A classic external script blocks parsing and runs first. An external file, not inline, keeps the page compatible with a strict CSP later.
- **Cost**: The 6-line resolve logic exists twice (the module and the init script), because a classic script cannot `import`. Mitigation: a `node:test` runs `theme-init.js` in a `node:vm` sandbox with fake `localStorage` and `matchMedia`, and asserts it agrees with `resolveTheme` across every case (see D6).
- **Alternatives considered**:
  - Inline `<script>` in `index.html`: same behavior, but blocks a future CSP and hides logic from tests.
  - `@media (prefers-color-scheme)` CSS only: handles first visit, cannot know a saved explicit choice.
  - Hide `body` until the module runs: avoids the wrong flash but adds a blank flash and breaks without JS.

## D4. Where the logic lives (constitution IV)

- **Decision**: Pure, DOM-free logic in `src/theme-store.js` with storage injected, mirroring `src/store.js`: `loadTheme`, `saveTheme`, `resolveTheme`, `nextTheme`, plus the `THEME_KEY` constant. DOM wiring goes in `src/theme.js`, which has no exported logic worth testing beyond what the store covers.
- **Rationale**: Principle IV requires every exported store function to have a `node:test` and the store to run in Node. Keeping the DOM out of the store satisfies both.
- **Alternatives considered**: Extending `src/store.js`. Rejected: it would mix todo data and appearance, and FR-009 wants them independent.

## D5. Storage: separate `localStorage` key, validated on read

- **Decision**: Key `tiny-todo.theme`, values exactly `"light"` or `"dark"`. Any other value, a missing key, or a thrown `getItem` is treated as "no saved choice". `saveTheme` swallows a thrown `setItem` and returns `false`.
- **Rationale**: Satisfies principle III (localStorage only), FR-010, and the edge cases for corrupted or blocked storage. Separate from `tiny-todo.items`, so appearance never touches todo data (FR-009).
- **Alternatives considered**: One JSON blob with the todos. Rejected: couples the two and a corrupt todo blob would drop the preference.

## D6. Test strategy

- **Decision**: `node --test src` (the existing `npm test`) covers: `resolveTheme` (saved wins, system fallback, no matchMedia), `loadTheme` (valid, invalid, missing, throwing storage), `saveTheme` (writes, throwing storage returns `false`), `nextTheme`, and the init-script parity test via `node:vm`. Contrast and keyboard/screen-reader checks are manual, listed in [quickstart.md](quickstart.md). A contrast calculation for the chosen palette is also scripted in the quickstart.
- **Rationale**: No dependencies allowed (principle I), so no browser test runner. `node:vm` gives real execution of the init script without a DOM library.

## D7. Toggle semantics

- **Decision**: A native `<button type="button">` with `aria-pressed` (`true` = dark on) and a stable visible label "Dark mode". A glyph beside the label (moon when on, sun when off) shows state without relying on color. Placed in `<header>` after the `<h1>`.
- **Rationale**: Native button gives Enter and Space, tab order, and focus for free (FR-008). A stable accessible name plus `aria-pressed` is the standard switch-button pattern: screen readers say "Dark mode, toggle button, pressed". A changing label would double-announce state.
- **Alternatives considered**: `role="switch"` with `aria-checked`. Equivalent for assistive tech, but needs extra ARIA on an element that already works as a button. Rejected for no gain.
- **No extra live-region announcement**: the pressed state change is announced by screen readers on the focused button. A separate live region would announce twice.

## D8. Motion

- **Decision**: No transition. The change is instant.
- **Rationale**: Meets the 100 ms goal trivially and removes the reduced-motion question (checklist CHK015).

## D9. Explicitly not done

- **Following live system changes**: If the OS setting flips while the app is open and the user has no saved choice, the app does not update. The spec says "open in" the system appearance. Adding a `matchMedia` listener is about 3 lines if wanted later.
- **Multi-tab sync**: A change in one tab does not update another open tab until reload. Not in the spec.
- **Returning to "follow system"**: Excluded by FR-006.
- **Todo keyboard access**: Todo `<li>` items are click-only today. That is pre-existing, outside this feature, and untouched.

## D10. Palette and contrast (computed, WCAG relative luminance)

| Pair | Light | Dark |
|---|---|---|
| Body text on background | `#1b1b1b` on `#ffffff` = 17.22 | `#e8e8e8` on `#121212` = 15.29 |
| Completed todo text | `#767676` on `#ffffff` = 4.54 | `#9a9a9a` on `#121212` = 6.66 |
| Input text on input surface | native default | `#e8e8e8` on `#1e1e1e` = 13.61 |
| Placeholder on input surface | native default | `#a0a0a0` on `#1e1e1e` = 6.38 |
| Control border vs background (non-text, 3:1) | `#767676` on `#ffffff` = 4.54 | `#8a8a8a` on `#1e1e1e` = 4.83 |
| Focus ring vs background (non-text, 3:1) | `#0b5cad` on `#ffffff` = 6.67 | `#7ab7ff` on `#121212` = 8.96 |
| Toggle text on toggle background | `#1b1b1b` on `#ffffff` = 17.22 | `#e8e8e8` on `#121212` = 15.29 |

Completed todos stay distinguishable by the line-through (not color alone) and the dimmed color, and both modes keep the dimmed color at or above 4.5:1 (checklist CHK026).
