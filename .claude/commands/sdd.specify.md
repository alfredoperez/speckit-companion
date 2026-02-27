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

### 2. Determine Spec Number + Create Directory

Scan `specs/` locally for directories matching `[0-9]+-*`:

- Extract the highest number N found; use N+1 as the new number.
- If no spec dirs exist, start at 1.

```bash
mkdir -p specs/{NNN}-{slug}
```

---

### 3. Explore Inline

Without spawning a subagent, read 2–3 relevant files to understand the feature area:
- Find files related to the feature description using Glob/Grep
- Read key sections to understand patterns, architecture, and constraints

---

### 4. Detect Complexity

Based on what you found in Explore, classify the change:

| Signal | Mode |
|--------|------|
| Touches 1 existing file, change is <10 lines | **minimal** |
| Pure style or config tweak | **minimal** |
| Touches 2+ files, or adds a new component/service | **normal** |
| Introduces new public behavior or API | **normal** |

If unclear, default to **normal**.

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

### 6. Minimal Mode — Write `plan.md` + `tasks.md`

Skip this step if mode is **normal**.

Write `specs/{NNN}-{slug}/plan.md`:

```markdown
# Plan: {Feature Name}

**Spec**: specs/{NNN}-{slug}/spec.md | **Date**: {TODAY}

## Approach

[1–2 sentences describing the implementation strategy.]

## Files to Change

- `path/to/file` — [what changes]

## Phase 1 Tasks

| ID | Do | Verify |
|----|-----|--------|
| T001 | [task description] | [verification step] |
```

Write `specs/{NNN}-{slug}/tasks.md`:

```markdown
# Tasks: {Feature Name}

## Phase 1 — Core

- [ ] **T001** · [task description]
  - **Do**: [specific action]
  - **Verify**: [how to confirm it works]
```

---

### 7. Summary

**Minimal mode** — display exactly this format:

```
--- Specify complete (Fast Mode) ---
Feature: {name}  |  Mode: minimal
Spec:    specs/{NNN}-{slug}/spec.md
Plan:    specs/{NNN}-{slug}/plan.md
Tasks:   specs/{NNN}-{slug}/tasks.md

Small change — all files ready. Run /sdd.implement when ready.
```

**Normal mode** — display exactly this format:

```
--- Specify complete ---
Feature: {Feature Name}  |  Branch: {NNN}-{slug}
Spec:    specs/{NNN}-{slug}/spec.md

Next: /sdd.plan {NNN}-{slug}
```
