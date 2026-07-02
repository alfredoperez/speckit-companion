# Implementation Plan: Capture the full reasoning trail in the spec context

**Feature**: 383-spec-context-capture · **Spec**: [spec.md](./spec.md) · **Source issue**: [#392](https://github.com/alfredoperez/speckit-companion/issues/392)

## Summary

A spec run produces a rich reasoning trail — decisions and rejected alternatives, verifications and their results, the goal and the out-of-scope fence, requirement→task→test coverage — and today almost all of it evaporates when the session ends. This plan adds that trail to `.spec-context.json` as additive fields, written through the three writer mechanisms `write-context.py` already has (a `--set` scalar, a de-duped append list cloned from the living-specs writer, and a keyed-map upsert cloned from task summaries), emitted by the Companion command bodies at their natural lifecycle points. Two integrity fixes ride along: duration derivation stops trusting AI-journaled timestamps, and evaluated-and-skipped paths (hooks, living specs) leave a one-line marker instead of silence.

The work spans both halves of the repo: the **spec-kit extension** (`speckit-extension/` — the writer script, node fragments, tests, its own docs/CHANGELOG/version) and the **VS Code side** (`src/core/types/specContext.ts` + `spec-context.schema.json` so the extension tolerates and can read the new fields). No GUI rendering is in scope (that's #394).

## Project Structure

```
speckit-extension/
├── scripts/write-context.py            # new flags + handlers (the core of the change)
├── nodes/                              # node fragments that emit the new capture calls
│   ├── specify/…                       # emit intent/expectations at specify complete
│   ├── plan/…                          # emit approach/decisions at plan complete
│   ├── tasks/…                         # emit initial coverage at tasks complete
│   └── implement/…                     # emit verified/decisions/concerns + final coverage
├── commands/speckit.companion.*.md     # regenerated from nodes (assemble-nodes.py)
├── tests/test_capture_fields.py        # new pytest suite for every new flag
├── README.md / CHANGELOG.md / extension.yml   # spec-kit-ext docs + version bump
src/core/types/
├── specContext.ts                      # SpecContext type: new fields + duration-derivation fix
└── spec-context.schema.json            # JSON schema: declare the new fields
docs/
├── capture-and-timing.md               # WHEN map gains the new capture points + timing caveat
└── spec-context-schema.md              # field reference gains the new fields
```

**Structure Decision**: all runtime behavior lives in the spec-kit extension (writer + command bodies); the VS Code side only gains types/schema so nothing in the `.vsix` depends on workspace files (extension-isolation rule).

## Constitution Check

| Principle | Assessment |
|---|---|
| I. Extensibility and Configuration | **PASS** — additive fields, best-effort capture, no provider-specific logic; nothing becomes mandatory. |
| II. Spec-Driven Workflow | **PASS** — enhances the Specify→Plan→Tasks→Implement pipeline's capture; no lifecycle transitions change; `completed` writer untouched. |
| III. Visual and Interactive | **PASS (deferred surface)** — data lands where the viewer/sidebar already read (`.spec-context.json`); rendering is #394's scope. |
| IV. Modular Architecture | **PASS** — writer handlers stay in `write-context.py` beside their siblings; node fragments stay per-command; no webview work. |

No violations — no Complexity Tracking table needed. (Re-checked after Phase 1 design: still PASS.)

## Key risks

- **Shape parity**: `speckit.companion.*` command bodies are assembled from node fragments; edits must go into `nodes/` and be regenerated, or the parity check breaks.
- **`--set` cannot carry objects** (`_coerce_value` handles scalars only) — structured fields need dedicated flags, not `--set` abuse.
- **Concurrency**: new list/map writers are read-modify-write on the shared file; they must never be marked `background` in hooks (same rule the timing part already states).
