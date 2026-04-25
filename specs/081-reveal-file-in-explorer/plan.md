# Plan: Reveal File In Explorer

**Spec**: [spec.md](./spec.md) | **Date**: 2026-04-25

## Approach

Extend the existing `speckit.specs.reveal` command (added in spec 069) to handle file-level tree items, then add menu `when` clauses for `spec-document-*` and `spec-related-doc` viewItems. The handler resolves the URI by preferring `item.filePath` (file-level) over `item.specPath` (folder-level), so the same command works for both. Pure additive change — no breaking impact on 069's spec-folder reveal.

## Files to Change

### Modify

- `src/features/specs/specExplorerProvider.ts` — make `filePath` accessible from outside the class. Currently it's `private readonly filePath?: string` (line 584). Change to `public readonly filePath?: string` so the command handler can read it. (No other ergonomics change.)
- `src/features/specs/specCommands.ts` — update the `speckit.specs.reveal` handler so the URI it reveals is derived as: `item.filePath ?? item.specPath ?? \`specs/${item.label}\``. File-level items pass `filePath`, spec-folder items pass `specPath`. Existing `fs.stat` existence-check + error toast continue to apply.
- `package.json` — under `contributes.menus["view/item/context"]`, add two new entries pointing at `speckit.specs.reveal`:
  - `viewItem =~ /^spec-document/` for the four core/workflow document types (`spec-document-spec`, `spec-document-plan`, `spec-document-tasks`, `spec-document-{custom}`). Use a regex `when` clause so we don't enumerate every workflow step.
  - `viewItem == spec-related-doc` for related docs.
  - Both go in `group: "navigation@99"` to match 069's placement on the spec node.

### Tests to Add

- `src/features/specs/specCommands.test.ts` — extend the existing `speckit.specs.reveal command handler` describe block:
  - "calls revealFileInOS with file URI when item has filePath" — pass an item with `filePath: 'specs/080-foo/spec.md'` → expect `revealFileInOS` called with the absolute file URI.
  - "falls back to specPath when filePath is undefined" — preserves the existing folder-reveal behaviour.
  - "shows error when filePath does not exist" — file-level missing-file case.
