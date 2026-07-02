# Data Model: Spec Explorer actions & health

**Feature**: 384-explorer-actions. All derived, in-memory only — nothing new is persisted.

## CapabilityHealth (derived, per capability)

```ts
interface CapabilityHealth {
  /** From the coverage tier: requirements with a mapped test / total. Absent when no .coverage.md. */
  coverage?: { covered: number; total: number };
  /** True when files matching the capability changed since its spec's last commit. Absent when not computable. */
  drifted?: boolean;
}
```

- **Coverage rule** (mirrors the CLI): requirement ids are `FR-\d+` / `NFR-\d+` headings/mentions in the capability's `.spec.md`; an id is covered when it appears on a `.coverage.md` line that names a test (`.test.` / `.spec.` path, `tests/…`, or `file::Case`).
- **Drift rule** (mirrors the CLI): last commit touching the spec file → files changed since, intersected with `match` minus `exclude` minus the spec/tier files themselves minus the exempt globs (defaults: `*.config.*`, `*.test.*`, `**/migrations/**`).
- **Validation**: any read/parse/git failure ⇒ the field is absent, never zeroed or guessed (a missing count must be indistinguishable from "no tier").

## Row presentation

| State | Description suffix | Tooltip line |
|---|---|---|
| coverage present | `3/5 covered` | "3 of 5 requirements have a mapped test" |
| drifted | `● drift` (warning color) | "Source files changed since the living spec's last commit" |
| both | `3/5 covered · ● drift` | both lines |
| neither computable | unchanged (today's rendering) | unchanged |

## State transitions

None — health is recomputed on tree render/refresh; no persistence, no lifecycle interaction.
