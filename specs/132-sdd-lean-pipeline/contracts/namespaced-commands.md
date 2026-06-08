# Contract: namespaced `/speckit.companion.*` pipeline commands

**Files**: `speckit-extension/commands/speckit.companion.{specify,plan,tasks,implement}.md`, declared in `speckit-extension/extension.yml` `provides.commands`.

## extension.yml additions

```yaml
provides:
  commands:
    - name: speckit.companion.specify
      file: commands/speckit.companion.specify.md
      description: "Opt-in SDD-lean specify — spec.md with no user-story section"
    - name: speckit.companion.plan
      file: commands/speckit.companion.plan.md
      description: "Opt-in SDD-lean plan — lean plan.md"
    - name: speckit.companion.tasks
      file: commands/speckit.companion.tasks.md
      description: "Opt-in SDD-lean tasks — files/dependencies axis"
    - name: speckit.companion.implement
      file: commands/speckit.companion.implement.md
      description: "Opt-in SDD-lean implement"
```

> A command absent from `provides.commands` is skipped by the installer — all four MUST be listed.

## Per-command body (shared SDD-lean shape)

Each command file's body is sourced from the one canonical SDD-lean body per stage (same source as the preset's `commands/speckit.<stage>.md`), so output shape is byte-for-shape identical to the preset path.

- `speckit.companion.specify` → writes `<feature_dir>/spec.md`: Overview, Functional Requirements, Success Criteria, Assumptions. **No user-story / user-scenario section.**
- `speckit.companion.plan` → writes `plan.md` in lean form.
- `speckit.companion.tasks` → writes `tasks.md` as a dependency-ordered checklist organized by files/dependencies, not user stories.
- `speckit.companion.implement` → executes `tasks.md` in dependency order.

## Acceptance

- After `specify extension add ./speckit-extension --dev`, all four `/speckit.companion.*` commands resolve in the active agent dir.
- Running `/speckit.companion.specify` in a project where `sdd-lean` is **not** installed still produces a spec with no user-story section (independence — FR-004).
- For each stage, the section structure of the namespaced output equals the preset-path output (FR-005 / SC-003).
- The existing capture/status/resume companion commands are unchanged.
