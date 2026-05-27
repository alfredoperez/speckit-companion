# Plan: Fix Inline-Code Misdetected as File-Ref

**Spec**: [spec.md](./spec.md)

## Approach

Replace the loose filename heuristic in `parseInline`'s backtick handler with an allow-list match on known file extensions. The current regex `/[^\s/\\]+\.[a-zA-Z][a-zA-Z0-9]+$/` upgrades any dotted identifier (`ctx.currentStep`, `process.env`) into a `.file-ref` pill; the fix swaps it for a single `KNOWN_EXTENSIONS` set check against the stem's trailing extension. Markup, attributes, and basename/path split stay byte-identical so no CSS, click handler, or downstream code is affected.

## Files

### Modify

- `webview/src/spec-viewer/markdown/inline.ts` — define `KNOWN_EXTENSIONS` (R002 allow-list), replace the inline regex test with a "strip last `.ext`, check membership" gate that still supports path prefixes; keep `data-filename`/`title`/basename emission unchanged.
- `webview/src/spec-viewer/markdown/inline.test.ts` — add negative cases for `` `ctx.currentStep` ``, `` `process.env` ``, `` `instance.panel.visible` `` and one for an unknown extension (`weird.xyz`); leave all existing positive/negative cases intact.

## Risks

- Allow-list omits an extension that appears in real specs (e.g. `.toml`, `.svg`): user-visible regression where a real filename renders as plain `<code>`. Mitigation: the R002 list already covers every extension currently appearing in `specs/**` and the repo source tree; widening it is a one-line edit.
