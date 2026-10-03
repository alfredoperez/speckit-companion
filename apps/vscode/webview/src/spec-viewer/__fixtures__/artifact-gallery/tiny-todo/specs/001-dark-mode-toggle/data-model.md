# Data Model: Dark Mode Toggle

**Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

One new entity. Todo items are unchanged (FR-009).

## Entity: Appearance preference

The user's explicit light or dark choice, per device.

| Field | Type | Rules |
|---|---|---|
| value | `"light"` or `"dark"` | Exactly one of the two strings. Anything else counts as absent. |

- **Storage**: `localStorage`, key `tiny-todo.theme`, value stored as the bare string (no JSON). See [contracts/theme-storage.md](contracts/theme-storage.md).
- **Absent until first toggle**: while absent, the effective theme comes from the system setting (FR-005).
- **Independent of todos**: separate key from `tiny-todo.items`. Neither read nor write touches the other.
- **Not synced**: per device, no network (FR-010).

## Derived value: Effective theme

What the page actually shows. Not stored.

```text
effective = saved            if saved is "light" or "dark"
          = "dark"           if no saved value and system prefers dark
          = "light"          otherwise (no saved value, system light or unknown)
```

Applied as the `data-theme` attribute on `<html>`. The attribute is always set by the time the page first paints, so the toggle state and the displayed appearance always agree (checklist CHK031).

## State transitions

```text
                 ┌───────────── toggle ─────────────┐
                 ▼                                  │
 (no saved) ── toggle ──► saved = opposite of effective
                                │
              light ◄── toggle ──► dark        (two states, no third)
```

- First toggle with no saved value: the new value is the opposite of the effective theme, and it is saved. Example: system dark, no saved value, toggle → saved `"light"`.
- Later toggles flip between `"light"` and `"dark"`.
- There is no transition back to "absent" (FR-006).
- Rapid toggling: each activation computes the next value from the current effective theme and applies it synchronously, so the last activation wins and the saved value always matches what is displayed.

## Validation rules

| Rule | Source | Behavior |
|---|---|---|
| Value is `"light"` or `"dark"` | FR-003 | Other stored values are ignored on read (treated as absent). They are not repaired until the next toggle overwrites them. |
| Read must not throw | Edge case: corrupted | `getItem` errors are caught and treated as absent. No error shown. |
| Write must not throw | Edge case: storage blocked | `setItem` errors are caught. The toggle still changes the current page. The choice is not remembered. |
| Todo data untouched | FR-009 | The theme code never imports or calls the todo store. |
