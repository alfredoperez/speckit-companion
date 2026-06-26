# Research: Spec Explorer Sidebar View

## Decision 1 — Read the living-specs config node-side (TypeScript), not by shelling to Python

**Decision**: Re-implement the resolver's *listing* rules in a small TypeScript module (`livingSpecsModel.ts`) using the already-bundled `js-yaml` dependency, rather than shelling out to `speckit-extension/scripts/resolve-spec-paths.py --all --json`.

**Rationale**: The resolver is the canonical rules engine, but the bundled `.vsix` does not ship `speckit-extension/scripts/**` (Extension Isolation rule) and must not depend on a Python runtime being present. Listing only needs a narrow slice of the resolver's rules: parse the `livingSpecs` block, resolve each capability's spec path, check tier-sibling existence, and glob for orphans. That slice is small and stable enough to mirror in TS. A tree view that refreshes on every config/file change should also not pay a subprocess cost per refresh.

**Alternatives considered**:
- *Shell to `resolve-spec-paths.py --all --json`* — documented as the safe fallback (the view is gated on companion-installed, so Python-side scripts are present in-workspace). Rejected as the default because the extension ships in isolation and should not require Python on the render path; kept as a conceptual fallback only.
- *Reuse a TS reader from LS·7* — none exists. LS·7's `LivingSpecsCard` reads the `livingSpecs` field already folded into `.spec-context.json`, not the `companion.yml` config block, so there is nothing to reuse.

## Decision 2 — Mirror the resolver's path/tier/orphan rules exactly

**Decision**: The node-side model reproduces these resolver rules:
- **Spec path**: default `capabilities/<name>/spec.md`; an explicit `spec` value (colocated) overrides it.
- **Location label**: `centralized` when the resolved spec equals `capabilities/<name>/spec.md`, else `colocated`.
- **Tiers**: derive `<base>.arch.md` and `<base>.coverage.md` siblings from the spec path (strip a trailing `.spec.md`, else `.md`); show a tier only when its file exists on disk.
- **Orphans**: glob `**/*.spec.md`, excluding the `specs/` folder, reserved tier siblings (`.arch.md` / `.coverage.md`), claimed spec paths, and any file inside a configured capability's spec directory.
- **De-dupe**: capabilities resolving to the same spec path collapse to one entry.

**Rationale**: Divergence between the view's listing and the resolver's would mislead. Keeping the suffixes (`.arch.md`, `.coverage.md`), the default capability root (`capabilities`), and the `specs/` exclusion identical to `companion_config.py` / `resolve-spec-paths.py` keeps the two in agreement.

**Alternatives considered**: A looser "anything ending in `.spec.md`" listing — rejected because it would surface reserved tiers and feature specs as orphans, breaking SC-001's "zero false orphans".

## Decision 3 — Glob matching: a single `*` must not cross `/`

**Decision**: The exclude/membership glob matcher compiles `*` → `[^/]*` and `**` → `.*`, normalizes `\` to `/`, and treats a trailing `/**` as also matching the bare directory — matching the resolver's `_glob_to_regex`.

**Rationale**: Review-checklist item (#361): a naive glob lets `*` match path separators and over-claims membership. Mirroring the resolver's POSIX-path semantics avoids that and keeps capability membership correct.

**Alternatives considered**: Using Node's `fs.glob` / a third-party matcher with default semantics — rejected; default `*` often crosses `/`, reintroducing the bug.

## Decision 4 — Gate visibility on the existing installed-state key

**Decision**: The `package.json` view `when` clause is `!(workbenchState == empty || workspaceFolderCount == 0) && speckit.companion.installed`. No new detection logic.

**Rationale**: `speckit.companion.installed` is already set in `extension.ts` (from `isCompanionInstalled()`, an on-disk `.specify/extensions/companion/` check) and is already kept current by a `FileSystemWatcher`. Composing with the workspace-non-empty guard matches the other SpecKit views.

**Alternatives considered**: A new context key or a config flag — rejected as redundant detection.

## Decision 5 — Open the file directly, not the rich spec viewer

**Decision**: Activating a capability/tier/orphan node runs `vscode.open` on the file URI.

**Rationale**: The explorer is a flat project-wide index; opening the markdown file is the natural fit and matches how `steeringExplorerProvider` opens its documents. The rich spec viewer is feature-spec-shaped (status lifecycle, step tabs), which living specs do not have.

**Alternatives considered**: Routing through `speckit.viewSpecDocument` / the webview viewer — rejected as a mismatch for capability documents.
