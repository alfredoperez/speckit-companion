# Contract: Theme storage

The persisted shape of the appearance preference. Shared by `src/theme-store.js` and `src/theme-init.js`, which must agree.

| Item | Value |
|---|---|
| Store | `window.localStorage` only (constitution III) |
| Key | `tiny-todo.theme` |
| Valid values | `light`, `dark` (bare strings, no JSON, no quotes) |
| Absent | Key missing, any other string, or storage unreadable |
| Writer | `saveTheme` only, on toggle |
| Readers | `loadTheme` (module), `theme-init.js` (pre-paint) |

## Behavior

- **Read failure** (storage throws, or value is not `light`/`dark`): behave as absent. No error, no log.
- **Write failure** (storage throws): swallowed. The current page still switches. The next visit uses the system default.
- **No other keys**: the feature adds no other storage. The todo key `tiny-todo.items` is never read or written by theme code.
- **No network**: no request is made to read or write the preference (FR-010).

## Compatibility

Adding this key does not change the todo data format. Removing the feature leaves one harmless orphan key.

## Verified by

- `src/theme-store.test.js`: valid, invalid, missing, and throwing storage.
- `src/theme-store.test.js`: `THEME_KEY` equals the key literal used in `src/theme-init.js`.
