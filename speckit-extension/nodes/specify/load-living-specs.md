---
id: load-living-specs
kind: investigate
command: specify
reads: [resolve-dir]
---
**Load living specs — arrive pre-briefed (best-effort, opt-in, read-only).** Before drafting, check whether this project keeps **living specs** for the areas this change touches, and if so fold them into your context so you are not re-learning the codebase from scratch. This whole step is **opt-in by presence** and must **never** fail or slow the command — on any miss (no config, feature off, no resolver, no spec file) skip silently and draft as usual. It is strictly **read-only**: never create or edit a `capabilities/<name>/spec.md` from here.

   - **Gate first.** If `.specify/companion.yml` is absent, or its `livingSpecs.enabled` is not true, there is nothing to load — continue to the spec draft without a word.
   - **Resolve the capabilities in scope.** From the files this change will touch (the surface you've identified for the feature; if none are known yet, skip the load), ask the shipped resolver which capabilities own them, in most-specific-first order:
     ```bash
     python3 .specify/extensions/companion/scripts/resolve-spec-paths.py --changed <in-scope files…> --json
     ```
     The resolver is inert when the feature is off, so a non-empty `matched` list already means living specs apply. Read each match's `spec` path.
   - **Read the living specs, leaf first.** For each matched capability, read the `spec` path the resolver returned for it (centralized capabilities resolve to `capabilities/<name>/spec.md`; colocated ones carry their own path) into your working context **in the resolver's order — most-specific first**: the leaf capability is the **primary** frame for this change, a parent capability is the surrounding **context**. Skip any the resolver marked `"exists": false` (or that is missing on disk); load the rest. These living specs are background you must honor while drafting — they describe how the area already behaves.
   - **Record what you loaded** so the later `plan` step reuses it instead of re-resolving (run once, listing every capability you actually read, leaf-first):
     ```bash
     python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --living-specs <leaf> --living-specs <parent> …
     ```
     This writes only the additive `livingSpecs.loaded` list on `.spec-context.json`; it never touches the lifecycle log. If `python3` or the script is unavailable, skip this recording without failing the command.

