---
id: load-living-specs
kind: investigate
command: specify
reads: [resolve-dir]
---
**Load living specs — arrive pre-briefed (best-effort, opt-in, read-only).** Before drafting, check whether this project keeps **living specs** for the areas this change touches, and if so fold them into your context so you are not re-learning the codebase from scratch. This whole step is **opt-in by presence** and must **never** fail or slow the command — on any miss (no config, feature off, no resolver, no spec file) skip silently and draft as usual. It is strictly **read-only**: never create or edit a `capabilities/<name>/spec.md` from here.

   - **Record deterministically first — never hand-judge the gate.** Don't decide "is this project configured?" or "which capabilities apply?" yourself; that judgment is exactly what silently skipped the load on real runs. Run the deterministic recorder with the files this change will touch (the surface you've identified for the feature; if none are known yet, skip the load). It re-reads the registry (`living-specs.yml`, or a legacy `livingSpecs` block in `.specify/companion.yml`), gates on `enabled`, runs the resolver, writes the matched capabilities (leaf-first) onto `livingSpecs.loaded`, **and writes the one-line `last_action` audit breadcrumb itself** — so "correctly did nothing" and "capture broke" stay distinguishable without any AI prose:
     ```bash
     python3 .specify/extensions/companion/scripts/record-living-specs.py --feature-dir <feature_directory> --changed <in-scope files…>
     ```
     This writes only additive `livingSpecs.loaded` + the breadcrumb on `.spec-context.json`; it never touches the lifecycle log. It is a silent no-op that exits 0 when the feature is off, nothing matches, or the registry/resolver can't be read — so it never fails or slows the command; and, exactly like every other capture call here, skip it silently if `python3` or the script is unavailable. This call is the reliable record the later `plan` step and the Overview chips read.
   - **Then read what it recorded, leaf first.** Read `livingSpecs.loaded` back from `<feature_directory>/.spec-context.json`. If it is empty, there is nothing to load — continue to the spec draft. Otherwise, for each recorded capability (in the recorded order — most-specific first), resolve its spec path and read it into your working context:
     ```bash
     python3 .specify/extensions/companion/scripts/resolve-spec-paths.py --changed <in-scope files…> --json
     ```
     Read each match's `spec` path (centralized capabilities resolve to `capabilities/<name>/spec.md`; colocated ones carry their own path): the leaf capability is the **primary** frame for this change, a parent capability is the surrounding **context**. Skip any the resolver marked `"exists": false` (or missing on disk); load the rest. These living specs are background you must honor while drafting — they describe how the area already behaves. This reading is best-effort context; the recorder above is the reliable write.

