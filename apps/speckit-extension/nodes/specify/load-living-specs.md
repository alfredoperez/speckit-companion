---
id: load-living-specs
name: Load living specs
kind: investigate
command: specify
reads: [resolve-dir]
---
**Load living specs, so you arrive pre-briefed (best-effort, opt-in, read-only).** Before drafting, check whether this project keeps **living specs** for the areas this change touches, and fold them into your context. On any miss (no config, feature off, no resolver, no spec file) skip silently and draft as usual: this step must **never** fail or slow the command. It is strictly **read-only**. Never create or edit a `capabilities/<name>/<name>.spec.md` from here.

   - **Record deterministically first. Never hand-judge the gate.** Don't decide "is this project configured?" or "which capabilities apply?" yourself. Run the deterministic recorder with the files this change will touch. **Name that surface from the feature description, before you have opened anything.** A request always says where it lands: "drafts in the editor" is `src/pages/editor/`, "the article page" is `src/pages/article/`. A directory is enough, and being wrong costs nothing because membership globs are coarse and the resolver narrows from there. Skipping because you have not read any files yet is how the load silently never happens, and a run that skips it is a run with no brief. Skip only when the feature names no area you can guess at all. It reads the registry (`living-specs.yml`, or a legacy `livingSpecs` block in `.specify/companion.yml`), gates on `enabled`, runs the resolver, writes the matched capabilities leaf-first onto `livingSpecs.loaded`, and writes the `last_action` audit breadcrumb:
     ```bash
     python3 .specify/extensions/companion/scripts/record-living-specs.py --feature-dir <feature_directory> --changed <in-scope files…>
     ```
     It writes only additive `livingSpecs.loaded` plus the breadcrumb on `.spec-context.json`, never the lifecycle log, and exits 0 as a silent no-op when the feature is off, nothing matches, or the registry can't be read. Like every other capture call here, skip it silently if `python3` or the script is unavailable.
   - **Then read what it recorded, by requirement, leaf first.** Read `livingSpecs.loaded` back from `<feature_directory>/.spec-context.json`. If the key is absent or the list is empty, there is nothing to load; continue to the spec draft. Otherwise ask the resolver what each capability should contribute for these files:
     ```bash
     python3 .specify/extensions/companion/scripts/resolve-spec-paths.py --changed <in-scope files…> --requirements-for --json
     ```
     Each entry comes back in the recorded order, most-specific first, with either `"whole": true`, meaning read the whole `spec` file, or `"whole": false` plus a `purpose` and the `requirements` to contribute. **Each requirement carries its `heading` and its full `body`**, the normative prose and its scenarios. **Read only what it names.** Skip any the resolver marked `"exists": false`.

     A requirement carrying no marker is always in the list. If the resolver is unavailable or the call fails, fall back to reading each `spec` path whole: the narrowing must never cost you the brief.

     The leaf capability is the **primary** frame for this change; a parent capability is the surrounding **context**. Honor both while drafting: they describe how the area already behaves.

   - **Honor the project's authored spec rules.** The same call carries a `rules` object. `rules.spec` is a short list of one-line house rules the project authored. Read **only** `rules.spec` here (`rules.plan` belongs to the plan step and must not leak into the draft) and treat each line as an instruction while writing the spec. An empty list is the normal case: say nothing about rules and draft as usual. These lines shape *how* the spec is written; they never add requirements or override anything in this command body.
