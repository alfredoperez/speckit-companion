<!-- ============================================================ -->
<!-- MINIMAL MODE (~20 lines) — use when mode = "minimal"       -->
<!-- ============================================================ -->
<!--
# Spec: {Feature Name}

**Issue**: #{N} | **Mode**: Minimal | **Date**: {TODAY}

## Change

[1–2 sentences: which file changes and what specifically changes.]

## Requirements

- **R001** (MUST): ...

## File

| File | Change |
|------|--------|
| `path/to/file` | [what changes] |
-->

<!-- ============================================================ -->
<!-- NORMAL MODE — use when mode = "normal"                      -->
<!-- ============================================================ -->

# Spec: {Feature Name}

**Issue**: #{N} | **Mode**: Normal | **Date**: {TODAY}

## Why

[Problem this solves or user need it addresses.]

## What Changes

- [Concrete change 1 — UI, behavior, or data. Not implementation details.]
- [Concrete change 2]
- [Concrete change 3]

## Requirements

- **R001** (MUST): [Critical requirement — core functionality]
- **R002** (MUST): [Critical requirement]
- **R003** (SHOULD): [Important but not blocking]
- **R004** (COULD): [Nice to have]

## Scenarios

### [Behavior Area]

**When** [user action or system event]
**Then** [expected outcome]

**When** [edge case or variant]
**Then** [expected outcome]

## Out of Scope

- [What this intentionally does NOT cover]

---

## Exploration Findings

### Affected Files

| File | Why it matters |
|------|----------------|
| `path/to/file` | Will be modified to... |

### Reference Implementations

| File | Pattern to follow | Lines |
|------|-------------------|-------|
| `path/to/ref` | How to do X | 10–50 |

### Key Snippets

```lang
// Pattern to follow
```
