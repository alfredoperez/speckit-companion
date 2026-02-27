---
description: "SDD — Spec-Driven Development: write a lean spec for rapid iteration."
handoffs:
  - label: Build Plan
    agent: sdd.plan
    prompt: Create a lean plan for this spec
    send: true
---

## User Input

```text
$ARGUMENTS
```

If `$ARGUMENTS` is empty, stop and say: "Provide a feature description: `/sdd.specify <description>`"

---

## Steps

### 1. Parse Input

Extract the feature description from `$ARGUMENTS`.

Generate a concise slug (2–4 words, action-noun format, lowercase, hyphens):
- "add clickable file references" → `clickable-file-refs`
- "fix payment timeout bug" → `fix-payment-timeout`
- Preserve technical terms (OAuth2, JWT, API)

---

### 2. Determine Branch Number

Find the highest existing `NNN` across all sources:

```bash
git fetch --all --prune
```

- Local branches: `git branch | grep -E '^\s*[0-9]+'`
- Remote branches: `git ls-remote --heads origin | grep -E 'refs/heads/[0-9]+'`
- Spec dirs: list directories under `specs/` matching `[0-9]+-*`

Extract the highest number N found; use N+1 as the new number. If no branches or spec dirs exist, start at 1.

---

### 3. Create Branch and Directory

```bash
git checkout -b {NNN}-{slug}
mkdir -p specs/{NNN}-{slug}
```

---

### 4. Explore Inline

Without spawning a subagent, read 2–3 relevant files to understand the feature area:
- Find files related to the feature description using Glob/Grep
- Read key sections to understand patterns, architecture, and constraints

---

### 5. Write `specs/{NNN}-{slug}/spec.md`

```markdown
# Spec: {Feature Name}

**Branch**: {NNN}-{slug} | **Date**: {TODAY}

## Summary

[2–3 sentences: what the feature does and why it's needed.]

## Requirements

- **R001** (MUST): [Critical requirement — testable and unambiguous]
- **R002** (MUST): [Critical requirement]
- **R003** (SHOULD): [Important but not blocking]

## Scenarios

### {Behavior Area}

**When** [user action or system event]
**Then** [expected outcome]

### {Edge Case or Secondary Flow}

**When** [condition]
**Then** [outcome]

## Out of Scope

- [What this intentionally does NOT cover]
```

**Skip**: clarification rounds, formal edge case analysis, exploration findings section, quality checklists.

---

### 6. Summary

Display exactly this format:

```
--- Specify complete ---
Feature: {Feature Name}  |  Branch: {NNN}-{slug}
Spec:    specs/{NNN}-{slug}/spec.md

Next: /sdd.plan {NNN}-{slug}
```
