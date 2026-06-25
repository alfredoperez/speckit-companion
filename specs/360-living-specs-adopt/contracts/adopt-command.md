# Contract: `speckit.companion.adopt` command — drafted-spec structure

The command body is runtime AI prose; this contract pins the **structure** every drafted `capabilities/<name>/spec.md` must satisfy, and the registry side-effect.

## Inputs

- One code area the developer names (e.g. `src/billing/`). The command operates on **only** that area — never the whole repo.

## Drafted spec structure (per capability)

A drafted `capabilities/<name>/spec.md` MUST contain, in order:

1. A title line: `# <Capability> — Living Spec`.
2. A `[DRAFT]` banner marking the whole spec as a draft (a line near the top containing `[DRAFT]`).
3. A `## Requirements` section heading.
4. Requirements, each tagged `observed` or `inferred`.
5. Low-confidence requirements flagged inline with `[NEEDS CLARIFICATION: …]`.
6. A `## Uncovered` section listing files that could not be read (unreadable / over budget).

## Registry side-effect

On developer confirmation, each capability is registered via `register-capability.py` so the resolver recognizes it. Adoption appends incrementally — it never bootstraps the whole repo or rewrites unrelated capabilities.

## Honesty constraints

- Surface-first only: derive `observed` requirements from exports, routes, props, and signatures — not a deep behavioral read.
- Anything unread is named under `## Uncovered`, never silently dropped.
- The whole spec stays `[DRAFT]` until a human reviews it.
