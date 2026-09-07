---
description: "Brownfield adoption wizard — draft living specs for the code areas you name, central or colocated, and register them (opt-in, surface-first, [DRAFT])"
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

If the argument is `.`, the developer asked for the **whole project**. Read the conventions as always, then propose the tree for the whole source tree. Say at the gate how many capabilities and how many spec files that comes to, and offer a coarser cut (one spec per area) and a finer one (a spec per concern within an area) with the count each would give, so the size of the thing is a choice rather than a surprise. Nothing is written until they pick.

<!-- speckit-companion:part smallest-thing -->
## The smallest thing that works

**Before building anything, stop at the first rung that holds:** does it need to exist at all; does this codebase already have it; does the standard library, the platform, or an installed dependency do it; can it be one line; only then, the minimum code that works. Fix the cause where every caller passes through, not the symptom one caller reported. Delete rather than add, boring rather than clever: no interface with one implementation, no factory for one product, no scaffolding for later.

**The same test governs what you write.** A section nobody acts on is removed, not filled in. No requirement for what a type or a test already enforces. A third scenario has to cover a failure the first two miss.

**Write it the way you would say it.** One idea per sentence. No em-dashes: a full stop, a comma or a colon says it. Say what happens, not what the system "shall be capable of". Never a section that exists to say "N/A" — remove it instead.

**Never simplify away** validation at a trust boundary, error handling that prevents data loss, security, accessibility, or anything the spec asks for. **A corner cut on purpose** carries `// simplified: <ceiling>, <what to do when it binds>` in the code and one `concerns` entry in this step's capture.
<!-- /speckit-companion:part smallest-thing -->

## What to do

### 1. Read the rules before you read the code

Before listing a single file, read the project's own conventions, stopping at the first source that names a constraint: `CLAUDE.md` or `AGENTS.md`, `CONTRIBUTING.md`, the README's architecture section, then the enforcement configs — `.dependency-cruiser.js`, `eslint.config.*` (`no-restricted-imports`, `boundaries/*`, `import/no-restricted-paths`), `nx.json` `depConstraints`, `tsconfig` project references, and any test matching `*arch*`, `*boundar*` or `*layer*`. Copy each constraint into a working list with the file and line it came from. These are the rules a file-by-file read can never produce, because their evidence is an import that does not exist, in a file you will never open. Measured twice: a read of the code kept 1 of a Feature-Sliced app's 5 layering rules, and both times all five were sitting in the app's own `CLAUDE.md`.

If no conventions doc and no enforcement config names a constraint, ask once, before proposing anything: *"Does this codebase have rules about what may import what, or about how a directory is sliced?"* Cite the answer the way you would cite a file. If the answer is no, record that under `## Uncovered` rather than inventing one.

**Then propose the capability tree, cut where those rules live.** A layered codebase keeps its load-bearing rules *between* layers, so cut by layer there; by bounded context in a domain-shaped codebase. One capability per thing a person would name, prefixed by its area (`entities`, `article-feed`). A layer whose rules say how it is sliced is a capability in its own right, sharing its `match` with the by-noun capabilities beside it: membership is coarse and the narrowing happens at the requirement, so six capabilities may all carry `match: ["src/features/**"]` — one holding the layer's rules, the rest holding what each slice is for. Leave the layer capability out and the slicing rules have no owner; that is exactly how "a slice is one user action" was lost.

For each proposed capability, derive:
- a **name** (a short slug for the area, e.g. `billing`),
- a **match** glob from the area path (e.g. adopting `src/billing/` → `["src/billing/**"]`; a nested leaf → `["src/billing/invoices/**"]`),
- a **spec** path, which depends on the storage layout chosen below.

#### Choose the storage layout

Living specs support two layouts, and the choice is the developer's:

- **central** — every spec under `capabilities/<name>/spec.md`. One folder holds the whole record; easy to read end to end, and the spec stays put when code moves.
- **colocated** — the spec sits next to the code it describes, at `<area root>/<name>.spec.md`. Ownership is obvious, the spec travels with the code in a move, and it shows up in the same folder a developer already has open.

If the invocation named a layout, use it. **Otherwise ask before proposing anything**, since the layout determines the spec paths shown at the review gate. Offer central, colocated, or per-capability, and say plainly that it can be changed later.

Deriving a **colocated** path: take the capability's match glob, strip the trailing `/**`, and place `<name>.spec.md` in that directory — `src/features/spec-viewer/**` → `src/features/spec-viewer/spec-viewer.spec.md`.

Two consequences to state out loud when proposing colocated paths, because both surprise people:

1. **The filename stem becomes the capability's display name.** A capability named `speckit-extension-capture` colocated as `capture.spec.md` shows as `capture` in the sidebar. Either keep the stem equal to the name, or tell the developer the name it will display as.
2. **A capability whose match globs span unrelated directories has no obvious home.** If a capability matches `speckit-extension/commands/**` *and* `speckit-extension/nodes/**`, there is no single area root. Propose the shallowest common directory, and if there isn't a sensible one, say so and propose central for that capability specifically — a mix is fine.

Show the proposed capability tree to the developer — names, match globs, and the resolved spec path for each — and pause for confirmation before drafting and registering. This is the one review gate in this command.

### 2. Draft each living spec — the registry, one purpose, and the rules. Nothing else.

**Adoption does not write behaviour.** Both frameworks this was compared against refuse to bootstrap specs from code, and two measured attempts here show why: a read of the code produces what files *say*, and files say behaviours — 447 and 732 lines against a hand-written 255, with 4 of 5 architectural rules missing both times. Behaviour arrives later, one delta at a time, folded in when a feature completes; that mechanism exists and is the one that keeps a spec true. What adoption writes is the part no later change will ever write: what each capability is **for**, and the rules that hold **between** files.

Each spec, at the path chosen at the review gate:

1. **Title** — `# <Capability> — Living Spec`.
2. **Draft banner** — the line under the title, `[DRAFT]` first: `> [DRAFT] Adopted from the project's conventions and the code's shape — the rules are transcribed, the behaviours arrive by fold-back. Review before trusting.` The banner is a summary of the per-requirement markers below it, so it goes when the last one does.
3. **`## Purpose`** — one or two sentences on why this capability exists and what would go wrong without it.
4. **`## Requirements`** — the transcribed rules, each in the requirement shape the fold and the resolver both read:

   ```markdown
   ### An entity imports downward only
   <!-- touches: src/entities/** -->
   <!-- adopted: CLAUDE.md:18 -->

   An entity SHALL import only from `src/shared`. Stated in `CLAUDE.md:18`, enforced by `.dependency-cruiser.js`.

   #### Scenario: one entity needs another's data
   - **WHEN** an entity needs another entity's data
   - **THEN** the two are composed in a feature, widget or page, because a sibling import makes both undeletable
   ```

   **Every requirement carries an `adopted` marker saying where you transcribed it from**, under `touches`: a file and line, or `developer` when the answer came from the question above. Adoption is a claim nothing has checked. The viewer badges it, and the fold clears the marker the first time a change folds onto that requirement, so using a requirement is what confirms it. An unmarked requirement reads as confirmed.

   Three things are load-bearing. The **marker is the whole layer glob**, never a file, because the rule is about the boundary and not about anything inside it. The **WHEN is a future edit**, not a runtime event — "when two actions need the same helper" — because the rule is read by whoever writes the next import. The **THEN says where the code goes instead**, not that the import is forbidden. And every rule **cites its source**: the file and line it was transcribed from, and the tool that enforces it where one does. "Nothing for what a test already enforces" does not apply here — a linter rejects an import, it cannot redirect one, and the citation is what makes this a transcription rather than a guess.

5. **`## Uncovered`** — rules with no owner and areas with no capability. Not files nobody opened.

A capability with no rule of its own — a by-noun slice whose only constraints belong to its layer — carries a `## Purpose` and an empty `## Requirements`, and that is correct. The validator warns when a `[DRAFT]` spec has no requirement scoped to the capability's whole glob, which is the check that a layer's rules were transcribed rather than skipped.

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

For each confirmed capability, register it so the shipped resolver recognizes it. Use the deterministic registry-append helper — it appends one capability to the project's registry, `living-specs.yml`, idempotently, preserves every existing capability, and refuses to write a config it cannot parse:

```bash
python3 .specify/extensions/companion/scripts/register-capability.py --name <name> --match "<glob>" [--match "<glob>" …] [--exclude "<glob>"] [--spec <path>]
```

**Pass `--spec` for every capability**, central or colocated, with the same path you drafted the spec to. A spec is named for what it describes, so `spec.md` is never a filename you write and six open tabs stay tellable apart. The registry's own default is still the older `capabilities/<name>/spec.md`, which is why `--spec` is not optional. The helper emits `spec` only when it differs from that default, which keeps the config terse.

The registry lives at the project root, deliberately outside `.specify/`, so a routine `git restore … .specify/` can never wipe it. Commit `living-specs.yml` along with the specs it registers. If this project still keeps its capabilities in the older `.specify/companion.yml`, the helper moves them across on its first write and says so — nothing is lost and nothing needs doing by hand.

Register a colocated capability only *after* its spec file is on disk at that path. The two must agree: the resolver raises `capability "<name>" is colocated but has no resolvable spec path` if a capability is registered with a `spec` path that isn't there, and the whole living-specs config fails to load, not just that capability.

This is **incremental** — it appends one capability per confirmed proposal; it never bootstraps the whole repo and never rewrites unrelated capabilities. Re-running it for an already-registered name is a safe no-op. After it appends, confirm the resolver recognizes the area:

```bash
python3 .specify/extensions/companion/scripts/resolve-spec-paths.py --changed <a file under the area> --json
```

The new capability should appear in `matched[]`.

If you have no terminal tool, report the exact `register-capability.py` command you would run for each capability (with the resolved name, match, and spec) so the developer can run it, and continue.

### 5. Report

Summarize, in plain language: which capabilities you proposed and registered, the storage layout used (and any capability that deviated from it), where each living spec was drafted, how many requirements each carries, how many were tagged `[inferred]`, how many clarifications you walked and how they landed (resolved / kept / dropped), any **defects** the clarification walk turned up, and what landed under `## Uncovered`. Make clear the drafts are `[DRAFT]` starting points to review, not finished specs.

## Boundaries

- **Opt-in and isolated.** This command changes no existing command's behavior and touches no spec's lifecycle. It only creates `capabilities/<name>/spec.md` files and appends to the capability registry.
- **The layout is the developer's call.** Never assume central because it is the default. Ask when it was not specified, and show the resulting spec paths before writing anything.
- **Only what was named.** Adopt the areas the developer named or chose, and nothing else. Several areas in one run is fine; silently widening past the agreed scope is not.
- **Specify, don't transcribe.** A requirement that a prop rename would falsify is a bug in the draft, not a detail. Fewer, durable requirements beat an exhaustive inventory of the code.
- **Write the shape the pipeline can update.** Named `###` requirements with scenarios, never numbered `FR-` bullets, and never `###` section groupings. Fold-back matches requirements by heading text; a spec in any other shape is one the pipeline can silently fail to update.
- **Honest by construction.** The `[inferred]` tag, clarification markers, and the `## Uncovered` section are required — a surface draft that hid its blind spots would be worse than no draft.
- **Never fail the host.** A missing resolver, missing helper, or unparseable config is reported and skipped, not crashed through.
