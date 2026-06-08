# Phase 1 Data Model: Pipeline + the sdd-lean Preset

No database. The "data" here is the set of declarative artifacts (YAML manifests, markdown command bodies, config keys) and their fields/validation rules. Shapes follow the spec-kit `preset.yml` schema (`schema_version: "1.0"`) verified in `presets/lean/preset.yml` and `presets.py`.

## Entity: `sdd-lean` preset manifest (`preset.yml`)

Declares the bundle and its command overrides.

| Field | Type | Rule |
|-------|------|------|
| `schema_version` | string | MUST be `"1.0"`. |
| `preset.id` | string | MUST be `"sdd-lean"` (lowercase, hyphenated). |
| `preset.name` | string | Human label, e.g. `"SDD Lean"`. |
| `preset.version` | string | SemVer `X.Y.Z`. |
| `preset.description` | string | < 200 chars. |
| `preset.author` / `repository` / `license` | string | Provenance; `license: MIT`. |
| `requires.speckit_version` | string | Version floor; `">=0.8.5"` to match the extension floor. |
| `provides.templates[]` | list | One entry per override (see next entity). |
| `tags[]` | list | 2–5 discovery tags (`sdd`, `lean`, `no-user-stories`, `files-deps`). |

**Validation**: must pass `specify preset info`/`add` (which runs `PresetResolver` validation). Each `provides.templates[]` entry's `file` MUST exist relative to the preset root.

## Entity: command-override entry (`provides.templates[]` item)

| Field | Type | Rule |
|-------|------|------|
| `type` | enum | `"command"` for the four pipeline overrides. (`"template"` allowed if we also ship belt-and-suspenders doc templates.) |
| `name` | string | The command id being provided, e.g. `"speckit.specify"`. |
| `file` | path | Content file under the preset, e.g. `"commands/speckit.specify.md"`. MUST exist. |
| `description` | string | Short. |
| `replaces` | string | The core command id this overrides, e.g. `"speckit.specify"`. |
| `strategy` | enum | Omitted → `"replace"` (used here). One of `replace`/`prepend`/`append`/`wrap`. |

Four entries: `speckit.specify`, `speckit.plan`, `speckit.tasks`, `speckit.implement`, each `replaces` its core namesake with `strategy: replace`.

## Entity: SDD-lean command body (shared shape)

The markdown body each override (and each namespaced command) emits. This is the canonical definition of "SDD-lean shape," authored once and reused.

- **specify** → `spec.md`: Overview, Functional Requirements (testable), Success Criteria, Assumptions. **No user-story / user-scenario section.** Edge cases folded into requirements/assumptions.
- **plan** → `plan.md`: lean — Summary, Technical Context, a short structure/approach, explicit Out-of-Scope. No multi-phase research scaffolding unless needed.
- **tasks** → `tasks.md`: dependency-ordered checklist `- [ ] [Tn] …` organized by **files/dependencies** (foundational → per-file/module work → polish), **not** grouped under user stories.
- **implement** → executes `tasks.md` in dependency order; checklist semantics unchanged.

**Invariant (FR-005/SC-003)**: the namespaced `/speckit.companion.<stage>` body and the `sdd-lean` preset's `<stage>` override resolve to the **same** shape — enforced by sourcing both from one canonical body.

## Entity: project config (`.specify/sdd.config.yml`)

| Key | Type | Default | Rule |
|-----|------|---------|------|
| `features.sddLean` | boolean | `true` (Companion-managed) | Persisted source of truth (FR-010). `true` ⇒ preset added+enabled; `false` ⇒ preset removed (Research R2). |

Other future `features.*` keys may coexist; unknown keys preserved, never clobbered.

## Entity: VS Code setting (`speckit.features.sddLean`)

| Property | Value |
|----------|-------|
| Location | root `package.json` → `contributes.configuration` |
| Type | `boolean` |
| Default | `true` |
| Effect | On change/activation, the extension reconciles the preset: `true` → `preset add`+`enable`; `false` → `preset remove`. Writes through to `.specify/sdd.config.yml`. |

## Entity: namespaced command (extension-provided)

Four files under `speckit-extension/commands/` declared in `extension.yml` `provides.commands`:

| Command id | File |
|------------|------|
| `speckit.companion.specify` | `commands/speckit.companion.specify.md` |
| `speckit.companion.plan` | `commands/speckit.companion.plan.md` |
| `speckit.companion.tasks` | `commands/speckit.companion.tasks.md` |
| `speckit.companion.implement` | `commands/speckit.companion.implement.md` |

Each is the opt-in path (User Story 2), independent of preset state, emitting the shared SDD-lean body.

## State / lifecycle

- **Not installed** → stock spec-kit shape (user stories present).
- **`preset add sdd-lean`** (or `features.sddLean: true`) → stock pipeline commands replaced; SDD-lean shape on next run.
- **`preset disable sdd-lean`** → template-type overrides skipped at resolution, but command overrides persist (Research R2) — partial revert only.
- **`preset remove sdd-lean`** (or `features.sddLean: false`) → registered command overrides cleaned up; stock shape restored on next run.
- Namespaced `/speckit.companion.*` commands are unaffected by all of the above — always available, always SDD-lean.
