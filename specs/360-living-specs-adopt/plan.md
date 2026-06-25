# Implementation Plan: Brownfield Adoption Wizard (Living Specs LS·5)

## Summary

Add an opt-in brownfield adoption wizard to the spec-kit extension. The user-facing surface is a new markdown command, `speckit.companion.adopt`, whose body is runtime prose that the AI executes: it points at one code area, proposes capabilities scoped to that area, drafts a surface-first living spec per capability (marked `[DRAFT]`, requirements tagged `observed`/`inferred`, low-confidence items flagged `[NEEDS CLARIFICATION]`, unreadable files under `## Uncovered`), and registers each confirmed capability into `.specify/companion.yml`. The deterministically-buildable parts are the command structure and a Python registry-append helper (`register-capability.py`) that appends one capability to `livingSpecs.capabilities[]` idempotently, reusing the LS·1 `companion_config.py` reader so it never corrupts existing config. The new command is registered in `extension.yml` `provides.commands`, and the spec-kit extension's own README/CHANGELOG + version are bumped (not the root ones).

## Project Structure

```
speckit-extension/
├── commands/
│   └── speckit.companion.adopt.md        # NEW — the wizard command body (runtime AI prose)
├── scripts/
│   ├── register-capability.py            # NEW — deterministic registry-append helper
│   └── companion_config.py               # reused — reader the helper builds on
├── tests/
│   └── test_living_specs.py              # EXTENDED — append registry-append tests
├── extension.yml                         # MODIFIED — add command + bump version
├── README.md                             # MODIFIED — document the adopt command
└── CHANGELOG.md                          # MODIFIED — release note

examples/todo-claude/bench/living-specs/
├── ls-lib.mjs                            # EXTENDED — bake LS5 fixture + run register helper
├── ls-demos.mjs                          # EXTENDED — runLs5() demo runner
└── evidence/LS5.json                     # NEW — captured evidence (deterministic + INCONCLUSIVE live-draft)
```

**Structure Decision**: The wizard is a spec-kit-extension feature, so everything lives under `speckit-extension/` (command, script, tests, manifest, docs) plus the bench demo under `examples/todo-claude/bench/living-specs/`. No `src/` (VS Code extension) change — adoption is a CLI-dispatched command and a Python helper, consistent with LS·1–4 which were all extension-side.

## Constitution Check

No `.specify/memory/constitution.md` is present in this repo, so there is no formal constitution gate. The repository's standing rules in `CLAUDE.md` apply instead and are honored:

| Rule | Assessment |
|------|------------|
| Two extensions, two docs — a `speckit-extension/` change updates ITS README/CHANGELOG + `extension.yml` version, not root | PASS — plan bumps `speckit-extension` only |
| Extension isolation — extension behavior lives in shipped code/prompt, not `.claude`/`.specify` user files | PASS — command body + Python script ship in the `.vsix`/catalog |
| New command must be in `extension.yml` `provides.commands` or installer skips it | PASS — FR-014 |
| Evidence is repo-relative, captured never authored | PASS — bench helpers record repo-relative; live-draft stays INCONCLUSIVE |

No violations — Complexity Tracking omitted.

## Phase 0 — Research

See [research.md](./research.md) for the key decisions (command-vs-script split, append-vs-rewrite strategy, idempotency key, malformed-config handling, and the live-draft honesty boundary).

## Phase 1 — Design & contracts

- [data-model.md](./data-model.md) — the Capability entity, the drafted-spec document shape, and the registry block.
- [contracts/register-capability.md](./contracts/register-capability.md) — the CLI contract for the registry-append helper (flags, exit codes, idempotency).
- [contracts/adopt-command.md](./contracts/adopt-command.md) — the drafted-spec structure contract the command must produce.
