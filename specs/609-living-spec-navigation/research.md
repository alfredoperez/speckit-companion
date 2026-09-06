# Phase 0 Research: Reach one requirement, from anywhere

## Decision: the slice reader is a subcommand of the existing resolver, not a new script

**Decision**: Add `--headings`, `--requirement <name>` and a `--file` mode to `speckit-extension/scripts/resolve-spec-paths.py`, and have `speckit.companion.living-show.md` call them. No new Python module.

**Rationale**: The resolver already owns `requirement_slices`, `requirements_for_change`, `purpose_section` and the registry load, and already emits `--requirements-for --json` for exactly this data. A new script would either import all of that (a second entry point over the same functions) or reimplement it, which is how a third heading parser gets born. The command body's job is to print, not to parse.

**Alternatives considered**: A `living_show.py` sibling of `living_validate.py` — rejected because `living_validate.py` exists to hold check logic nothing else has, whereas every line `living-show` needs is already in the resolver. A pure-prompt command with no script — rejected because the count it prints must equal the viewer's and the coverage denominator's, and only the shared parser guarantees that.

## Decision: rules are project-wide, keyed by step, and normalized where capabilities are

**Decision**: `load_living_specs_block` in `companion_config.py` gains a `rules` key normalized to `{"spec": [str], "plan": [str]}`, with unknown step keys dropped and any non-list value coerced to an empty list. The resolver exposes them through a `--rules` output and includes them in the `--requirements-for --json` envelope.

**Rationale**: The normalizer is already the one place a registry's shape is decided, it already tolerates junk without raising, and `resolve_living_specs` already returns warnings for a registry it could not read. Putting rules anywhere else would mean a second reader of the same file with its own failure behaviour. Keying by step rather than by capability keeps the resolution order trivial: there is no order.

**Alternatives considered**: Per-capability rules — rejected, since two capabilities matching one change would need a merge and precedence rule nobody has asked for, and the stated need ("stop retyping the house rule") is project-wide. A separate `rules.yml` — rejected as a second config file for four lines of text.

## Decision: rules reach a step through the load node it already runs

**Decision**: The specify step's `load-living-specs` node and the plan step's `gather-context` node each read the rules for their own step out of the resolver call they already make, and treat them as instructions. No new dispatch, no new call.

**Rationale**: Both steps already shell out to the resolver at exactly the moment the rules are needed, and both already know how to degrade when it is unavailable. Riding the existing call means the failure behaviour is inherited rather than re-authored, and the rules cost zero extra process starts.

**Alternatives considered**: Injecting rules at build time into the command bodies — rejected because the bodies are built from `.specify/companion.yml` and frozen against a parity gate, so a project editing its rules would need a rebuild. Rules must be readable at run time.

## Decision: the status bar computes claims in-process and reuses the viewer to show them

**Decision**: A new `livingSpecsStatusBar.ts` calls `readLivingSpecs` and `globMatches` — both already exported — against the active editor's workspace-relative path, shows `$(book) N living specs`, and on click builds a quick-pick from the claiming capabilities plus, under each, the requirements whose `touches` marker matches. Picking one calls `speckit.viewSpecDocument` with `{ living: true, requirement: <heading> }`.

**Rationale**: Everything needed is already exported from the model, the registry read is a file read and a few regexes, and the Living Specs tree already opens specs through `speckit.viewSpecDocument`. The only new plumbing is carrying an optional requirement heading through to the webview so the viewer scrolls to the right card, which the outline in `toc.ts` can already address by card.

**Alternatives considered**: A CodeLens at the top of each file — rejected as intrusive on every file in the project and heavier to compute per-document. Dispatching `living-show --file` from the editor — rejected outright: the spec forbids dispatch here, and the answer is a glob match the extension can do itself in under a millisecond.

## Decision: the indicator stays silent rather than showing zero

**Decision**: Hide the status bar item when the count is zero, when living specs are disabled, when the active editor is not a workspace file, and when the file matches an exempt glob.

**Rationale**: A persistent `0 living specs` on every unclaimed file is noise in a bar that competes for a few hundred pixels, and an absent indicator already reads correctly as "nothing claims this".

**Alternatives considered**: Always visible with a dimmed zero — rejected for the reason above.

## Open question resolved: what the docs paragraph must say

**Decision**: The living specs reference opens by naming both meanings of the phrase — spec-kit's (keep editing the feature's `spec.md` and regenerate plan and tasks under it) and ours (a durable spec per capability that feature deltas fold into) — before any mechanism is described. Whether `/speckit.converge` ships in the pinned spec-kit version is checked during the docs task and the answer recorded there; any overlap with the doctor command is noted, not acted on.

**Rationale**: A reader who carries the upstream meaning into our docs misreads the whole feature, and the fix costs one paragraph placed before the damage is done.
