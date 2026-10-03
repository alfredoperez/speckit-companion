# Contract: Toggle UI and DOM

What the page exposes to users, assistive technology, and CSS.

## Root attribute

| Item | Value |
|---|---|
| Element | `<html>` |
| Attribute | `data-theme` |
| Values | `light` or `dark` |
| Set by | `src/theme-init.js` before first paint, then `src/theme.js` on each toggle |
| Guarantee | Always present and valid by first paint (when JS is enabled) |

## Toggle control

```html
<header>
  <h1>Tiny Todo</h1>
  <button type="button" id="theme-toggle" aria-pressed="false">
    <span aria-hidden="true" class="theme-icon"></span>
    <span>Dark mode</span>
  </button>
</header>
```

| Property | Requirement | Source |
|---|---|---|
| Element | Native `<button type="button">` | FR-008 |
| Accessible name | `Dark mode`, constant, never changes with state | FR-008 |
| State | `aria-pressed="true"` when dark is on, `"false"` when light | FR-008, US3-3 |
| Initial state | `aria-pressed` matches the effective theme at load (set in `theme.js` on startup) | FR-005 |
| Visible state cue | Icon span shows a moon when on and a sun when off, so state is not conveyed by color alone. The icon is decorative (`aria-hidden`). | FR-007 |
| Keyboard | Enter and Space activate it (native button) | US3-2 |
| Tab order | In the header, after the `<h1>` and before the add form | US3-1 |
| Focus | Visible focus ring, at least 3:1 against the adjacent background, in both themes | FR-007 |
| Target size | At least 44 by 44 CSS px | WCAG 2.5.5 (best practice) |
| Placement | Inside `<header>`, aligned to the end of the row, wraps below the title on narrow screens | Spec assumption |

## Activation behavior

1. Compute `next = nextTheme(current)` where `current` is the `data-theme` value.
2. Set `data-theme` to `next` and `aria-pressed` to `next === 'dark'`, synchronously.
3. Call `saveTheme(next)`. Ignore the result (a `false` just means "not remembered").
4. No transition, no page reload, no network request.

## CSS token contract

Custom properties defined on `:root` (light values unchanged from today) and overridden under `:root[data-theme="dark"]`:

| Property | Light | Dark |
|---|---|---|
| `--bg` | `#ffffff` | `#121212` |
| `--text` | `#1b1b1b` | `#e8e8e8` |
| `--text-muted` | `#767676` | `#9a9a9a` |
| `--surface` | not set (native) | `#1e1e1e` |
| `--border` | not set (native) | `#8a8a8a` |
| `--placeholder` | not set (native) | `#a0a0a0` |
| `--focus` | `#0b5cad` (toggle only) | `#7ab7ff` |
| `color-scheme` | `light` | `dark` |

Rules:

- Every color in `src/style.css` must come from a token. No hard-coded colors outside the token block.
- Light mode must render the existing elements exactly as before: no new light overrides on `input` or the add button.
- Completed todos keep `text-decoration: line-through` in both themes.

## Elements covered by "entire app" (FR-002)

`html`/`body` background and text, header and title, toggle, add input (text, placeholder, border), add button, todo list items (active, completed), native scrollbars and control chrome via `color-scheme`.

## Verified by

Manual steps in [quickstart.md](../quickstart.md) (keyboard, screen reader, contrast, flash). Logic is covered by `npm test`.
