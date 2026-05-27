# Spec: Fix Inline-Code Misdetected as File-Ref

**Slug**: 117-fix-inline-code-fileref | **Date**: 2026-05-27

## Summary

The spec viewer's inline-markdown renderer upgrades any backtick span ending in `.<letters>` into a clickable `.file-ref` pill, which catches dotted identifiers like `ctx.currentStep`, `process.env`, and `vscode.WorkspaceFolder`. Those render as pills pointing at nonexistent paths and behave like dead links. Tighten the heuristic in `parseInline` so only spans with a known file extension (or a path separator + known extension) become `.file-ref` pills; everything else falls through to plain `<code>`.

## Requirements

- **R001** (MUST): A backtick span whose stem is a dotted identifier (camelCase or dot-namespaced) such as `` `ctx.currentStep` ``, `` `process.env` ``, `` `instance.panel.visible` ``, `` `vscode.WorkspaceFolder` `` MUST render as plain `<code>` — not as `<button class="file-ref">`.
- **R002** (MUST): A backtick span ending in a known file extension MUST still render as `.file-ref`. The allow-list is: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.md`, `.json`, `.jsonc`, `.css`, `.scss`, `.html`, `.htm`, `.yml`, `.yaml`, `.py`, `.sh`, `.bash`, `.zsh`, `.toml`, `.lock`, `.txt`, `.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.ico`, `.vsix`. Existing positive cases (`package.json`, `card.component.ts`, `_tasks.css`, `src/foo.ts`) continue to render as today.
- **R003** (MUST): A backtick span containing a path separator (`/` or `\`) followed by a stem ending in a known extension MUST render as `.file-ref`, with the full path preserved in `data-filename`, the same value in `title`, and the basename shown inside `<code>` — same behavior as today.
- **R004** (MUST): The `data-filename` / `title` / basename split currently in `parseInline` MUST be preserved unchanged. Only the file-vs-code dispatch changes; the `.file-ref` button markup is identical.
- **R005** (MUST): `webview/src/spec-viewer/markdown/inline.test.ts` MUST be extended with negative cases for `` `ctx.currentStep` ``, `` `process.env` ``, and `` `instance.panel.visible` `` asserting that the output contains `<code>…</code>` and does NOT contain `file-ref` or `<button`. All existing positive and negative cases MUST continue to pass.

## Scenarios

### Dotted identifier in prose

**When** a spec body contains `` `ctx.currentStep` `` and the viewer renders it
**Then** the output is `<code>ctx.currentStep</code>` — no `.file-ref` pill, no `data-filename`, no tooltip, no clickable affordance.

### Real filename in prose

**When** a spec body contains `` `package.json` `` or `` `card.component.ts` ``
**Then** the output is `<button class="file-ref" data-filename="…"><code>…</code></button>` — unchanged from today.

### Path-prefixed real file

**When** a spec body contains `` `src/foo.ts` `` or `` `webview/src/spec-viewer/markdown/inline.ts` ``
**Then** the output is a `.file-ref` button whose `data-filename` and `title` hold the full path and whose `<code>` text shows only the basename — unchanged from today.

### Unknown extension

**When** a spec body contains `` `weird.xyz` `` (an extension not on the allow-list)
**Then** the output is plain `<code>weird.xyz</code>`. This is an accepted trade-off: an allow-list keeps the heuristic conservative; new extensions are added by editing the list when they show up in real specs.

## Out of Scope

- Changing the visual style, hover behavior, or click handler of `.file-ref` pills.
- Reworking the inline markdown renderer or replacing it with a library.
- Making the extension allow-list user-configurable per workspace or per workflow.
- Tightening other dispatch heuristics in `parseInline` (links, images, emphasis) — only the backtick-handler filename branch is in scope.
- Any change to how `.file-ref` clicks resolve files in the extension host.
