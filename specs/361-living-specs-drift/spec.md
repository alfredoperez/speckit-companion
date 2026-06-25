# Living Specs — Drift command (LS·6)

**Issue:** #366 · **Surface:** spec-kit extension (`id: companion`) · **Depends on:** #361 (LS·1 resolver, merged) · **Opt-in (OFF by default).**

## What it does

When you adopt a code area into a living spec, the spec only stays honest if every later change to that area flows back into it. In practice, code keeps moving while the living spec sits still — and there's no cheap way to notice. The drift command closes that gap. For each capability you've configured, it reports the source files that changed *since the living spec was last committed*, and tells you **how** each one slipped: was it changed through the Companion pipeline but never folded back (a missed sync), or did it change entirely outside the pipeline (the spec never saw it at all)?

It is a read-only report. It never edits anything and it never fails the build — it always exits success, so a surrounding workflow or CI can decide whether to treat findings as a gate, but the command itself stays out of that decision. When a capability has no changes since its spec, it reads as in-sync; when every capability is in sync, the command prints a single all-clear line. With living specs turned off (or no config at all) it reports nothing and exits clean.

## Requirements

### Functional

- **FR-001** A `speckit.companion.drift` command MUST, for each configured capability, report the source files that changed since that capability's living spec (`capabilities/<name>/spec.md`) was last committed.
- **FR-002** Each drifted file MUST be classified as either `tracked` (the file appears in some `specs/*/.spec-context.json` changed/modified set since the spec's commit — a missed fold/sync) or `unspeced` (changed entirely outside the pipeline).
- **FR-003** The command MUST respect an exempt-glob list, read from `livingSpecs.exempt` in config, defaulting to `["*.config.*", "*.test.*", "**/migrations/**"]`. Exempt files MUST NOT appear in any drift list.
- **FR-004** The command MUST NEVER halt — it always exits with success (exit 0), even when it finds `unspeced` drift. The surrounding workflow/CI owns the gating decision.
- **FR-005** A capability with no changes since its spec MUST read as in-sync. When every capability is in sync, the command MUST print a single all-clear line and nothing else.
- **FR-006** A capability whose living spec is not yet committed (untracked) MUST be skipped with an informational note, not treated as drift.
- **FR-007** The deterministic logic MUST live in a Python script that reuses the LS·1 resolver (`resolve-spec-paths.py`) for capability membership and git for change detection (`git log -n1 --format=%H -- <spec>`, `git diff --name-only <commit>..HEAD`). A thin `speckit.companion.drift.md` command invokes it.
- **FR-008** The command MUST be registered in `extension.yml` `provides.commands` (otherwise the installer skips it).

### Opt-in / safety

- **FR-009** With living specs disabled (`livingSpecs.enabled` unset/false) or no config present, the command MUST report nothing and exit 0 (the LS·1 inert contract).
- **FR-010** The script MUST anchor all git operations to the target `--root` repo (per the lifecycle-state checklist lesson), not cwd.

## How to test

A baked sandbox (mode = `deterministic` — pure git + resolver, no AI) configures a `todos` capability, commits `capabilities/todos/spec.md`, then commits a modified source file under `src/todos/` *after* the spec. Running the drift script asserts: that file is reported `unspeced` for `todos` and the script exits 0; an in-sync capability reports all-clear; an exempt file is filtered out; a `tracked` change (recorded in a `.spec-context.json` changed set) is classified `tracked`. Evidence captured to `examples/todo-claude/bench/living-specs/evidence/LS6.json`.

## Out of scope

- Live AI involvement (drift is deterministic).
- GUI surfacing of drift (LS·7).
- Auto-folding drift back into the spec (the report points at `/speckit.companion.adopt` / a delta spec; it does not write).
