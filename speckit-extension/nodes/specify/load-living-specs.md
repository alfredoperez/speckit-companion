---
id: load-living-specs
kind: investigate
command: specify
reads: [resolve-dir]
---
**Load living specs — arrive pre-briefed (best-effort, opt-in, read-only).** Before drafting, check whether this project keeps **living specs** for the areas this change touches, and if so fold them into your context so you are not re-learning the codebase from scratch. This whole step is **opt-in by presence** and must **never** fail or slow the command — on any miss (no config, feature off, no resolver, no spec file) skip silently and draft as usual. It is strictly **read-only**: never create or edit a `capabilities/<name>/spec.md` from here.

   - **Gate first.** If the capability registry (`living-specs.yml`, or a legacy `livingSpecs` block in `.specify/companion.yml`) is absent, or `enabled` is not true, there is nothing to load — continue to the spec draft. Leave the one-line audit breadcrumb so a later reader can tell "correctly did nothing" from "capture broke" (best-effort, then move on without a word):
     ```bash
     python3 .specify/extensions/companion/scripts/write-context.py --feature-dir <feature_directory> --set last_action="living specs evaluated — skipped (not configured)"
     ```
   - **Resolve the capabilities in scope.** From the files this change will touch (the surface you've identified for the feature; if none are known yet, skip the load), ask the shipped resolver which capabilities own them, in most-specific-first order:
     ```bash
     python3 .specify/extensions/companion/scripts/resolve-spec-paths.py --changed <in-scope files…> --json
     ```
     The resolver is inert when the feature is off, so a non-empty `matched` list already means living specs apply. Read each match's `spec` path.
   - **Read the living specs, leaf first.** For each matched capability, read the `spec` path the resolver returned for it (centralized capabilities resolve to `capabilities/<name>/spec.md`; colocated ones carry their own path) into your working context **in the resolver's order — most-specific first**: the leaf capability is the **primary** frame for this change, a parent capability is the surrounding **context**. Skip any the resolver marked `"exists": false` (or that is missing on disk); load the rest. These living specs are background you must honor while drafting — they describe how the area already behaves.
   - **Record what applies — deterministically.** Don't hand-judge whether living specs are configured or which capabilities to record; run the deterministic recorder with the files this change touches. It re-reads the registry, gates on `enabled`, runs the same resolver, and writes the matched capabilities (leaf-first) onto `livingSpecs.loaded` itself — so the record can't be skipped by a misjudged "not configured":
     ```bash
     python3 .specify/extensions/companion/scripts/record-living-specs.py --feature-dir <feature_directory> --changed <in-scope files…>
     ```
     This writes only the additive `livingSpecs.loaded` list on `.spec-context.json`; it never touches the lifecycle log, and it is a silent no-op (exit 0) when the feature is off, nothing matches, or `python3`/the script is unavailable — so it never fails the command. The AI reading above stays best-effort context for drafting; this call is the reliable record the later `plan` step and the Overview chips read.

