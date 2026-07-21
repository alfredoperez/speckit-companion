# Data Model: Living Spec Components

These are **parse-model shapes**, not persisted entities. Each is what a preprocessor recognizes in living-spec markdown and turns into recognized HTML. Nothing here is written to disk; the source of truth stays the authored markdown, rendered verbatim and in document order (FR-004).

## Living spec document

The whole capability spec being read in living mode. A composition of the parts below, rendered top to bottom in authored order.

- **draftMarker**: present when a `[DRAFT]` marker sits in the top body window (matches the extension's `isLivingDraft` window). Drives the draft notice.
- **purpose**: the `## Purpose` section body, or absent.
- **requirements**: the ordered list of `###` requirement blocks.
- **uncovered**: the `## Uncovered` section, or absent.
- **rest**: any other markdown, rendered unchanged by the base renderer.

Only applies when `livingMode` is true; otherwise the whole document is the feature-spec path unchanged.

## Requirement

A single rule authored under an exact `###` heading.

| Field | Source | Rule |
|-------|--------|------|
| `heading` | the exact `###` heading text | identity key; **no** trim/normalize/re-case (FR-008) — the same key fold-back matches on |
| `text` | the rule prose under the heading | rendered verbatim, document order (FR-004) |
| `confidence` | `[inferred]` tag if present | `inferred` when tagged, `observed` (default) when untagged; an untagged requirement carries **no** per-card confidence badge (FR-009). Inferred reads as less trustworthy without becoming a wall of warnings (FR-010) |
| `coverage` | best-effort from `viewerState` when available | shown only when determinable; omitted, **never** `0`, when not (FR-011, FR-019) |
| `scenarios` | zero or more `#### Scenario:` blocks | a requirement with none renders cleanly, no empty scenario container (FR-013) |

## Scenario

A checkable case under a requirement.

- **title**: the `#### Scenario:` heading text.
- **steps**: an ordered list of `- **WHEN** …` / `- **THEN** …` / `- **AND** …` bullets. Keywords are the verbatim `WHEN`, `THEN`, `AND` (Verbatim Constraints). Rendered so conditions (WHEN) are visually separable from outcomes (THEN/AND), never reordered or reworded (FR-012).

## Uncovered evidence entry

One file a surface-first draft could not fully read.

- **path**: the file path.
- **reason**: the omission reason it is grouped under (e.g. unreadable, too large, read at surface level only). Files are grouped by reason (FR-015), not shown as one flat list.

The **uncovered section** as a whole:
- opens with a **count** and a **scope statement** before any file list (FR-014);
- when empty or carrying the sentinel `_None — every file in the area was read._`, renders a plain "read everything" statement, not a large empty banner (FR-017);
- renders each reason group as a keyboard-operable disclosure, closed by default (FR-016);
- falls back to plain markdown for any sub-structure it does not recognize, dropping no line (FR-018, SC-006).

## Draft marker / purpose

The two things read before the body — the trust boundary and the orientation.

- **Draft notice**: rendered at the top when `draftMarker` is present, making it impossible to mistake the draft for a verified record (FR-006). The authored banner line stays intact in the flow.
- **Purpose callout**: rendered prominently only when a `## Purpose` section exists, with the authored text unchanged; a missing purpose is omitted, never filled with placeholder text (FR-007).

## Determinable-vs-omitted rule (cross-cutting)

Any value the document does not state — confidence, coverage, or any count (uncovered files, scenarios) — is **omitted entirely**, never guessed and never shown as `0` (FR-019, SC-004). "A zero the reader can trust" and "a fact nobody could compute" are different claims; the render never conflates them.
