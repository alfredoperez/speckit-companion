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

Read in parallel:
- `specs/{NNN}-{slug}/spec.md` — feature name, requirements, scenarios
- `specs/{NNN}-{slug}/state.json` — current step/task (if exists)

If no spec found, stop: "Run `/sdd.specify` first."

Update `specs/{NNN}-{slug}/state.json`:

```json
{ "step": "plan", "task": null, "updated": "{TODAY}" }
```

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

### 3. Checkpoint — Plan Review

Display the full contents of `plan.md`, then use the **AskUserQuestion** tool with:

```
--- Plan ready for review ---
[paste plan.md content]
```

Call **AskUserQuestion** with these options:
- **Approve** — proceed to summary and offer `sdd.tasks` handoff
- **Edit** — user provides edit notes in the "Other" field; apply changes, update `plan.md`, redisplay checkpoint

Do NOT proceed to tasks or close the command until the user responds.

- **On Approve**: show the summary below and offer the `sdd.tasks` handoff.
- **On Edit**: apply the changes, update `plan.md`, then redisplay this checkpoint.

---

### 4. Summary

Display exactly this format:

```
--- Plan complete ---
Feature: {Feature Name}
Plan:    specs/{NNN}-{slug}/plan.md  —  {N} files to create, {N} to modify

Next: /sdd.tasks {NNN}-{slug}
```
