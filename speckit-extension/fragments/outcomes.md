---
name: Outcomes
section: User Scenarios & Testing
for: specify
summary: Observable outcomes instead of prioritized user stories — no P-levels, no per-story test block.
---

<!--
  Describe the change as observable OUTCOMES: what is true afterwards that was
  not true before. No priorities, no per-story ceremony — an outcome is one
  sentence plus one way to see it.

  Reach for this shape when the change is not a set of user journeys:
  infrastructure, a migration, a developer-facing tool, a fix. Forcing those
  into "As a user I want…" produces a story nobody actually has.
-->

### Outcomes

Each outcome states the observable change and how someone sees it. Order them so
the first is the one that would make this worth shipping on its own.

- **OUT-001 — [what is true afterwards that was not before]**
  Seen by: [the concrete observation — a screen, a command's output, a number]

- **OUT-002 — [what is true afterwards]**
  Seen by: [the concrete observation]

### Not outcomes of this change

- [Something a reader could reasonably expect here and will not get]

### Edge cases

- [What happens at the boundary — empty, first run, concurrent, offline]
