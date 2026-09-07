---
id: load-living-specs
name: Load living specs
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
   - **Then read what it recorded — by requirement, leaf first.** Read `livingSpecs.loaded` back from `<feature_directory>/.spec-context.json`. If the key is absent — the recorder writes nothing when the feature is off or nothing matched — or the list is empty, there is nothing to load; continue to the spec draft. Otherwise ask the resolver what each capability should contribute for these files:
     ```bash
     python3 .specify/extensions/companion/scripts/resolve-spec-paths.py --changed <in-scope files…> --requirements-for --json
     ```
     Each entry comes back in the recorded order — most-specific first — with either `"whole": true`, meaning read the whole `spec` file exactly as before, or `"whole": false` plus a `purpose` and the `requirements` to contribute. **Each requirement carries its `heading` and its full `body`** — the normative prose and its scenarios — so a narrowed load is context you already hold, not a table of contents to go and resolve. **Read only what it names.** A capability's spec runs to hundreds of lines and most of them describe behaviour this change will never touch; the requirements listed are the ones that describe the files you are about to change, plus every requirement whose author left it unmarked. Skip any the resolver marked `"exists": false`.

     A requirement carrying no marker is always in the list, so a partly-marked spec never starves you of context — the narrowing can only ever remove requirements that explicitly claim other files. If the resolver is unavailable or the call fails, fall back to reading each `spec` path whole, exactly as before: the narrowing is an optimization and must never cost you the brief.

     The leaf capability is the **primary** frame for this change, a parent capability is the surrounding **context**. These are background you must honor while drafting — they describe how the area already behaves.

   - **Honor the project's authored spec rules.** The same call carries a `rules` object: `rules.spec` is a short list of one-line house rules the project wrote once in its registry rather than retyping into chat on every run. Read **only** `rules.spec` here — `rules.plan` belongs to the plan step and must not leak into the draft — and treat each line as an instruction while writing the spec. An empty list is the normal case: say nothing about rules and draft as usual. These lines shape *how* the spec is written; they never add requirements or override anything in this command body.

