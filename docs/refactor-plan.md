# Structural Refactor Plan

> **Status:** Phase 0 in progress on branch `refactor/structural-cleanup`.
> Origin: thermo-nuclear code quality review (2026-05). One commit per phase on one branch.

## Why this exists

A whole-repo review surfaced three structural issues and a documentation/reality gap:

1. **Provider duplication** — 8 providers, no shared base class. Each `*CliProvider.ts` independently reimplements temp-file write, shell escaping, terminal lifecycle, and cleanup. ~700–900 LOC of copy-paste.
2. **Two extension files over 1k LOC** — `specViewerProvider.ts` (1110) and `messageHandlers.ts` (1001). Both bypass the helper modules sitting next to them. `updateContent()` alone is 227 LOC of mixed I/O + derivation + UI dispatch.
3. **Half-finished Preact migration** — components mounted on top of a still-live imperative DOM-rendering pipeline. `signals.ts` exists mainly to paper over the seam. Three independent systems (`renderer.ts` HTML strings, manual `render(h(…), slot)` mounts, delegated `actions.ts` handlers) coordinate on the same DOM.
4. **Docs lie about the codebase** — `architecture.md` claims 5 providers (reality: 8), lists files that no longer exist (`navigation.ts`, `scratchpad.ts`, `state.ts`), and omits the Preact rewrite entirely.

## Prevention strategy (Phase 0)

The real win isn't fixing the symptoms — it's structuring docs so they can't drift this way again.

- **Reduce surface area.** `architecture.md` stops enumerating files; it describes module responsibilities instead. Provider count lives in *one* place (the README provider matrix), with a `<!-- count must match package.json enum -->` marker.
- **Mechanize the checklist.** `scripts/check-docs.ts` asserts: (1) `package.json` aiProvider enum count == README matrix row count, (2) every `*Provider.ts` is named in `architecture.md`, (3) every doc-mentioned file path exists. Wired into `npm test`, so drift fails locally not just in CI.
- **Surface the CLAUDE.md checklist on relevant PRs** (future): a GitHub Action that nudges when `src/ai-providers/**`, `src/features/**`, or the aiProvider enum changes.

## Phases

| # | Phase | LOC Δ | Risk | Effort | Depends on |
|---|---|---|---|---|---|
| 0 | Docs match reality + restructure + `check-docs.ts` | +50 | none | 2h | — |
| 1 | `CliTerminalProvider` base class | −800 | medium | 1d | 0 |
| 2 | `ProviderRegistry` (validated) | ~0 | low | 0.5d | 1 |
| 3 | `PanelStateComputer` (extract from specViewerProvider) | −500 | medium | 1d | 0 |
| 4 | Message dispatch map (decompose messageHandlers) | −400 | medium | 1d | 0 |
| 5 | Kill imperative webview layer | −900 | med-high | 2–3d | 3, 4 |
| 6 | `FooterActions` split | −150 | low | 0.5d | 5 |
| 8 | Doc re-validation closeout (just run `npm test`) | small | none | 5min | 6 |

Phase 7 (watchlist drive-bys for `specExplorerProvider`, `steeringExplorerProvider`, `specCommands`, viewer `types.ts`) is **rolling** — opportunistic cleanup when an unrelated change opens the file, not scheduled.

**Sequencing:** 0 → 1 → 2 → (3 ∥ 4) → 5 → 6 → 8. Phases 3 and 4 can run in parallel (different files, no overlap). Total: ~7 working days.

**Net deletion:** ~2,700 LOC.

## Stop conditions

Each phase is an independently shippable commit. Safe stop points:
- After Phase 2 → providers cleaned up, docs accurate. ~1.5d invested.
- After Phase 4 → extension side done. ~3.5d invested.
- After Phase 5 → webview done. ~6d invested.
- Phase 6+8 are polish.

## Phase 0 detailed scope

### 0a — Restructure docs

- `docs/architecture.md`:
  - Replace per-directory **file lists** with **responsibility paragraphs**. Files are knowable from `ls`; responsibilities aren't.
  - Bump "5 supported providers" → 8: `claude`, `claude-vscode`, `gemini`, `copilot`, `codex`, `qwen`, `opencode`, `ide-chat`.
  - Rewrite `webview/src/spec-viewer/` section to reflect Preact (`App.tsx`, `index.tsx`, `components/`, `signals.ts`, `timelineEvents.ts`, `elapsedFormat.ts`, `relativeTime.ts`); drop dead names (`navigation.ts`, `scratchpad.ts`, `state.ts`).
- `docs/how-it-works.md`:
  - Mermaid diagram + intro line + "Supported AI Providers" matrix → 8 providers.
- `CLAUDE.md`:
  - Stop hard-coding the 5-provider list at the top. Reference the README matrix.
- `README.md`:
  - "Six providers ship today" → 8. Verify matrix matches `package.json` enum.
  - Add the `<!-- count must match package.json enum -->` marker.

### 0b — `scripts/check-docs.ts`

Asserts on each `npm test` run:
1. `package.json` `speckit.aiProvider.enum` length == count of rows in the README "Supported AI Providers" matrix.
2. Every file matching `src/ai-providers/*Provider.ts` appears by name in `docs/architecture.md`.
3. Every directory and `*.ts` path mentioned in `docs/architecture.md`, `docs/how-it-works.md`, or `CLAUDE.md` exists on disk.

~50–80 LOC. Fail loud with the specific mismatched value.

### 0c — Wire into npm test

Add `"check:docs": "tsx scripts/check-docs.ts"` and chain it into `"test"`.

## Exit criteria summary

Phase 0 is done when:
- `npm test` passes, including the new docs check.
- Provider count is consistent across `CLAUDE.md`, `README.md`, `docs/architecture.md`, `docs/how-it-works.md`, and `package.json` enum.
- `docs/architecture.md` no longer lists individual files (except where genuinely structural, like entry points).

## Notes

- Branch: `refactor/structural-cleanup` (off `main`, not stacked on any feature branch).
- One commit per phase. Reviewers read it commit-by-commit.
- This document is updated as phases complete.
