# Plan: Sidebar Icon Order

**Spec**: [spec.md](./spec.md)

## Approach

This is a `package.json` contribution-point tweak: edit the `contributes.menus["view/title"]` entries scoped to `view == speckit.views.explorer` so `speckit.create` sits at `navigation@0` (already there as of writing — verify) and any `speckit.refresh` contribution against the explorer view is removed. Then sync the sidebar reference doc to match.

## Files to Change

- `package.json` — under `contributes.menus["view/title"]`, ensure `speckit.create` is at `navigation@0` for the explorer view; remove any entry that contributes `speckit.refresh` (or equivalent) to the explorer title bar. Leave `speckit.steering.*` entries untouched.
- `docs/sidebar.md` — update the Specs title-bar action list so it documents Create first, with no Refresh, matching the new contribution set.
- `README.md` — if the "Sidebar at a Glance" summary still mentions a refresh icon in the Specs view, drop the mention.
