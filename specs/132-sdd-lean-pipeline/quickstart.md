# Quickstart: the sdd-lean Preset + namespaced pipeline

Prove the SDD-lean shape end-to-end. Assumes a GitHub-source spec-kit CLI (`specify extension --help` / `specify preset --help` both work) and a project initialized with `specify init`.

## 1. Install the preset (and the namespaced commands)

```bash
# From the repo root
specify extension add ./speckit-extension --dev          # ships /speckit.companion.* commands
specify preset add --dev ./speckit-extension/presets/sdd-lean   # the sdd-lean preset
specify preset list                                       # sdd-lean present + enabled
specify preset resolve speckit.specify                    # winning layer = sdd-lean
```

## 2. Preset path — stock command yields the SDD shape (User Story 1 / SC-001)

```bash
/speckit.specify "Add a thing"      # stock command, now reshaped by the preset
```

Expect `spec.md` with Overview / Functional Requirements / Success Criteria / Assumptions and **no user-story section**. Then `/speckit.plan` (lean) and `/speckit.tasks` (checklist organized by files/dependencies, not user stories).

## 3. Opt-in path — namespaced commands (User Story 2 / SC-003)

```bash
specify preset disable sdd-lean      # even with the preset off…
/speckit.companion.specify "Add a thing"
```

Expect the same SDD-lean shape (no user stories) — the namespaced command is independent of preset state. Compare its section headings to step 2's output: they match.

## 4. Toggle off — stock shape returns (FR-007 / SC-004)

```bash
specify preset remove sdd-lean       # full off (remove, not just disable — Research R2)
/speckit.specify "Add a thing"
```

Expect the **stock** spec-kit template, user-story section present, no residual SDD-lean sections. (Via the GUI: set `speckit.features.sddLean` to `false`, which writes `.specify/sdd.config.yml` and runs `preset remove`.)

## 5. Composition determinism (SC-005)

```bash
specify preset add lean --dev <path>         # a second preset that also replaces speckit.specify
specify preset set-priority sdd-lean 5       # lower number = higher precedence
specify preset resolve speckit.specify       # sdd-lean wins, deterministically
```

## Default for Companion-managed projects (FR-008)

A project created/managed by the Companion install scaffolding ships with `.specify/sdd.config.yml` → `features.sddLean: true` and the `sdd-lean` preset already added, so steps 1–2 are the out-of-the-box state.

## Done-when check

- [ ] Stock `/speckit.specify` (preset on) → no user-story section.
- [ ] `/speckit.companion.specify` → same SDD-lean shape, preset on or off.
- [ ] `preset remove` / setting `false` → stock shape returns.
- [ ] `preset resolve` shows deterministic winner under composition.
