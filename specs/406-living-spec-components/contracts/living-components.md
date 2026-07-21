# Contract: Living Spec Components

This is the render contract the implementation and its tests/stories code against. It has three parts: the **input tokens** the components key on (verbatim from the spec), the **gating flag**, and the **emitted class names** each component is recognized and styled by. The exact strings here are the contract — do not rename, recase, or pluralize them.

## 1. Input tokens (verbatim — from spec Verbatim Constraints)

The render keys on these authored tokens exactly:

| Token | Meaning |
|-------|---------|
| `[DRAFT]` | draft marker — drives the draft notice |
| `[inferred]` | inferred-confidence tag on a requirement |
| `## Uncovered` | uncovered-section heading |
| `_None — every file in the area was read._` | read-everything sentinel |
| `WHEN`, `THEN`, `AND` | scenario step keywords |
| the exact `###` heading text | requirement identity (the key fold-back matches on) |

Additional recognized section headings: `## Purpose` (purpose callout), `#### Scenario:` (scenario block under a requirement).

## 2. Gating flag

```ts
// webview/src/spec-viewer/markdown/renderer.ts
export function setLivingMode(value: boolean): void
```

- Set from `navState.livingMode` in `index.tsx` on every `contentUpdated` and `viewerStateUpdated`, alongside the existing `setHasSpecContext` call.
- When `false`, **none** of the living preprocessors run — the document takes the feature-spec path unchanged (FR-001, SC-001).
- The webview never derives this itself; it renders the flag the extension sends.

## 3. Emitted class names (the recognizable output)

Each component emits HTML carrying a stable class the main render loop passes through and the `_living.css` partial styles. Tests and stories assert on these.

| Component | Root class | Notes |
|-----------|-----------|-------|
| Draft notice | `living-draft-notice` | top of document; announced trust boundary |
| Purpose callout | `living-purpose` | only when `## Purpose` exists |
| Requirement card | `living-req-card` | keyed on exact heading text; wraps still-individual commentable `.line` units |
| Requirement confidence | `living-req-confidence` (+ `--inferred`) | present only when stated; absent = observed, no badge |
| Requirement coverage | `living-req-coverage` | present only when determinable; never `0` |
| Scenario steps | `living-scenario` with `living-when` / `living-then` / `living-and` step classes | conditions separable from outcomes |
| Uncovered summary | `living-uncovered` with `living-uncovered-count` / `living-uncovered-scope` | count + scope before any file list |
| Uncovered disclosure | `living-uncovered-group` (a `<details>`, closed by default, keyboard-operable) | one per omission reason |
| Read-everything | `living-uncovered-none` | plain statement, no empty banner |

### Invariants every emitted node must hold

- **Line identity** (FR-005): the main loop stamps `data-line`; components must not collapse multiple source lines into one line in a way that loses per-line comment anchoring. Requirement cards and scenarios keep their inner content as normal per-line `.line` units.
- **Attribute safety** (FR-020): any attribute carrying authored text is built attribute-safe (DOM-built or attribute-safe escape), never via `escapeHtml` (which does not escape attribute quotes).
- **Accessibility** (FR-021): anything an `aria-describedby`/`aria-labelledby` points at uses a visually-hidden class, not `hidden`/`display:none`.
- **Fallback** (FR-002, FR-003): a preprocessor that throws returns its input region unchanged so the base renderer takes that region — no dropped lines, page still renders.
- **Verbatim** (FR-004): authored wording and document order preserved; this is a rendering change, never an editing one.
- **Themes/modes** (FR-022): correct in dark, light, high-contrast, narrow, and reduced-motion via existing viewer tokens, including a still equivalent for the disclosure transition.

## 4. Story coverage contract (FR-023 / SC-008)

`LivingComponents.stories.tsx` must exercise every enumerated state: draft, non-draft, missing purpose, very long purpose, fallback path; observed, inferred, covered, uncovered, unknown-coverage, no-scenarios, many-scenarios, long requirement title; nothing uncovered, one file, many files across reasons, and a single reason with a long file list.
