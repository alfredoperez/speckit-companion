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

**Then read the area and work out what it does, and propose that.** Open the routes, the loaders and the entry points, and answer one question: what can a person do here? The answers are the capabilities. `article-reading`, `authoring-an-article`, `signing-in` — things you could say to someone who has never seen the repository. A directory is not a capability: it is where some of one lives. Expect a capability to span several directories and a directory to serve several capabilities, and never produce one per folder, which yields a file per folder saying the folder's name back.

Cutting by directory was tried on a nine-directory `src/pages`: it gave ten capabilities, nine of which said "this slice carries no rule of its own" and nothing else. **If a proposed capability's spec would have no requirement a person outside the team could read, it is not a capability.**

**Propose the layer as one capability of its own**, named for the layer, carrying the whole layer glob and the conventions you transcribed. This is the one that gets an `.rules.md`. Every behaviour capability beside it shares the same coarse membership, so a file is claimed by both and the narrowing happens at the requirement.

Bring the whole list to the developer before writing anything: each capability's name, one line on what it covers, the directories it draws from, and roughly how many requirements you expect. Offer a coarser and a finer cut with the count each would give. **This is where the shape gets decided, and it is theirs to decide.**

For each capability the developer keeps, derive:
- a **name** (a short slug for what it does, e.g. `article-reading`),
- a **match** glob covering every directory it draws from,
- a **spec** path, which depends on the storage layout chosen below.

#### Where the specs go

**The project already answered this. Do not ask again.** Read it:

```bash
python3 .specify/extensions/companion/scripts/resolve-spec-paths.py --all --json
```

The `layout` field is `central` or `colocated`, set when living specs were turned on. An explicit `--layout` in this invocation overrides it; nothing else does. Asking a second time is how a developer answers "central" at set-up and ends up with colocated specs.

- **central** — `capabilities/<capability>/<name>.spec.md`. One folder per capability. The spec stays put when code moves.
- **colocated** — `<area>/<name>.spec.md`, in the directory the capability covers. The spec travels with the code and shows up in a folder the developer already has open.

Deriving a **colocated** path: take the capability's match glob, strip the trailing `/**`, and put `<name>.spec.md` in that directory — `src/pages/article/**` → `src/pages/article/article-reading.spec.md`.

**A capability spanning sibling directories goes central even in a colocated project.** Its shallowest common parent is a directory full of other capabilities' code, so a spec placed there sits next to nothing it describes and clutters a folder for everyone. A capability matching `src/pages/login/**`, `src/pages/register/**` and `src/pages/settings/**` has no home under `src/pages/`; it belongs at `capabilities/session-access/session-access.spec.md`. The same goes for a layer capability whose glob is the whole area. A mix is normal and is not worth remarking on.

Two consequences of colocated placement to state out loud, because both surprise people:

1. **The filename stem becomes the capability's display name.** A capability named `speckit-extension-capture` colocated as `capture.spec.md` shows as `capture` in the sidebar. Keep the stem equal to the name, or say what it will display as.
2. **The rules file sits beside its spec**, same stem, `<name>.rules.md`.

Show the proposed capability tree to the developer — names, match globs, and the resolved spec path for each — and pause for confirmation before drafting and registering. This is the one review gate in this command.

### 2. Draft two files per capability: what the area does, and how it is built

**A spec says what the area does. It is not a style guide.** Import direction, file naming, barrels and path helpers are real rules and they are worth keeping, but they describe how the code is written, not what the software does, and a reader who opens a spec to learn what a screen shows should not find a linting policy. Living specs already ship two tiers for exactly this split, and adoption writes both.

**`<name>.spec.md` — the hot tier, read on every run.** What a person can do in this area, in observable terms. Routes and screens, what each one needs before it can render, what happens when the thing asked for is missing, and what changes when nobody is signed in. Derive it from the routes, the loaders and the redirects, which are the area's surface and are stable. Two measured attempts at reading *implementation* produced 447 and 732 lines against a hand-written 255, so the guard is this: **a requirement that names a function, a hook, a component or a file is not observable, and belongs in the rules file or nowhere.** Say what happens, not what calls what.

**`<name>.rules.md` — the cold tier, read only when a plan is large enough to care.** The conventions you transcribed in step 1, as **plain bullets**. Not a spec: no headings per rule, no SHALL, no scenarios. One line per rule, in this order: the rule, where it is stated, what enforces it or `unenforced`. Written the way `CLAUDE.md` says it, because that is where it came from.

```markdown
# Pages — Rules

> [DRAFT] Adopted from the project's conventions. Review before trusting.

- A page imports downward only: widgets, features, entities, shared. Never app, never a sibling page. `CLAUDE.md:18`, unenforced.
- Route paths come from `pathKeys`, never a string literal. `CLAUDE.md:48`, unenforced.
- Files are named `<slice>.<segment>.<ext>`. `CLAUDE.md:31`, unenforced.
```

The file has no per-rule markers; its `[DRAFT]` line alone says it is unreviewed, and approving the spec clears it.

Both files, at the paths chosen at the review gate:

1. **Title** — `# <Capability> — Living Spec`; the rules file is `# <Capability> — Rules`.
2. **Draft banner** on each, `[DRAFT]` first: `> [DRAFT] Adopted from the code's surface and the project's conventions. Review before trusting.` The banner summarises the per-requirement markers below it, so it goes when the last one does.
3. **`## Purpose`** — one or two sentences on why this capability exists and what would go wrong without it.
4. **`## Requirements`** — in the shape the fold and the resolver both read. A spec requirement:

   ```markdown
   ### An article is read by its slug
   <!-- touches: src/pages/article/** -->
   <!-- adopted: src/pages/article/article-page.route.tsx -->

   The article screen SHALL render the article named by the slug in the URL, together with its comments.

   #### Scenario: the URL carries no slug
   - **WHEN** someone opens the article route with no slug
   - **THEN** they are sent to the 404 screen, because an article without a slug is not a screen
   ```

   **Every spec requirement carries an `adopted` marker** under `touches`, naming where it came from: a file and line for a transcribed rule, the source file for an observed behaviour, or `developer` when the answer came from the question in step 1. Adoption is a claim nothing has checked. The viewer badges it, and the fold clears it the first time a change folds onto that requirement, so using a requirement is what confirms it. An unmarked requirement reads as confirmed.

   The `touches` marker on a spec requirement names the files that produce that behaviour. The rules file carries none.

5. **`## Uncovered`** — rules with no owner and areas with no capability. Not files nobody opened.

**A slice with nothing of its own is not registered.** Where a slice's only constraints belong to its layer and it has no distinct behaviour, the layer capability covers it: the resolver matches the file through the layer's glob and hands over the same requirements, so a second entry adds a file, a tree row and nothing else. Say in the report which slices you left out and why. They arrive as capabilities later, when a run folds something into one of them the layer does not already say.

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

**Pass `--spec` for every capability**, central or colocated, with the same path you drafted the spec to. A spec is named for what it describes, so `spec.md` is never a filename you write and six open tabs stay tellable apart. The helper emits `spec` only when it differs from the registry's default, `capabilities/<name>/<name>.spec.md`, which keeps the config terse.

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

- **Opt-in and isolated.** This command changes no existing command's behavior and touches no spec's lifecycle. It only creates spec files and appends to the capability registry.
- **The layout is the developer's call.** Never assume central because it is the default. Ask when it was not specified, and show the resulting spec paths before writing anything.
- **Only what was named.** Adopt the areas the developer named or chose, and nothing else. Several areas in one run is fine; silently widening past the agreed scope is not.
- **Specify, don't transcribe.** A requirement that a prop rename would falsify is a bug in the draft, not a detail. Fewer, durable requirements beat an exhaustive inventory of the code.
- **Write the shape the pipeline can update.** Named `###` requirements with scenarios, never numbered `FR-` bullets, and never `###` section groupings. Fold-back matches requirements by heading text; a spec in any other shape is one the pipeline can silently fail to update.
- **Honest by construction.** The `[inferred]` tag, clarification markers, and the `## Uncovered` section are required — a surface draft that hid its blind spots would be worse than no draft.
- **Never fail the host.** A missing resolver, missing helper, or unparseable config is reported and skipped, not crashed through.
