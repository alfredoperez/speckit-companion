# Verification evidence

Recorded 2026-08-19 on branch `fix/582-footer-next-step`.

## FR-006 — no "shorts" ships in either distribution

| Surface | Command | Result |
| --- | --- | --- |
| Working tree | `grep -ril shorts .` (excluding `node_modules`, `.git`, `out`, `dist`) | 0 matches |
| Spec-kit extension source | `grep -ril shorts speckit-extension/` | 0 matches |
| Packaged VS Code artifact — filenames | `unzip -l speckit-companion-0.31.5.vsix \| grep -i shorts` | 0 matches |
| Packaged VS Code artifact — file contents | unpacked and searched | 0 matches |
| Extension freshly installed into a clean sandbox | `grep -ril shorts .specify/extensions/` | 0 matches |
| Declared commands | `speckit-extension/extension.yml` | 18 commands, none named `shorts` |

The short-form video tooling lives at `~/.claude/skills/speckit-companion-shorts` — a personal skill in the user's global Claude directory, outside this repository. It has never been in either distribution, so nothing needed removing.

## FR-007 — capture works from a genuinely fresh install

Nothing was copied from an existing installation. Each step below ran for real, in order, in a disposable sandbox at `examples/bench-sandboxes/582-fresh-install` (gitignored).

**1. Fresh SpecKit install**

```
specify init 582-fresh-install --integration claude --ignore-agent-tools --script sh
```

CLI version `0.12.16.dev0`. Produced `.specify/` (integrations, memory, scripts, templates, workflows) and `.claude/skills/` with 10 stock spec-kit skills. No `.specify/extensions.yml` and no `.specify/extensions/` — a clean stock install with the companion extension absent.

**2. Constitution — run before the extension was installed**

Filled `.specify/memory/constitution.md` from the template: 5 principles, 2 additional sections, governance, version `1.0.0`. Zero placeholder tokens left. Committed to the sandbox's own git repository.

No hooks fired, correctly — `.specify/extensions.yml` did not exist yet, and the constitution skill's pre-execution check skips silently in that case.

**3. Fresh extension install — from the released artifact, not a copy**

```
specify extension add companion --from https://github.com/alfredoperez/speckit-companion/releases/download/companion-latest/companion.zip
```

The CLI showed its untrusted-source warning and required confirmation, then installed **SpecKit Companion v0.20.1** — 18 commands, 4 hooks, priority 10, enabled. It created `.specify/extensions.yml` with the companion hook registrations and installed 18 `speckit-companion-*` skills into `.claude/skills/`.

Worth noting: `specify extension search companion` finds the extension in the **community** catalog, which is discovery-only and still advertises **v0.11.0** while the shipped artifact is **v0.20.1**. The `--from` URL is the working install path, and the community catalog entry is stale.

**4. Status flow**

| Situation | Output |
| --- | --- |
| Fresh install, no spec at all | `[companion] Could not resolve the active feature directory … Skipping status.` — exits 0, degrades cleanly |
| After a captured specify step | `Spec: add a todo (source: state)` / `Step: specify  Status: specified` / `Next: Plan the feature` |
| A spec directory with only `spec.md` + `plan.md`, no recorded context | `(source: derived)` / `Step: plan  Status: planned` / `Next: Generate tasks` |
| Same directory once `tasks.md` appears | `(source: derived)` / `Step: tasks  Status: ready-to-implement` / `Next: Implement` |

Capture and status both work end to end from nothing. Note that the recorded case reports **Next: Plan** on a freshly specified spec — the same expectation this feature fixes in the viewer footer.

### Defect found by this test

The status resolver picks the Companion command family off a field nothing writes any more. It checks the legacy per-spec `profile` for the value `turbo`, but that field was retired in the workflow-choice collapse — `specContext.ts` documents it as legacy and "no longer written or read for dispatch", and the writer now records `workflow: companion` instead. Nothing sets `profile`, so the check is never true and the companion command table is unreachable.

Observed on the fresh install: a spec recorded with `workflow: companion` reports `Next: Plan the feature → /speckit.plan` — the stock command, not `/speckit.companion.plan`. The same resolver output drives `/speckit.companion.resume`, so resuming a Companion run dispatches the stock pipeline and drops the Companion behavior.

This is the same failure as the reported footer bug, one surface over: a built-in Companion workflow not being recognized as Companion. Fixed here in Phase 8.

**After the fix**, with the rebuilt extension reinstalled into the same fresh sandbox:

| Spec | Reported next action |
| --- | --- |
| `workflow: companion` | `Next: Plan the feature → /speckit.companion.plan` |
| stock (`workflow: speckit`) | `Next: Implement → /speckit.implement` |

A spec carrying the retired `profile: turbo` still resolves to the Companion family, so nothing written before the workflow-choice collapse regresses.

### Residual note

Derived status names the spec from the document rather than the directory — a spec directory `002-derived` reports `Spec: spec`. Cosmetic, out of scope for this feature, not filed.
