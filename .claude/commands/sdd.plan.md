---
description: "SDD — Spec-Driven Development: write a lean implementation plan."
handoffs:
  - label: Generate Tasks
    agent: sdd.tasks
    prompt: Generate tasks for this plan
    send: true
---

## Steps

### 1. Load Context

If `$ARGUMENTS` is provided, use `specs/{$ARGUMENTS}/` as the target directory.
Otherwise, find the most recently modified directory under `specs/` that contains a `spec.md`.

Read:
- `specs/{NNN}-{slug}/spec.md` — feature name, requirements, scenarios

If no spec found, stop: "Run `/sdd.specify` first."

---

### 2. Write `specs/{NNN}-{slug}/plan.md`

```markdown
# Plan: {Feature Name}

**Spec**: [spec.md](./spec.md) | **Date**: {TODAY}

## Approach

[2–3 sentences: what we're building, the key architectural decision, and why that approach.]

## Files

### Create

| File | Purpose |
|------|---------|
| `path/to/new-file` | [what it does] |

### Modify

| File | Change |
|------|--------|
| `path/to/existing` | [what changes and why] |

## Risks

[Only if genuinely non-obvious risks exist. Omit section entirely otherwise.]

- [Risk]: [Mitigation]
```

**Skip**: research.md, data-model.md, contracts/, quickstart.md, constitution checks, auxiliary work flags, Mermaid diagrams (unless data flow is non-obvious).

---

### 3. Summary

Display exactly this format:

```
--- Plan complete ---
Feature: {Feature Name}
Plan:    specs/{NNN}-{slug}/plan.md  —  {N} files to create, {N} to modify

Next: /sdd.tasks {NNN}-{slug}
```
