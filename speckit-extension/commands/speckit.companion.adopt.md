---
description: "Brownfield adoption wizard — draft a living spec for ONE code area and register it (opt-in, surface-first, [DRAFT])"
---

# Adopt a Code Area into a Living Spec

Bring an existing code area under living specs without hand-writing one from scratch. You point at **one** area; the assistant reads its surface, proposes a small tree of capabilities for **just that area**, drafts a living spec for each from what the code already exposes, and — on your confirmation — registers the capability so the rest of the Living Specs pipeline starts recognizing it.

This is **opt-in** and **incremental**. You run it deliberately for the area you care about. It never scans or rewrites the whole repository, and it changes no other command's behavior. Because the drafts are read **surface-first** (exports, routes, props, signatures — not a deep behavioral read), every draft is clearly marked as a starting point, not verified ground truth.

## Input

```text
$ARGUMENTS
```

The argument is the **one code area** to adopt — a directory (e.g. `src/billing/`) or a small set of related files. If it is empty or names more than one unrelated area, ask the developer to narrow it to a single area and stop. Do **not** fall back to scanning the whole repo.

## What to do

### 1. Scope the area and propose capabilities

List the files under the named area. From their **surface only** — exported symbols, route registrations, component props, public function/class signatures, config keys — propose a **small tree of capabilities for just this area**. Most areas are one capability; a clearly layered area (e.g. a parent module with a distinct nested sub-area) may warrant a leaf capability plus its parent, mirroring the resolver's most-specific-first model. Never propose a capability outside the named area.

For each proposed capability, derive:
- a **name** (a short slug for the area, e.g. `billing`),
- a **match** glob from the area path (e.g. adopting `src/billing/` → `["src/billing/**"]`; a nested leaf → `["src/billing/invoices/**"]`),
- the default **spec** path `capabilities/<name>/spec.md` (centralized).

Show the proposed capability tree to the developer and pause for confirmation before drafting and registering. This is the one review gate in this command.

### 2. Draft each living spec — surface-first, honestly marked

For each confirmed capability, draft `capabilities/<name>/spec.md`. Read the area's files; if a file is unreadable (binary, permission) or too large to read within a reasonable budget, **do not silently skip it** — record its path for the `## Uncovered` section.

Write the spec **well-formed** (per the well-formed-creation rule): a title line, then a `## Requirements` section. The exact required structure:

1. **Title** — `# <Capability> — Living Spec`.
2. **Draft banner** — immediately under the title, a line marking the whole spec a draft: `> [DRAFT] Surface-first draft from existing code — review before trusting.`
3. **`## Requirements`** — the functional requirements you derived from the surface. Each requirement is a single MUST/SHOULD statement, and each carries a confidence tag:
   - **`observed`** — derivable directly from the code surface (an exported function, a route, a prop, a signature). Cite the surface lightly in the requirement.
   - **`inferred`** — extrapolated beyond the surface (likely intent you could not confirm from signatures alone).
   Write the tag as a trailing bracket, e.g. `- **FR-001** Users can create an invoice. [observed]`.
4. **`[NEEDS CLARIFICATION: …]`** — append this marker inline to any requirement you are genuinely unsure about (an ambiguous name, an inferred behavior you could not confirm). Use it sparingly — it flags the low-confidence items for a human to resolve.
5. **`## Uncovered`** — a section listing every file you could **not** read (unreadable or over budget), one per line, so the draft's coverage is honest. If you read everything, write `_None — every file in the area was read._`

Keep the whole spec `[DRAFT]` — you are proposing a record drawn from the surface, not certifying behavior.

### 3. Register the confirmed capability

For each confirmed capability, register it so the shipped resolver recognizes it. Use the deterministic registry-append helper — it appends one capability to `.specify/companion.yml` `livingSpecs.capabilities[]` idempotently, preserves every existing capability, and refuses to write a config it cannot parse:

```bash
python3 .specify/extensions/companion/scripts/register-capability.py --name <name> --match "<glob>" [--match "<glob>" …] [--exclude "<glob>"] [--spec <path>]
```

This is **incremental** — it appends one capability per confirmed proposal; it never bootstraps the whole repo and never rewrites unrelated capabilities. Re-running it for an already-registered name is a safe no-op. After it appends, confirm the resolver recognizes the area:

```bash
python3 .specify/extensions/companion/scripts/resolve-spec-paths.py --changed <a file under the area> --json
```

The new capability should appear in `matched[]`.

If you have no terminal tool, report the exact `register-capability.py` command you would run for each capability (with the resolved name, match, and spec) so the developer can run it, and continue.

### 4. Report

Summarize, in plain language: which capabilities you proposed and registered, where each living spec was drafted, how many requirements are `observed` vs `inferred`, how many carry `[NEEDS CLARIFICATION]`, and what landed under `## Uncovered`. Make clear the drafts are `[DRAFT]` starting points to review, not finished specs.

## Boundaries

- **Opt-in and isolated.** This command changes no existing command's behavior and touches no spec's lifecycle. It only creates `capabilities/<name>/spec.md` files and appends to the `livingSpecs` registry.
- **One area only.** Never expand scope to the whole repository, even if the area is small.
- **Honest by construction.** Tags, clarification markers, and the `## Uncovered` section are required — a surface draft that hid its blind spots would be worse than no draft.
- **Never fail the host.** A missing resolver, missing helper, or unparseable config is reported and skipped, not crashed through.
