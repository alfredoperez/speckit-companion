---
description: "Brownfield adoption wizard — draft living specs for the code areas you name and register them (opt-in, surface-first, [DRAFT])"
---

# Adopt a Code Area into a Living Spec

Bring an existing code area under living specs without hand-writing one from scratch. You point at **one** area; the assistant reads its surface, proposes a small tree of capabilities for **just that area**, drafts a living spec for each from what the code already exposes, and — on your confirmation — registers the capability so the rest of the Living Specs pipeline starts recognizing it.

This is **opt-in** and **incremental**. You run it deliberately for the areas you care about. It never scans or rewrites the whole repository on its own, and it changes no other command's behavior. Because the drafts are read **surface-first** (exports, routes, props, signatures — not a deep behavioral read), every draft is clearly marked as a starting point, not verified ground truth.

**Surface-first constrains how much you may claim, not what you may write about.** Reading only the surface limits your *confidence*, so the drafts are marked `[DRAFT]` and low-confidence items are flagged. It does not mean the requirements should describe the surface. A requirement that restates a function signature is not a specification — see step 2.

## Input

```text
$ARGUMENTS
```

The argument is the code area (or areas) to adopt — a directory (e.g. `src/billing/`), a small set of related files, or several directories.

If the argument is **empty**, do not fall back to scanning the whole repo. List the plausible top-level areas, describe each in a line, and ask which to adopt. Offer adopting several at once as an explicit choice — the developer picking "all of them" is a legitimate answer, not something to argue with.

If the argument names **several areas**, adopt them in one run: propose the full capability tree across all of them, and bring the whole tree to the single review gate in step 1. Do not silently expand beyond what was named.

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
2. **Draft banner** — immediately under the title, a line marking the whole spec a draft and stating the default confidence: `> [DRAFT] Surface-first draft from existing code — every requirement is observed from the code surface unless tagged otherwise. Review before trusting.`

   Keep `[DRAFT]` as the first token on that line. The viewer detects it there and badges the spec accordingly.
3. **`## Requirements`** — the functional requirements. Each is a single MUST/SHOULD statement describing **what the area guarantees and why**, at a level that survives refactoring.

   Write about behavior, contracts, and intent. Do **not** transcribe the surface you read. Specifically, a requirement must never be a restatement of:

   - a prop list or function parameter list (`MUST accept title, description, actions, children`),
   - an export inventory (`MUST export exactly A, B, C`),
   - literal class names, CSS variable names, or design-token values (`max-w-4xl`, `h-14`, `--surface`),
   - a type signature, or an enum's members.

   Those are the code. They change on every routine edit, they generate drift noise, and a reader gets them faster from the source file.

   Ask of every requirement: *would this still be true and useful after a reasonable refactor?* If renaming a prop would falsify it, rewrite it one level up.

   ```text
   ✗ FR-004  `ContentPage` MUST accept `title` (required), `description`,
             `breadcrumbItems`, `actions`, `children`, and `width`.
   ✗ FR-005  `ContentPage` MUST support exactly three width variants —
             `medium`, `wide`, `full` — mapping to `max-w-4xl`, `max-w-[1440px]`,
             and `max-w-none`.

   ✓ FR-004  Pages MUST declare their layout intent (content width, whether the
             surface scrolls) rather than hand-rolling chrome, so responsive
             behavior stays owned by the shell in one place.
   ✓ FR-005  The shell MUST offer a small fixed set of content widths rather than
             free-form sizing, so pages stay visually consistent across routes.
   ```

   Name concrete symbols only when the symbol *is* the contract — a public entry point, a route path, a documented config key. Cite it as context (`the app shell's public barrel`), not as the requirement's content.

   Aim for the requirements a competent engineer would need to rebuild this area correctly, not a list of everything it currently contains. Fewer, denser requirements beat exhaustive transcription; if an area yields thirty requirements, you are almost certainly describing the code.

4. **Confidence** — the whole document is a surface-first draft, so `observed` is the **default and is stated once in the draft banner**. Do not tag individual requirements `[observed]`; a tag on every line carries no information.

   Tag only the exceptions, inline: `[inferred]` for a requirement extrapolated beyond what the surface shows (likely intent you could not confirm). If you find yourself tagging nearly everything `[inferred]`, the draft is guesswork — say so in your report rather than shipping it quietly.
5. **`[NEEDS CLARIFICATION: …]`** — append this marker inline to any requirement you are genuinely unsure about (an ambiguous name, an inferred behavior you could not confirm). Use it sparingly — it flags the low-confidence items for a human to resolve, and step 3 walks them.
6. **`## Uncovered`** — a section listing every file you could **not** read (unreadable or over budget), one per line, so the draft's coverage is honest. If you read everything, write `_None — every file in the area was read._`

Keep the whole spec `[DRAFT]` — you are proposing a record drawn from the surface, not certifying behavior.

### 3. Walk the clarifications

If any drafted requirement carries `[NEEDS CLARIFICATION: …]`, do not leave them sitting in the file. Markers nobody returns to are the same as no markers at all, and some of what surfaces here is real — an inconsistency between two modules, a value the code never actually produces, an assumption worth making deliberately.

Collect them across every capability drafted in this run and walk them with the developer, one at a time. For each: show the requirement, state plainly what you could not determine, and offer

- **resolve** — the developer answers; rewrite the requirement with the answer folded in and strip the marker,
- **keep** — leave the marker in place for later,
- **drop** — the requirement was not real; remove it.

Offer skipping the rest at any point, and treat an interrupted walk as normal — everything unresolved simply keeps its marker.

If a clarification reveals something that is not an ambiguity but a **defect** (a mismatch between two parts of the code, an unreachable branch, a value that cannot occur), say so explicitly in the report. That finding is worth more than the spec line that surfaced it.

Do not invent answers to close markers out. An unresolved marker is honest; a fabricated resolution is a lie the record then carries forward.

### 4. Register the confirmed capability

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

### 5. Report

Summarize, in plain language: which capabilities you proposed and registered, where each living spec was drafted, how many requirements each carries, how many were tagged `[inferred]`, how many clarifications you walked and how they landed (resolved / kept / dropped), any **defects** the clarification walk turned up, and what landed under `## Uncovered`. Make clear the drafts are `[DRAFT]` starting points to review, not finished specs.

## Boundaries

- **Opt-in and isolated.** This command changes no existing command's behavior and touches no spec's lifecycle. It only creates `capabilities/<name>/spec.md` files and appends to the `livingSpecs` registry.
- **Only what was named.** Adopt the areas the developer named or chose, and nothing else. Several areas in one run is fine; silently widening past the agreed scope is not.
- **Specify, don't transcribe.** A requirement that a prop rename would falsify is a bug in the draft, not a detail. Fewer, durable requirements beat an exhaustive inventory of the code.
- **Honest by construction.** The `[inferred]` tag, clarification markers, and the `## Uncovered` section are required — a surface draft that hid its blind spots would be worse than no draft.
- **Never fail the host.** A missing resolver, missing helper, or unparseable config is reported and skipped, not crashed through.
