# Plan: Empty-State Onboarding Card

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-25

## Approach

Replace the `contents` string of the existing zero-spec welcome view in `package.json` (the entry guarded by `speckit.detected && !speckit.constitutionNeedsSetup`) with a richer markdown payload — headline, one-sentence description, a `[$(plus) Create your first spec](command:speckit.create)` button, and a `[$(book) Read the docs](https://github.com/alfredoperez/speckit-companion#readme)` link. No new commands, no new TypeScript code, no context-key changes — VS Code already hides the welcome view when the tree has children, so spec-presence handling is automatic.

## Files to Change

### Modify

- `package.json` — the third `viewsWelcome` entry (line ~102), `when: "speckit.detected && !speckit.constitutionNeedsSetup"`: rewrite its `contents` string to include the headline, description, primary button, and docs link.

### No new files

No code, types, or commands are introduced. The existing `speckit.create` command and the upstream `homepage` URL (already declared in `package.json`) are reused.
