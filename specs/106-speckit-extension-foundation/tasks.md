# Tasks: SpecKit Companion spec-kit Extension — Foundation & State-Write Spike

**Plan**: [plan.md](./plan.md)

> Format reference: `[P]` markers and parallel groups — see `skills/tasks/SKILL.md` § Phase rules.

## Phase 1: Core Implementation

### Group A — independent foundation files (parallel)

- [x] **T001** [P] Writer script `write-context.py` — `speckit-extension/scripts/write-context.py` | R006, R007, R008, R009, R010, NFR001
  - **Do**: Create a stdlib-only Python script. CLI: `--step` (default `specify`), `--status` (default `specified`), `--by` (default `extension`), optional `--feature-dir`. Resolve the active feature dir by precedence: (1) `--feature-dir`, (2) `SPECIFY_FEATURE_DIRECTORY` env path, (3) `SPECIFY_FEATURE` env name → `specs/<name>` or numeric-prefix match `specs/<prefix>-*`, (4) `.specify/feature.json` `feature_directory`, (5) git current branch → numeric-prefix match. Read-merge `.spec-context.json` if present (preserve ALL existing/unknown top-level keys); else create with required set (`workflow` default `"speckit"`, `specName` from `spec.md` H1 else slug, `branch` from git, `currentStep`, `status`, `stepHistory`, `transitions`). Set `currentStep`/`status`/`updated`; ensure `stepHistory.specify` start/complete; append one transition `{step, substep:null, from:<prior or null>, by, at:<iso>}` (never shrink the array); never emit `currentStep:"done"`. Write atomically via temp file + `os.replace()`.
  - **Verify**: Run against a throwaway `specs/_zzz-writer-probe/` twice — first run creates a valid canonical file with one `from:null` transition; second run appends (length +1, `from` = prior state) and preserves an injected unknown key (e.g. `reviewComments`). Delete the probe dir after.
  - **Leverage**: `.specify/scripts/bash/common.sh` (`find_feature_dir_by_prefix`, `get_current_branch` precedence); `specs/105-workflow-provider-filter/.spec-context.json` (canonical field shape); `src/core/types/spec-context.schema.json` (required fields + enums).

- [x] **T002** [P] Align schema `status` enum — `src/core/types/spec-context.schema.json` | R011
  - **Do**: Add `"implemented"` to the `status` enum (between `"implementing"` and `"completed"`) so the JSON schema matches the canonical TS `Status` type. No other change; do NOT touch `specContext.ts` (already has it).
  - **Verify**: `npm run compile` passes; the existing `specs/*/.spec-context.json` files still validate (additive enum value is backward-compatible).
  - **Leverage**: `src/core/types/specContext.ts` (canonical `Status` ordering).

- [x] **T003** [P] Extension manifest — `speckit-extension/extension.yml` | R001, R002, R003, R004, R013
  - **Do**: Create `extension.yml` mirroring `.specify/extensions/git/extension.yml`: `schema_version: "1.0"`; `extension.id: companion` (+ name/version `0.1.0`/description/author/license); `requires.speckit_version: ">=0.8.5"` and `requires.tools: [{name: python3, required: false}]`; `provides.commands: [{name: speckit.companion.capture, file: commands/speckit.companion.capture.md, description: ...}]`; `hooks.after_specify: {command: speckit.companion.capture, optional: false, description: ...}`. Register NO branch hook (branching defers to the git extension).
  - **Verify**: YAML parses; structure matches the git extension's schema (same top-level keys); only `after_specify` appears under `hooks`.
  - **Leverage**: `.specify/extensions/git/extension.yml` (exact manifest shape).

### Group B — wiring that references Group A (parallel)

- [x] **T004** [P] Capture command-markdown *(depends on T001)* — `speckit-extension/commands/speckit.companion.capture.md` | R005
  - **Do**: Create the command-markdown (frontmatter `description:` + body) mirroring `speckit.git.feature.md`'s "run this script" pattern. Body: states it runs after specify; resolves the active feature dir (pass `--feature-dir` if known, else let the script resolve); runs `python3 speckit-extension/scripts/write-context.py --step specify --status specified --by extension`; degrades gracefully with a warning if `python3` is unavailable. No business logic beyond invoking the script (matching T001's CLI exactly).
  - **Verify**: Markdown invocation flags match `write-context.py`'s CLI from T001; graceful-degradation line present.
  - **Leverage**: `.specify/extensions/git/commands/speckit.git.feature.md` (command-markdown structure + graceful-degradation wording).

- [x] **T005** [P] Register hook in fixture *(depends on T003)* — `.specify/extensions.yml` | R014
  - **Do**: Add `companion` to `installed: []`. Append a `companion` entry under the existing `after_specify:` hook list (alongside `git`'s `speckit.git.commit`): `extension: companion`, `command: speckit.companion.capture`, `enabled: true`, `optional: false`, `prompt`/`description` set, `condition: null`. Leave every `git` registration untouched.
  - **Verify**: YAML parses; `after_specify` now lists both `git` and `companion`; no other hook lists changed; `git` entries byte-identical to before.
  - **Leverage**: `.specify/extensions.yml` (existing `after_specify` list shape).

### Group C — end-to-end proof + docs (gate)

- [x] **T006** README + live end-to-end proof *(depends on T001–T005)* — `speckit-extension/README.md` | R015, R003, NFR003
  - **Do**: Write `speckit-extension/README.md` (what the extension is, the `>=0.8.5` floor rationale + a note to confirm the exact `after_specify`-wiring release, install/`--ai-skills` note, and the reproducible manual proof procedure). Then run the proof: trigger a real `/speckit.specify "<throwaway feature>"`, confirm the new `specs/<NNN>-<slug>/.spec-context.json` carries `currentStep:specify` / `status:specified` / a `by:extension` transition, and confirm the SpecKit Companion GUI renders it at **specify / specified** with no GUI code change. Record the observed result in the README + PR description. Clean up the throwaway spec after.
  - **Verify**: `.spec-context.json` for the throwaway spec shows the canonical values + `by:extension` transition; GUI screenshot/observation captured; throwaway spec removed; README proof section reflects actual outcome (incl. whether the hook auto-fired).
  - **Leverage**: T001–T005 outputs; the spec's § Testing Strategy.
