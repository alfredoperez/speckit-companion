# Plan: SpecKit Companion spec-kit Extension — Foundation & State-Write Spike

**Spec**: [spec.md](./spec.md)

## Approach

Add a new top-level `speckit-extension/` that mirrors spec-kit's bundled `git` extension shape exactly — `extension.yml` (manifest) → `commands/speckit.companion.capture.md` (agent-run command-markdown) → `scripts/write-context.py` (the actual writer) — registering a single `after_specify` hook. The writer resolves the active feature dir using spec-kit's own precedence, then does a crash-safe read-merge-write of `.spec-context.json` with Companion-canonical values (`currentStep: specify`, `status: specified`, an appended `by: extension` transition). The only GUI-side change is a one-value backward-compatible alignment of the canonical JSON schema (add `implemented` to the `status` enum to match the TS `Status` type). We then register the hook in the repo's checked-in `.specify/extensions.yml` fixture and run a real `/speckit.specify` to prove the chain end-to-end.

## Architecture

```mermaid
graph LR
  A[/speckit.specify] --> B[after_specify hook]
  B --> C[speckit.companion.capture.md]
  C --> D[write-context.py]
  D --> E[.spec-context.json<br/>atomic write]
  E --> F[Companion GUI<br/>re-renders]
```

## Files

### Create

- `speckit-extension/extension.yml` — manifest mirroring `.specify/extensions/git/extension.yml`: `schema_version: "1.0"`; `extension.id: companion`, name/version/description/author/license; `requires.speckit_version: ">=0.8.5"`; `requires.tools: [python3 (required:false)]`; `provides.commands: [speckit.companion.capture → commands/speckit.companion.capture.md]`; `hooks.after_specify: { command: speckit.companion.capture, optional: false }`. No other hooks.
- `speckit-extension/commands/speckit.companion.capture.md` — command-markdown (frontmatter `description:` + body) that: states it runs after specify; resolves the active feature dir (prefer passing it explicitly if known, else let the script resolve); runs `python3 speckit-extension/scripts/write-context.py --step specify --status specified --by extension` (optionally `--feature-dir <dir>`); degrades gracefully if `python3` is unavailable (warn, skip). Carries no business logic itself — mirrors `speckit.git.feature.md`'s "run this script" pattern.
- `speckit-extension/scripts/write-context.py` — the writer (stdlib only). Responsibilities below in Data Model + Testing.
- `speckit-extension/README.md` — what the extension is, the version floor rationale, the **manual end-to-end proof procedure** (R015), and the `--ai-skills` / install note. Keeps the proof reproducible for later phases.

### Modify

- `src/core/types/spec-context.schema.json` — add `"implemented"` to the `status` enum (line ~24), aligning the JSON schema with the canonical TS `Status` type. Backward-compatible (additive enum value). **No change to `specContext.ts`** — it already has `implemented`.
- `.specify/extensions.yml` — register `companion`: add `companion` to `installed: []`, and append a `companion` entry under the existing `after_specify:` hook list (alongside `git`'s `speckit.git.commit`), `enabled: true`, `optional: false`. Leave every `git` registration untouched.

## Data Model

`write-context.py` operates on the canonical `.spec-context.json` (schema: `src/core/types/spec-context.schema.json`). Behavior:

- **Active-dir resolution** (mirror spec-kit's real precedence, most-specific first):
  1. `--feature-dir <dir>` CLI arg if passed by the command-markdown.
  2. `SPECIFY_FEATURE_DIRECTORY` env (a path), if set.
  3. `SPECIFY_FEATURE` env (a feature name) → `specs/<name>` or numeric-prefix match `specs/<prefix>-*`.
  4. `.specify/feature.json` → `feature_directory`.
  5. git current branch → numeric-prefix match `specs/<prefix>-*` (per `common.sh find_feature_dir_by_prefix`).
  - Never the "most-recently-modified dir containing tasks.md" rule.
- **Read-merge** (R008/R010): if the target `.spec-context.json` exists, load it and preserve every existing top-level key (incl. unknown / Companion-owned like `reviewComments`). If absent, create with the schema's required set: `workflow` (default `"speckit"`), `specName` (from `spec.md` H1, else slug), `branch` (current git branch), `currentStep`, `status`, `stepHistory`, `transitions`.
- **Canonical write**: set `currentStep="specify"`, `status="specified"`, `updated=<today>`; ensure `stepHistory.specify` has `startedAt`/`completedAt`; never emit `currentStep:"done"` (R009).
- **Append-only transitions** (R008/NFR001): append `{ step:"specify", substep:null, from:<prior {step,substep} or null on first write>, by:"extension", at:<iso> }`. Never rewrite/shrink the array.
- **Atomic write** (NFR001): write to `<file>.tmp` in the same dir, `os.replace()` over the target.

## Testing Strategy

- **Script self-test (manual/CLI)**: run `write-context.py` against (a) a missing file → asserts a valid canonical file is created with one `from:null` transition; (b) an existing SDD-authored file → asserts unknown keys preserved, transitions appended (length grows by 1), `from` set to prior state, `status`→`specified`. Use a throwaway temp `specs/_zzz-writer-probe/` and delete after.
- **End-to-end proof (R015, the actual de-risk)**: with `companion` registered in `.specify/extensions.yml`, run a real `/speckit.specify "<throwaway feature>"` in this repo; confirm the new `specs/<NNN>-<slug>/.spec-context.json` carries `currentStep:specify` / `status:specified` / a `by:extension` transition; open the SpecKit Companion sidebar/viewer and confirm it renders that spec at **specify / specified** with no GUI code change. Record outcome in `speckit-extension/README.md` + PR description. Clean up the throwaway spec after.
- **Schema sanity**: confirm the canonical file validates against the updated `spec-context.schema.json` (the added `implemented` value doesn't break existing files).

## Risks

- **Exact `after_specify` version floor unconfirmed**: the spec-kit release that first wired `after_specify`/`after_plan` isn't pinned to a number here. Mitigation: declare `>=0.8.5` (the workflow `integration:auto` floor, which is conservative) and note in `README.md` to confirm/raise once the wiring release is verified against the installed spec-kit.
- **Hook may not fire (agent-mediated)**: spec-kit hooks are prompt-driven; the agent must obey the `after_specify` prompt. This spike's whole point is to observe whether it fires. Mitigation: `optional:false` to maximize auto-run; the README proof documents the observed behavior; derive-from-files fallback is deferred (out of scope) but noted as the backstop for later.
- **`feature.json` may point at a stale feature**: `.specify/feature.json` currently references an old spec; relying on it alone could write the wrong dir. Mitigation: resolution precedence puts explicit `--feature-dir`/env ahead of `feature.json`, and after a fresh specify the git extension updates `feature.json` to the new dir.
