# Implementation Plan: Companion home in the Steering view

## Summary

Add a **Companion** group node to the Steering tree (`SteeringExplorerProvider`) that surfaces install state, the Companion configuration file's setting groups, and the installed extension's command set. Install state is read with the existing `isCompanionInstalled()` helper (on-disk `.specify/extensions/companion/` presence) and the existing `speckit.companion.installed` context key; the install action reuses the existing `speckit.companion.installSpecKitExtension` command. The command list is parsed at runtime from the installed manifest (`.specify/extensions/companion/extension.yml` → `provides.commands`) with the already-bundled `js-yaml`, so the host extension carries no hand-maintained command list and stays correct when `speckit-extension/` is absent (it is, in the packaged `.vsix`). A new `assets/icons/moss.svg` is wired as the node's installed icon.

## Project Structure

```
src/
  core/constants.ts                              # add companion-* TreeItemContext values
  features/steering/steeringExplorerProvider.ts  # Companion node + Configuration/Commands children + watcher
  features/steering/companionSteering.ts         # new: read companion.yml top-level keys + installed manifest commands (testable, no vscode)
  features/steering/companionSteering.test.ts    # new: unit tests for the readers + within-root path guard
assets/icons/moss.svg                            # new icon asset
package.json                                      # inline install menu entry (view/item/context)
docs/sidebar.md                                   # Steering section update
README.md                                         # Sidebar at a Glance update
```

**Structure Decision**: Keep the tree wiring in `steeringExplorerProvider.ts` (matching the agents/skills/speckit groups), but factor the file-reading and parsing logic into a small `companionSteering.ts` module with no `vscode` dependency so it is unit-testable (the provider itself reads live `vscode.workspace` config and stays review-only, per the known config-mock gap).

## Constitution Check

No project constitution file (`.specify/memory/constitution.md`) defines binding principles for this change; the governing rules are the repo `CLAUDE.md` conventions and `.claude/review-checklist.md`, which this plan honors:

| Principle (from CLAUDE.md / checklist) | Assessment |
|---|---|
| Extension isolation — no runtime dependency on `speckit-extension/` or `.specify/**` existing | PASS — reads the *installed* manifest only when installed; degrades silently when absent |
| Gate companion UI on `isCompanionInstalled()` at every site (#218/#234) | PASS — single gate drives node icon/description and child presence |
| User-config path joined for open must be validated within workspace root (#380) | PASS — Configuration open target validated within root; out-of-root entries dropped |
| `collapsibleState` must reflect real children (#380) | PASS — not-installed node is `None`; installed node `Collapsed` |
| Reuse existing command/key, no new detection or install command | PASS — reuses `speckit.companion.installSpecKitExtension` + `speckit.companion.installed` |

## Phase 0 — Research

See `research.md` for the key decisions (commands source, badge mechanism, config-group derivation, path-guard, refresh).

## Phase 1 — Design

See `data-model.md` for the node/group/item shapes. No external API or schema contract is exposed; the "contract" is the tree structure and the reused identifiers recorded in the spec's Verbatim Constraints, so no `contracts/` directory is needed.
