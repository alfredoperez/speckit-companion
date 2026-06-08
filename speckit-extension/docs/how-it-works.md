# How it works

The extension lives beside the VS Code GUI in the monorepo and is published/installed independently. At runtime it does **not** read or depend on the GUI — it only writes the canonical `.spec-context.json` the GUI already consumes.

```
/speckit.specify  →  after_specify hook  →  speckit.companion.capture.md  →  write-context.py  →  .spec-context.json  →  Companion GUI re-renders
```

(The command/hook layer is documented in [commands.md](./commands.md).)

## The writer (`scripts/write-context.py`)

A stdlib-only Python script that does a crash-safe **read-merge-write** of the active feature's `.spec-context.json`:

- **Preserves** every existing/unknown top-level key (e.g. Companion-owned `reviewComments`) — never clobbers.
- **Append-only** canonical `history[]` (`by: "extension"`, explicit `kind`); `from` is the prior `{step, substep}` on a `start` entry. A legacy `transitions[]` array is migrated forward into `history[]` so the extension and the VS Code GUI write the same single field.
- **Never regresses** a more-advanced spec: if the target is already at a later step or a terminal status (`implemented`/`completed`/`archived`), it's left untouched — this prevents a stray hook from dragging a shipped spec backward.
- **Atomic:** writes a temp file then `os.replace()`.
- Writes Companion-canonical values (e.g. `currentStep: "specify"`, `status: "specified"`); **never** the legacy `currentStep: "done"`.

## Active-directory resolution

The writer resolves which feature dir to update using spec-kit's order, most-specific first:

`--feature-dir` → `SPECIFY_FEATURE_DIRECTORY` env → `SPECIFY_FEATURE` env → `.specify/feature.json` → current git-branch numeric prefix.

It never falls back to "most-recently-modified dir containing `tasks.md`."

## Canonical schema

The data contract has a single source of truth: `src/core/types/spec-context.schema.json` (mirrored by the TypeScript types in `src/core/types/specContext.ts`). The writer targets that shape directly — **no vendored copy, no cross-repo reconciliation** — and writes the same canonical `history[]` field the GUI itself writes, so the two never deviate. v1 added `"implemented"` to the `status` enum; the lifecycle step added `"derive"` to the `historyEntry.by` enum (for derive-from-files captures).

## End-to-end proof

The migration rests on one agent-mediated chain: *spec-kit command → agent runs our hook → script writes `.spec-context.json` → Companion GUI re-renders.* Reproduce it:

### A. Script + resolution (deterministic — no GUI)

```bash
mkdir -p specs/_zzz-proof-demo && printf '# Spec: Proof Demo\n' > specs/_zzz-proof-demo/spec.md
python3 .specify/extensions/companion/scripts/write-context.py --feature-dir specs/_zzz-proof-demo \
  --step specify --status specified --by extension
cat specs/_zzz-proof-demo/.spec-context.json   # currentStep=specify, status=specified, history[].by=extension
rm -rf specs/_zzz-proof-demo
```

Expected: a valid canonical `.spec-context.json` with `currentStep: "specify"`, `status: "specified"`, and a single `history` entry `{ "kind": "start", "by": "extension", "from": { "step": null, "substep": null } }`. Re-running appends a second entry (with `from` set) and preserves any pre-existing keys.

### B. Live hook + GUI

1. Install the extension ([install.md](./install.md)) and open the repo with the SpecKit Companion VS Code extension enabled.
2. Run a real `/speckit.specify "throwaway proof feature"` in your agent.
3. Let the `after_specify` hook run `speckit.companion.capture` (it auto-runs at `optional: false`).
4. Confirm `specs/<NNN>-<slug>/.spec-context.json` carries `currentStep: specify` / `status: specified` / a `by: extension` transition, and the Companion sidebar renders it at **specify / specified** — no GUI code change.
5. Clean up: delete the throwaway spec; optionally `specify extension remove companion`.

**Verified 2026-05-25:** one real `/speckit.specify` auto-fired the hook (no nudge) and wrote a canonical file with `workflow: "speckit"` (a plain spec-kit flow, no SDD). See [../ROADMAP.md](../ROADMAP.md#step-1--whats-proven).
