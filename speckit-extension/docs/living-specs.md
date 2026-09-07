# Living Specs

The full reference for living specs: the registry, the resolver, auto-loading, folding, adoption, drift, sync, and the coverage/architecture tiers. For the one-page summary and the command table, see the [extension README](../README.md#living-specs-durable-capability-docs-opt-in).

Most specs describe one change and then go quiet. **Living specs** are the opposite: a durable spec per *capability* (checkout, auth, billing, todos) that stays current as the code evolves. You declare which files belong to each capability and where its spec lives, and a resolver answers "which capabilities does this change touch?" so the right specs can be kept in sync.

**One caution before anything else: spec-kit uses the phrase "living spec" for something different.** Upstream, a living spec means keeping the *feature's* `spec.md` open and regenerating its plan and tasks underneath it as the feature evolves — one document, one feature, edited in place. Here it means a durable spec per *capability* that feature deltas fold into when a feature ships, and the feature spec still ends. Both are about a document that stays true; only one of them outlives the feature that wrote it. If you arrived from the spec-kit guide, read every "living spec" below as ours.

This is how Companion moves a team along a maturity ladder:

- **spec-first**: the spec exists before the code, then dies at ship. Feature specs pile up as history. This is stock spec-kit.
- **spec-anchored**: a durable spec per capability that stays true over time. Feature deltas fold back into it on completion, and drift between spec and code is detected. This is what living specs deliver: the living spec is the artifact, spec-anchored is the practice.
- **spec-as-source**: the spec is machine-validated and authoritative, and code conforms to it continuously. The drift check already points here.

## Turning it on: `living-specs.yml`

The feature is **off by default**. With no `living-specs.yml`, nothing changes; every command behaves exactly as it does without the feature. To turn it on, create `living-specs.yml` at the root of your project:

```yaml
enabled: true
capabilities:
  - name: checkout
    match: ["src/checkout/**"]        # files that belong to this capability
    exclude: ["src/checkout/**/*.test.ts"]   # optional, subtracted from membership
  - name: checkout-cart
    match: ["src/checkout/cart/**"]
    # spec defaults to capabilities/checkout-cart/spec.md
  - name: billing
    match: ["src/billing/**"]
    spec: src/billing/billing.spec.md  # colocated, lives next to the code
```

`living-specs.yml` sits at the project root on purpose: it is yours, it belongs in version control alongside the specs it registers, and keeping it out of `.specify/` means the routine cleanup that re-creates that folder can never wipe your registrations. If your project still keeps capabilities in the older `.specify/companion.yml`, they keep working as they are, and the next time you register or move a capability they are carried across for you.

Each capability has a `name`, the `match` globs that define which files belong to it, an optional `exclude`, an optional `retire`, and where its living spec lives. By default a capability's spec is **centralized** at `capabilities/<name>/spec.md`; give an explicit `spec` path to **colocate** it next to the code. A spec file uses the `.spec.md` extension (the hot tier loaded today); the reserved `.arch.md` / `.coverage.md` siblings are recognized and never flagged as stray.

## The resolver

The resolver ships as `resolve-spec-paths.py` and runs in three modes. By default it prints a concise human list; add `--json` for the full machine-readable object (names, resolved paths, locations, existence):

```bash
# Which capabilities own a changed file? (most-specific first)
python3 .specify/extensions/companion/scripts/resolve-spec-paths.py --changed src/checkout/cart/x.ts
#   [checkout-cart, checkout]

# Every capability + any stray spec on disk (orphans)
python3 .specify/extensions/companion/scripts/resolve-spec-paths.py --all
#   capabilities: [checkout, checkout-cart, todos]
#   orphans: []

# Just the orphans: spec files no capability claims or owns
python3 .specify/extensions/companion/scripts/resolve-spec-paths.py --orphans
#   []

# Add --json for the full record the sync/fold/drift steps consume
python3 .specify/extensions/companion/scripts/resolve-spec-paths.py --changed src/checkout/cart/x.ts --json
```

**Both layouts are scanned.** A colocated spec (`src/billing/billing.spec.md`) and a central one (`capabilities/billing/checkout.spec.md`) are equally visible to discovery, so an unregistered central spec shows up as an orphan instead of quietly belonging to nothing. This matters most during adoption: a capability whose match globs span several directories has no single folder to colocate into, so it gets a central spec by necessity.

An orphan is a spec that no capability claims **and** that does not live inside a configured capability's spec directory, so another file under `capabilities/checkout/` (or a reserved `.arch.md` / `.coverage.md` sibling) is never flagged as stray.

**Nested projects are off limits.** Any directory below the root that has its own `living-specs.yml` (or a legacy `.specify/companion.yml`) is a separate project, and the scan stops at it, the way a search tool stops at a nested ignore file. Sample apps, fixtures, and sandboxes living inside your repo answer for their own living specs; they never show up in the parent's orphan list and are never promoted into the parent's capabilities. That holds whatever the nested config says, including one that turns living specs off, so opting a sandbox out really does mean nothing happens to it. Installed dependencies under `node_modules` are skipped on the same grounds: a spec shipped inside a package you depend on belongs to that package, not to you.

## Auto-loading living specs into specify & plan

When living specs are turned on, you stop re-explaining the codebase. As you start a feature, Companion looks at the files the change touches, finds the capabilities they belong to, and reads those capabilities' living specs into the assistant's context **before it drafts**, most-specific first, so the leaf capability is the primary frame and any parent capability sits behind it as context. The `specify` step records which capabilities it loaded, and the `plan` step reuses that record instead of resolving again.

This stays opt-in by presence and never blocks a run: with no registry or `enabled: false`, specify and plan behave exactly as they do today (no load, no recording). A capability that matches but whose spec file isn't written yet is silently skipped, and specify/plan are strictly read-only: they never create or edit a living spec. The loaded capability names are stored on the spec's context under a `livingSpecs.loaded` list (additive metadata, never a lifecycle field), which is what lets `plan` reuse them.

## Folding feature deltas back into the living spec on completion

A feature spec is a one-time proposal. When you finish a feature, the change it described should become part of the durable record. At completion, Companion asks the assistant to write a delta section for each capability the feature loaded **and** changed, and those deltas **fold into each capability's living spec** the moment you mark the spec complete. The feature spec was the proposal; the living spec becomes the record. (This is OpenSpec's "archive" step.) Because the deltas are written by the assistant into the feature's spec file (`<short-name>.spec.md`), they land in the feature's PR diff, so the change to the durable spec is reviewed alongside the code, not applied blindly.

The deltas are top-level sections in the feature's spec file (`<short-name>.spec.md`), using the requirement-and-scenario shape, one section per changed capability with a `<!-- capability: <name> -->` marker so each routes to the right spec:

```markdown
## ADDED Requirements
<!-- capability: checkout -->

### Users can set a due date on a todo

#### Scenario: set a due date
- WHEN a user picks a date for a todo
- THEN the todo shows the due date
```

Four section types are recognized: `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, and `## RENAMED Requirements` (a rename reads `### Old name -> New name`). At completion, each section applies to its capability's `capabilities/<name>/spec.md`: adds append, modifies replace, removes delete, renames rewrite the heading. A feature that changed several capabilities **folds into each of them, and each spec receives only its own requirements**: a section marked for `checkout` never lands in `billing`. An unmarked section folds into the capability the changed files resolved to.

This stays safe: with living specs off there is no fold. A feature spec with no delta section writes nothing (a purely additive change leaves the living spec byte-for-byte unchanged), and re-running completion folds nothing already there; it's idempotent. The synced capability names are recorded on the spec's context under `livingSpecs.synced` (additive metadata, never a lifecycle field). The whole step is best-effort and never fails completion.

When the fold does nothing, it tells you **exactly why** (living specs off, no capability resolved, no delta section, or already up to date) instead of listing all the possibilities at once. If a feature loaded capability specs but its `spec.md` carries no delta section (for example, when nothing about a loaded capability's behavior actually changed), completion names the capabilities you loaded and reminds you there's nothing to fold yet.

## Adopting an existing code area into a living spec

Starting living specs on a codebase you didn't grow this way is the slow part: you'd normally hand-write one spec per area. The **adoption wizard** does the first draft for you, one area at a time. You point `/speckit.companion.living-adopt` at a single code area (say the billing module); it reads that area's surface, proposes a small set of capabilities for *just that area*, and drafts a living spec for each from what the code already exposes.

Because the read is surface-first (exported functions, routes, props, signatures, not a deep behavioral study), every draft wears its limits openly. The whole spec is marked `[DRAFT]`, each requirement is tagged `observed` (drawn straight from the code surface) or `inferred` (an educated guess), genuinely uncertain items carry an inline `[NEEDS CLARIFICATION: …]`, and any file the assistant couldn't read is listed under a `## Uncovered` heading so nobody mistakes a quick draft for a verified spec. You review and confirm, and the wizard registers the capability in `living-specs.yml` so the resolver immediately recognizes it.

Adoption is deliberate and incremental: you run it for the area you care about, it appends one capability at a time (never a whole-repo bootstrap), re-running it for an area that's already registered is a safe no-op, and it changes no other command's behavior. Registration goes through a small helper that reuses the same config reader the resolver does, so it never corrupts a registry it can't fully parse.

## Checking the shape: `living-validate`

A living spec is only worth keeping if what gets folded into it is trustworthy, and until something checked, a requirement with no scenario or a delta pointing at a heading that does not exist landed silently and was found weeks later by whoever next read the file.

```bash
/speckit.companion.living-validate
```

It checks every registered living spec, and the delta sections of every active feature spec, against the shape everything reading them assumes. It is read-only and always exits successfully. Add `--json` for one object per finding.

| Code | Severity | Raised when |
|---|---|---|
| `requirement-without-scenario` | warning | A requirement states a rule and never says how anyone would know it held. |
| `scenario-missing-half` | error | A scenario has a condition and no outcome, or an outcome and no condition. The keywords are recognised with or without emphasis, so `- WHEN …` counts exactly as `- **WHEN** …` does. |
| `duplicate-requirement` | error | Two requirements in one capability share a heading, which is the key fold-back and coverage both join on. |
| `unknown-capability` | error | A delta block is marked for a capability the registry does not list. |
| `delta-heading-not-found` | warning | A MODIFIED or REMOVED entry names a heading the target spec does not carry. |
| `unmatched-touches-glob` | warning | A file marker names a pattern matching nothing on disk. |
| `spec-too-large` | warning | A capability spec passes 8 requirements or 160 lines. Split it into `capabilities/<capability>/<concern>.spec.md`, one file per concern, each with its own registry entry. |
| `added-heading-near-existing` | warning | An ADDED heading restates one the target spec already has, which folds as a second requirement for one behaviour. Use MODIFIED with the existing heading. |
| `unbalanced-fence` | warning | A code fence is opened and never closed, so everything after it is invisible to every reader. |

Severity answers exactly one question: whether the fold stops. **The fold runs these same checks before writing anything**, per capability, and refuses to apply a capability whose deltas carry an error-level finding, naming the finding it refused on. A warning never stops anything — `delta-heading-not-found` is a warning because the fold promotes an unmatched MODIFIED into an addition, which is a defined outcome rather than damage, though a typo'd heading quietly becoming a near-duplicate requirement is still worth saying out loud.

The extension runs the same checks whenever you save a `*.spec.md`, so a break appears in the editor's problem list on the line it is about while you are still looking at it.

## Reading one requirement: `living-show`

A capability's spec runs to hundreds of lines, and nearly every question about one is about a single requirement. `living-show` prints the slice instead of the file, using the same parser the load steps use, so what it prints and what a run reads can never disagree.

```bash
/speckit.companion.living-show --headings checkout
/speckit.companion.living-show --requirement "Users can set a due date"
/speckit.companion.living-show --file src/checkout/cart/index.ts
```

| Flag | Answers |
|---|---|
| `--headings <capability>` | What rules does this capability state? Every requirement heading, in file order, with the count. |
| `--requirement "<heading>"` | What does this one rule say, and how would anyone know it held? The heading, its prose, and its scenarios. Add `--capability <name>` to search one capability. |
| `--file <path>` | Which durable rules describe this file? Grouped by capability, most-specific capability first. |

Read-only, and every answer exits successfully — including "not a registered capability" (which lists the ones that are), "registered but no spec file on disk", "matches no requirement" (which lists the headings that exist), and an ambiguous name (which lists the candidates rather than guessing). Add `--json` when something downstream needs the object.

A requirement with no `touches` marker comes back for every file its capability claims: a marker can only ever narrow, so a partly-marked spec never returns an empty slice.

**In the editor**, the same question is answered without a command. Open any source file a capability claims and the status bar reads `2 living specs`; click it and you get the claiming capabilities, the requirements whose markers match the file underneath each one, and the spec opened on the requirement you pick. The match happens inside the extension, so there is nothing to dispatch and nothing to wait for. Nothing is shown for a file no capability claims, for an exempt file, or when living specs are off.

## House rules: `rules:`

Conventions about *how* your specs and plans should read — "one outcome per scenario", "name the capability each decision belongs to" — are the sentences people retype into a chat window on every run. Write them once in the registry instead:

```yaml
rules:
  spec:
    - "Write every scenario as WHEN/THEN with exactly one observable outcome"
  plan:
    - "Name the capability each decision belongs to, so the fold knows where it goes"
```

`rules.spec` reaches the specify step and `rules.plan` reaches the plan step; neither sees the other's. They ride along on the resolver call each step already makes, so they cost nothing extra, and the run records the guidance it was given beside the capabilities it loaded.

The block is optional and project-wide — there is no per-capability form, because two capabilities matching one change would need a precedence rule nobody has asked for. A `rules:` block that will not parse is skipped with a warning and the step runs exactly as it would have; guidance about how to write a spec must never be the reason a spec is not written.

### A note on `/speckit.converge`

Checked against the pinned spec-kit release: it ships no `/speckit.converge` command, so there is nothing here that overlaps or duplicates it. `/speckit.companion.doctor` reports on a *run's* health — unfinished steps, unjournaled tasks, a step that closed having verified nothing — which is a different question from reconciling a spec with its code, the job `living-drift` and `living-sync` already own. If converge ships upstream later, the overlap to look at is with those two, not with the doctor.

## Retiring a capability

A fold that would leave a capability's spec with **no requirements at all** is refused, and the refusal names the capability. An emptied spec has lost the thing that made it worth keeping, and where a stale spec is recoverable an empty one is not. Emptying one is therefore a deliberate act, declared as one:

```yaml
capabilities:
  - name: legacy-checkout
    match: ["src/legacy/checkout/**"]
    retire: true
```

`retire` is optional and absent reads as false, so every capability that never mentions it behaves exactly as it does today. It is read at one moment — the fold, and only when the fold would otherwise empty the spec.

## Spotting drift

A living spec only stays honest if changes to its area keep flowing back into it, and in practice code keeps moving while the spec sits still. `/speckit.companion.living-drift` is the cheap way to notice. For each capability it lists the source files that changed *since the living spec was last committed*, and tells you how each one slipped:

- **`tracked`**: the file went through the Companion pipeline (it shows up in a feature's `.spec-context.json` changed set) but was never folded back into the living spec. A missed sync.
- **`unspeced`**: the file changed entirely outside the pipeline. The living spec never saw it at all. The more concerning of the two.

```bash
/speckit.companion.living-drift            # human-readable report
/speckit.companion.living-drift --json     # the same data for tooling / CI
/speckit.companion.living-drift --working  # also count uncommitted + untracked changes
```

By default drift reads **committed history only**: work you haven't committed yet is invisible to it. Add `--working` to widen each capability's changed set to the working tree; uncommitted edits, deletions, and untracked files then count as drift too. Everything else is unchanged (same counts, same skip reasons, same always-exits-success contract), and the `--json` object says which mode produced it via a `working` boolean.

Files you don't want tracked (generated code, tests, migrations) are filtered out by an exempt list. It defaults to `*.config.*`, `*.test.*`, and `**/migrations/**`, and you can override it with an `exempt` glob list:

```yaml
enabled: true
exempt: ["**/*.gen.ts", "**/migrations/**"]
capabilities:
  - name: checkout
    match: ["src/checkout/**"]
```

Drift is read-only and always exits success, so a surrounding workflow or CI may treat `unspeced` rows as a gate, but the command itself never blocks a run. With living specs off it reports nothing.

**The summary tells you what actually ran.** A capability whose spec isn't committed yet is skipped with a note (drift needs a committed baseline to diff against), and the run ends on a counts line rather than an all-clear, so a check that never happened can't read as a clean bill of health:

```
ℹ billing: spec.md not yet committed; skipping drift check
ℹ checkout: spec.md not yet committed; skipping drift check
0 checked, 2 skipped (spec.md not yet committed)
```

The `✓ All N checked capabilities in sync.` line is reserved for a run where *every* configured capability was examined and found clean. When some were skipped, the summary states both halves instead, e.g. 2 of 9 capabilities in sync and 7 not checked because their spec.md is not yet committed, so the checkmark can never read as a verdict on the whole configuration. The `--json` output carries a `checked` count alongside the existing `capabilities` and `skipped` lists, so a caller can tell "clean" from "did not run" without parsing prose. The exit code stays `0` throughout, including when everything was skipped: a skip is correct behavior on adoption day, not a failure.

**A CI checkout without enough history is skipped, not guessed at.** Most CI providers clone only the most recent slice of history by default, which leaves drift with no real baseline to compare against. Rather than compare against the oldest commit it happens to have (which produced either a false all-clear or a wrong list of changed files), drift recognizes that case and skips those capabilities, telling you how to fix it:

```
ℹ billing: spec history unreachable (shallow clone); skipping drift check
0 checked, 1 skipped (spec history unreachable (shallow clone))
👉 Fetch the full history to check these (e.g. actions/checkout with fetch-depth: 0).
```

A capability whose spec *was* committed inside the available slice is still checked normally, and a full clone behaves exactly as it always has. If drift cannot read a repository's history at all, it says so (`spec history unreadable`) rather than blaming an uncommitted spec file.

## Syncing from your changes: one pass, uncommitted included

Spotting drift is half the loop; folding it back is the other half. If you code **directly**, with no Companion pipeline, the fold-back used to be three steps with a blind spot: run drift, read it, update each capability by hand, and none of it saw uncommitted work. `/speckit.companion.living-sync` closes that loop in one pass:

```bash
/speckit.companion.living-sync
```

It groups your current changes (uncommitted edits, deletions, and untracked files included, plus anything committed since each capability's spec was last committed) by capability, using the same computation as `living-drift --working` so the report and the sync can never disagree, then updates **every** affected living spec, scoped to that capability's changed files. No hand-picking. Updates are **update-not-regenerate**: every requirement, clarification, and acceptance scenario the change doesn't invalidate survives verbatim, so a sync never flattens hand-written detail into a fresh draft.

It ends with a report of what was synced and what was skipped (with reasons: a capability whose spec was never committed has no baseline and belongs to `/speckit.companion.living-adopt`), and it deliberately does **not** commit: the spec edits sit in your working tree so they can be reviewed and committed together with the code that caused them. Like the rest of the family, it never fails your run.

## Coverage and architecture tiers

A living spec is more than its requirements. Next to a capability's requirements file (centralized `capabilities/<name>/spec.md`, or a colocated `<base>.spec.md`) you can keep two colder siblings sharing that base name: an **architecture** file (`spec.arch.md` / `<base>.arch.md`, structure and the decisions behind the area's shape) and a **coverage** file (`spec.coverage.md` / `<base>.coverage.md`, a requirement-to-tests map). Both are recognized but otherwise reserved until you use them; nothing forces you to write either.

**Architecture loads lazily, only when the change warrants it.** When you plan a change, Companion already reads the requirements of the capabilities it touches. For an architecture-significant change (a `normal` or `oversized` plan, not a small fast-path one) it *also* pulls those capabilities' `.arch.md` files into context, so the plan is briefed on how the area is built. A small change never drags in the cold architecture tier. The resolver derives the tier paths, so you never hardcode a filename, and a capability with no `.arch.md` is simply skipped.

**Coverage tells you which requirements have a test.** `/speckit.companion.living-coverage` reads a capability's requirements and its `.coverage.md` map and reports, per requirement, whether a test is mapped:

```bash
/speckit.companion.living-coverage                 # human-readable report, all capabilities
/speckit.companion.living-coverage --capability billing
/speckit.companion.living-coverage --json          # the same data for tooling / CI
```

A requirement counts as covered when its id (`FR-001`, `NFR-2`, …) appears in the coverage file on a line that also names a test (a `.test.` / `.spec.` path, a `tests/…` reference, or a `file::TestCase` nodeid). Like drift, it's read-only, a signal you act on, not a gate. A capability that ships only its requirements file reports every requirement uncovered (never an error), and with living specs off it reports nothing.
