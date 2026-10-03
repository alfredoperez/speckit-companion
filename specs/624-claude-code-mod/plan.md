# Implementation Plan: SpecKit Companion mod for Claude Code

**Branch**: `feat/820-claude-code-mod` | **Date**: 2026-10-03 | **Spec**: [claude-code-mod.spec.md](./claude-code-mod.spec.md)

> **Scale note**: about 20 files across three areas: a new plugin (`apps/claude-mod/`), a refactor of the Copilot board's reader (`apps/copilot-canvas/`), and docs plus CI. Watch the refactor: the canvas tests must stay green, because the point is that both surfaces run the same rules.

## Summary

Ship a Claude Code mod that draws the followed spec's run as a band above the prompt and a pane beside the transcript, with a `/spec` command to list and switch specs and a text reply where nothing draws. A hooks module cannot import outside its plugin or use Node, so the Copilot board's pure rules (status labels, step badges, the file-only fallback, task parsing, spec lookup, and the timing derivation bundled from the VS Code source) move out of `specs-core.mjs` into a pure `spec-rules.mjs`, and a build step bundles that module into the plugin as `hooks/vendor/board-rules.mjs`. The mod does its own file reads through `$.fs` and hands the text to those shared functions, so the board, the viewer and the mod derive the same states and times. CI's staleness check grows to cover the new bundle and the generated test fixtures.

## Project Structure

```text
.claude-plugin/marketplace.json            # new: repo-root marketplace listing the plugin
apps/copilot-canvas/
├── spec-rules.mjs                         # new: pure rules moved out of specs-core.mjs
├── specs-core.mjs                         # IO only; re-exports the rules it used to define
└── overview.mjs                           # timing section reads phaseTimings() from spec-rules
apps/claude-mod/
├── .claude-plugin/plugin.json             # name speckit-companion, 0.1.0
├── build.mjs                              # bundles spec-rules into hooks/vendor, writes test fixtures
├── hooks/
│   ├── hooks.json                         # { "modules": ["./register.js"] }
│   ├── register.js                        # every $ call: reads, timer, /spec, band, pane
│   ├── board.js                           # pure view logic: band line, pane model, list text
│   └── vendor/board-rules.mjs             # generated
├── tests/
│   ├── fixtures/demo-specs.js             # generated from specs/_0N_demo-*
│   ├── board.test.ts                      # band text and list text, pure
│   └── mod.test.ts                        # /spec switching, fallback, real record, pane draw
├── README.md
└── .gitignore                             # .claude-plugin/types/, tsconfig.json written by Claude Code
.github/workflows/ci.yml                   # staleness check covers apps/claude-mod/hooks/vendor and tests/fixtures
package.json                               # mod:build and test:mod scripts; test:canvas also rebuilds the mod bundle
.vscodeignore                              # apps/claude-mod/** stays out of the .vsix
.claude/skills/release-qa/surface-map.yml  # new surface: Claude Code mod
apps/website/src/content/docs/docs/guides/claude-code.mdx  # new guide page
CHANGELOG.md, docs/doc-sync.md, docs/architecture.md, CLAUDE.md  # one line or paragraph each
```

`PIPELINE_STEPS` moves into `spec-rules.mjs`, which also breaks today's import cycle between `specs-core.mjs` and `overview.mjs`. Every name the canvas tests import stays exported from its current module. The plugin tests run through `claude plugin test`, which CI cannot run without the Claude Code binary, so CI runs the canvas suites and the staleness check, and `npm run test:mod` runs the plugin tests locally.

**Structure Decision**: the plugin is self-contained under `apps/claude-mod/` (Claude Code copies the directory on install), and the only code it shares with the board arrives as a generated bundle, the same pattern the canvas already uses for the viewer's code.

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | PASS. Honors `speckit.specDirectories` like the board; no provider logic. |
| II. Spec-Driven Workflow | PASS. Shows the specify → plan → tasks → implement pipeline and lifecycle status read from the run record; writes nothing, infers no transitions. |
| III. Visual and Interactive | PASS. A pane and a band, with buttons to switch specs. |
| IV. Modular Architecture | PASS. IO in `register.js`, view logic in `board.js`, shared rules in a generated bundle. |
| AI Provider Integration | PASS. Not touched. |
| User Interface | PASS. Uses the canonical status labels and lifecycle grouping from the shared rules. |

Re-checked after Phase 1 design: unchanged.
