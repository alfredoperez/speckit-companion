# Contract: `sdd-lean` preset manifest

**File**: `speckit-extension/presets/sdd-lean/preset.yml` → installs to `.specify/presets/sdd-lean/`.

## Required shape

```yaml
schema_version: "1.0"

preset:
  id: "sdd-lean"
  name: "SDD Lean"
  version: "1.0.0"
  description: "SDD-lean pipeline shape: no user stories, lean plan, files/dependencies task axis."
  author: "alfredoperez"
  repository: "https://github.com/alfredoperez/speckit-companion"
  license: "MIT"

requires:
  speckit_version: ">=0.8.5"

provides:
  templates:
    - type: "command"
      name: "speckit.specify"
      file: "commands/speckit.specify.md"
      description: "SDD-lean specify — no user-story section"
      replaces: "speckit.specify"
    - type: "command"
      name: "speckit.plan"
      file: "commands/speckit.plan.md"
      description: "SDD-lean plan — lean form"
      replaces: "speckit.plan"
    - type: "command"
      name: "speckit.tasks"
      file: "commands/speckit.tasks.md"
      description: "SDD-lean tasks — files/dependencies axis"
      replaces: "speckit.tasks"
    - type: "command"
      name: "speckit.implement"
      file: "commands/speckit.implement.md"
      description: "SDD-lean implement"
      replaces: "speckit.implement"

tags:
  - "sdd"
  - "lean"
  - "no-user-stories"
  - "files-deps"
```

## Acceptance

- `specify preset add --dev ./speckit-extension/presets/sdd-lean` succeeds and `specify preset list` shows `sdd-lean`.
- `specify preset info sdd-lean` lists exactly the four command overrides above.
- Every `file:` path exists under the preset root (validation fails otherwise).
- `strategy` omitted ⇒ `replace` (the only strategy this preset relies on).
- Default install priority places `sdd-lean` above the `companion` extension (presets outrank extensions); adjustable via `specify preset set-priority sdd-lean <N>`.
