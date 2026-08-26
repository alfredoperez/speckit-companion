# Implementation Plan: A companion config the reader cannot handle fails loudly

**Branch**: `602-loud-malformed-config` | **Date**: 2026-08-26 | **Spec**: [spec.md](./spec.md)

## Summary

A `.specify/companion.yml` written with YAML outside the constrained reader's subset is currently parsed until the reader loses its place, then returned as whatever it managed to collect — no error, no warning, and the user's hooks silently missing. The fix teaches the reader to recognise the four unsupported shapes the issue names (anchor, alias, tab indentation, block scalar) and, as a general backstop, to treat any file it did not read to the end as a failure. Every one of those raises, which the loader's existing failure path already turns into the documented `malformed companion.yml (…); using shipped defaults` warning. Nothing about what the reader *accepts* changes: the checks look only at the first token of a key or an unquoted value, so shell commands, quoted globs and redirects keep parsing byte for byte as they do today.

## Project Structure

```
speckit-extension/
├── scripts/
│   └── companion_config.py     # the constrained reader + the failure table
├── tests/
│   └── test_config.py          # unittest suite for the reader and the merge contract
└── CHANGELOG.md                # user-facing entry, under [Unreleased]
```

**Structure Decision**: The change is confined to the reader that owns the failure table and its existing test module. No caller changes: every consumer already goes through `load_config`, which already handles the raise.

## Constitution Check

| Principle | Assessment |
| --- | --- |
| I. Extensibility and Configuration | PASS — the config surface is unchanged; only the reporting of an unreadable file changes. |
| II. Spec-Driven Workflow | PASS — the pipeline's hook configuration becomes trustworthy, which is what the workflow depends on. |
| III. Visual and Interactive | PASS — no user interface surface is touched. |
| IV. Modular Architecture for Complex Features | PASS — the detection lives beside the reader it guards, as one small helper. |

No violations, so no Complexity Tracking table.

Re-checked after the Phase 1 design: still PASS on all four.

## Approach

**Line identity.** The reader currently discards blank and comment lines while building its working list, which loses the original line numbers. The working list carries each line's original number alongside it, so a rejection can name the line the user sees in their editor.

**A per-line guard, run before parsing.** Each retained line is checked once for a shape the reader cannot represent:

- a tab in the line's leading whitespace,
- a key or unquoted value whose first token is `&` or `*` followed by a plain name, which an unquoted glob is not,
- an unquoted value that is exactly a block-scalar indicator (`|`, `>`, with optional chomping or indentation digits).

Inline flow values (`[…]`, `{…}`) and quoted values are exempt from the token checks — inside them the characters are ordinary data, and the flow parser already owns them.

**A completeness check, run after parsing.** If the cursor did not reach the end of the working list, the file was not fully read; that raises and names the first unread line. This is the general guarantee behind FR-008 and the reason no future unsupported shape can reintroduce a silent partial parse.

**Reporting.** Both checks raise `ValueError`, which `load_config` already catches, so the warning wording, the shipped-defaults return and the never-fail-the-host-command contract are all inherited untouched.

## Phase 0 — Research

See [research.md](./research.md): what the reader does today for each shape, why detection beats implementing anchors, why the completeness backstop is the load-bearing half, and why the checks are anchored to the start of a value.

## Phase 1 — Design & contracts

- [data-model.md](./data-model.md) — the two values the reader passes around and the shape of a rejection.
- [contracts/config-reader.md](./contracts/config-reader.md) — what a caller may rely on from the reader and the loader after this change.
