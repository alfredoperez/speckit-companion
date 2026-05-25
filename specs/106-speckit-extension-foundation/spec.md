# Spec: SpecKit Companion spec-kit Extension — Foundation & State-Write Spike

**Slug**: 106-speckit-extension-foundation | **Date**: 2026-05-24

## Summary

Stand up a new `speckit-extension/` in this monorepo (beside the VS Code GUI) and prove the single riskiest assumption behind the whole spec-kit migration: that a spec-kit lifecycle hook can write `.spec-context.json` and the Companion GUI picks it up live. The deliverable is intentionally tiny — one `extension.yml`, one `after_specify` hook, one command-markdown, one Python writer script, a minimal canonical-schema alignment — wired into `.specify/extensions.yml` and proven end-to-end by running a real `/speckit.specify` and watching the GUI light up. This is the de-risking spike that everything in Steps 2+ builds on (see `sdd` repo spec `024-speckit-extension-foundation` R001–R008, R013–R014; ADR 0003).

## Requirements

### Foundation & home

- **R001** (MUST): The spec-kit extension lives in this repo under `speckit-extension/`, beside the VS Code extension (monorepo). It does not relocate or depend on the GUI code at runtime.
- **R002** (MUST): Ship a `speckit-extension/extension.yml` valid against spec-kit's extension schema, mirroring the bundled `git` extension's shape (`schema_version`, `extension`, `requires`, `provides.commands`, `hooks`). Extension `id` is `companion`, so the command is namespaced `speckit.companion.capture`.
- **R003** (MUST): Declare version floors in `requires.speckit_version` — at minimum the spec-kit release that wired the `after_specify`/`after_plan` lifecycle hooks (and `>=0.8.5` for the workflow `integration: auto` path the later phases need). The exact floor string is recorded in the plan.

### Hook-driven state capture (one hook only)

- **R004** (MUST): Register exactly one lifecycle hook — `after_specify` → `speckit.companion.capture` — in `speckit-extension/extension.yml`. No other lifecycle hooks are registered in this spike.
- **R005** (MUST): Ship one command-markdown (`speckit-extension/commands/speckit.companion.capture.md`) that instructs the agent to run the writer script, mirroring spec-kit's bundled `git` extension pattern (hook → command-markdown → "run this script"). It carries no business logic itself beyond resolving inputs and invoking the script.
- **R006** (MUST): Ship a Python writer script (`speckit-extension/scripts/write-context.py`) that creates or updates `specs/<NNN>-<slug>/.spec-context.json` for the active feature, writing Companion-canonical values: `currentStep: "specify"`, `status: "specified"`, and an appended `transitions[]` entry with `by: "extension"`.
- **R007** (MUST): The writer resolves the active feature directory using spec-kit's resolution order — `SPECIFY_FEATURE_DIRECTORY` env → `.specify/feature.json` → branch-name prefix — and never falls back to "most-recently-modified dir containing `tasks.md`."
- **R008** (MUST): The writer is read-then-merge: it preserves all existing/unknown top-level keys, appends to `transitions` (never rewrites or shrinks it), and writes atomically (temp file + rename). On first write for a feature it initializes `transitions` with a `from: null` entry; on update it sets `from` to the prior `{step, substep}`.
- **R009** (MUST): The writer never emits the legacy `currentStep: "done"`; terminal state is expressed only via `status`. Step values stay within the canonical set (`specify`, `clarify`, `plan`, `tasks`, `analyze`, `implement`).

### Canonical schema (owned in this repo)

- **R010** (MUST): The extension reads/writes this repo's canonical `src/core/types/spec-context.schema.json` directly — no vendored copy, no second schema under `speckit-extension/`.
- **R011** (SHOULD): Align the canonical JSON schema with the canonical TypeScript `Status` type backward-compatibly — specifically add the missing `implemented` value to the schema's `status` enum so terminal state validates (the TS `Status` already has it). This is the only schema change in scope; all other fields the `after_specify` writer emits (`currentStep`, `status: specified`, `transitions[].by: extension`, `stepHistory`) are already covered.

### Constraints carried from ADR 0003

- **R012** (MUST): `.sdd.json` remains SDD's own config; this spike adds nothing to it. spec-kit's `extensions.yml` carries only the thin `after_specify` hook registration that triggers the script.
- **R013** (MUST): Branch creation is NOT added here — it defers to spec-kit's bundled `git` extension (`before_specify: speckit.git.feature`). The companion extension registers no branch hook.

### End-to-end proof

- **R014** (MUST): Register the hook in this repo's `.specify/extensions.yml` (a checked-in manual-testing fixture) so a real `/speckit.specify` triggers `speckit.companion.capture`. The `companion` entry is added to `installed` and the `after_specify` hook list, alongside the existing `git` registration, without removing or breaking `git`.
- **R015** (MUST): Demonstrate the chain end-to-end: run a real spec-kit `specify`, confirm `.spec-context.json` is written/updated with the canonical values, and confirm the SpecKit Companion GUI renders the correct step (`specify`) and status (`specified`) with no change to GUI code. The validation procedure and its result are recorded (in the plan / PR description).

## Scenarios

### Companion lights up on a real spec-kit specify

**When** a developer with the `companion` extension registered runs `/speckit.specify "<some feature>"` on Claude Code
**Then** the `after_specify` hook runs `speckit.companion.capture`, the writer creates/updates that feature's `.spec-context.json` with `currentStep: "specify"` / `status: "specified"` / a `by: "extension"` transition, and the Companion GUI shows that spec at the **specify** step with **specified** status — no GUI code change.

### Re-running specify preserves history

**When** the hook fires a second time for the same feature (e.g. the spec is regenerated)
**Then** the writer appends a new `transitions[]` entry (with `from` set to the prior state) rather than rewriting the array, and preserves every pre-existing top-level key (including any Companion-owned fields like `reviewComments`).

### Active-dir resolution is unambiguous

**When** multiple feature directories exist under `specs/`
**Then** the writer targets the dir resolved by spec-kit's order (env → `.specify/feature.json` → branch prefix), not the most-recently-touched dir — so the correct feature is updated even when several have `tasks.md`.

### Write is crash-safe

**When** the writer is interrupted mid-write
**Then** the existing `.spec-context.json` is never left truncated or partially written, because the writer writes to a temp file and atomically renames over the target.

### Git extension still owns branching

**When** both the bundled `git` extension and `companion` are registered
**Then** `before_specify: speckit.git.feature` still creates the feature branch and `companion` adds only the `after_specify` capture — no double-branching, no hook collision.

## Non-Functional Requirements

- **NFR001** (MUST): Writes to `.spec-context.json` are atomic (temp + rename) and `transitions` are append-only, matching the Companion's existing write contract.
- **NFR002** (SHOULD): The extension is agent-agnostic at the file level; the single Python script runs anywhere `python3` is available (spec-kit's own CLI is Python). No Claude-only payload is required for this spike.
- **NFR003** (SHOULD): The canonical-schema change ships in the same change as the writer that depends on it (docs/schema-forward), per the repo's Docs Sync Rule.

## Out of Scope

Deferred to later phases (noted, not built here):

- The other lifecycle hooks (`after_plan`, `after_tasks`, `after_implement`) and their captures.
- The derive-from-files fallback (reconstructing state when hooks didn't fire).
- `/speckit.companion.status` and `/speckit.companion.resume` commands.
- Pipeline commands (`/speckit.companion.specify|plan|tasks|implement`), templates/presets, complexity detection, living-specs/drift, auto-mode workflow.
- Any change to the SpecKit Companion GUI beyond the single `status`-enum schema alignment in R011.
- A second publish target / catalog packaging (the spec-kit catalog publish is a later step).
