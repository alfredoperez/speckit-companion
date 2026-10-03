# Contract: `src/theme-store.js` exports

ES module, no DOM access, no imports. Storage and the system query are injected so every function runs under `node:test` (constitution IV). Each export has at least one test in `src/theme-store.test.js`.

```js
export const THEME_KEY = 'tiny-todo.theme';

/** Saved choice, or null when absent/invalid/unreadable. Never throws. */
export function loadTheme(storage = globalThis.localStorage): 'light' | 'dark' | null;

/** Persist an explicit choice. Never throws. Returns true if written, false if storage
 *  threw or the value is not 'light'/'dark' (nothing is written in that case). */
export function saveTheme(theme: 'light' | 'dark', storage = globalThis.localStorage): boolean;

/** Effective theme. saved wins; otherwise systemPrefersDark picks 'dark' or 'light'. */
export function resolveTheme(saved: 'light' | 'dark' | null, systemPrefersDark: boolean): 'light' | 'dark';

/** The other theme. */
export function nextTheme(current: 'light' | 'dark'): 'light' | 'dark';
```

## Behavior table

| Call | Result |
|---|---|
| `loadTheme(s)` with `"dark"` stored | `'dark'` |
| `loadTheme(s)` with `"blue"` stored | `null` |
| `loadTheme(s)` with nothing stored | `null` |
| `loadTheme(s)` where `getItem` throws | `null` |
| `saveTheme('dark', s)` | writes `dark` under `THEME_KEY`, returns `true` |
| `saveTheme('dark', s)` where `setItem` throws | returns `false` |
| `saveTheme('blue', s)` | writes nothing, returns `false` |
| `resolveTheme('light', true)` | `'light'` (saved wins) |
| `resolveTheme(null, true)` | `'dark'` |
| `resolveTheme(null, false)` | `'light'` |
| `nextTheme('light')` / `nextTheme('dark')` | `'dark'` / `'light'` |

## Not part of this contract

DOM wiring lives in `src/theme.js` and is not exported for reuse. `src/store.js` (todos) is unchanged.
