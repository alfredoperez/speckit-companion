# Tasks — `/speckit.companion.auto`

Dependency-ordered. `[P]` = independent (different files, no open dependency).

## spec-kit extension — command body

- [x] **T1** Add the `unattended` shared part — `speckit-extension/presets/_parts/unattended.md` (don't-pause convention for hook authors).
- [x] **T2** Create `nodes/auto/_frame.md` (description + User Input + Outline lead-in).
- [x] **T3** Create `nodes/auto/_order.yml` (resolve-dir → orchestrate → handoff).
- [x] **T4** Create `nodes/auto/resolve-dir.md` (fresh-spec entry; record specify START).
- [x] **T5** Create `nodes/auto/orchestrate.md` (the no-pause loop; set `unattended: true`; degrade on one-shot).
- [x] **T6** Create `nodes/auto/handoff.md` (timing part + unattended part fences).
- [x] **T7** Append `"auto"` to `NAMESPACED_CMDS` in `scripts/_command_parts.py`.
- [x] **T8** Run `assemble-nodes.py` to write `commands/speckit.companion.auto.md`; confirm `--check` flags only the missing-golden auto entry.
- [x] **T9** Bless golden: `capture-golden.py`; re-run `--check` (clean) + `check-shape-parity.py`.
- [x] **T10** Register `speckit.companion.auto` in `extension.yml` `provides.commands`; bump `extension.version`.

## VS Code extension — GUI Run entry

- [x] **T11** [P] Add the `submitAuto` message variant to `webview/src/spec-editor/types.ts`.
- [x] **T12** Add the **Run** button to the Create Spec footer HTML in `specEditorProvider.ts`; handle the `submitAuto` message → dispatch `speckit.companion.auto` via `resolveDispatchForRoot` through `handleSubmit`.
- [x] **T13** Wire the Run button click → post `submitAuto` in `webview/src/spec-editor/index.ts`.
- [x] **T14** [P] Register the `speckit.companion.auto.run` command in `package.json` `contributes.commands`.

## Docs

- [x] **T15** [P] Update `speckit-extension/README.md` + `speckit-extension/CHANGELOG.md` (auto command + unattended convention, user-facing voice).
- [x] **T16** [P] Update root `README.md` (the Create Spec **Run** entry).

## Verify

- [x] **T17** `npm run compile && npm test`, `assemble-nodes.py --check`, `check-shape-parity.py` — all green.
