# Data model

## Open question

A `[NEEDS CLARIFICATION: <question>]` marker in `spec.md`. At most three per spec.

- **Attended**: shown as row `n` of one table; the answer replaces the marker in the spec and is recorded as a decision `{"decision": "<answer>", "id": "spec-question-<n>", "by": "you"}`. The `id` makes a later answer replace the earlier one.
- **Unattended**: the marker is replaced by a default written under Assumptions, and one concern is recorded: `{"note": "Assumed <answer> for: <question>", "step": "specify"}`.

No new field in `.spec-context.json`: decisions, concerns and `expectations` already exist.

## Non-goals section

The spec's `## Non-goals` list. Each item becomes one `expectations` entry at wrap-up. A section that says "None" records nothing.
