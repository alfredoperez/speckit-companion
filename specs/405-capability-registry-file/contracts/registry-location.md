# Contract: where the capability registry lives

The interface every reader and writer codes against. Two implementations — one per language runtime — and they must agree.

## Verbatim identifiers

Pinned by the spec; never rename, recase, or pluralize.

| Identifier | Meaning |
|---|---|
| `living-specs.yml` | The registry file, at the project root |
| `.specify/companion.yml` | The legacy location |
| `git restore package.json package-lock.json .specify/` | The cleanup step the registry must survive |

## Python — `speckit-extension/scripts/companion_config.py`

```
LIVING_SPECS_REL = "living-specs.yml"
LEGACY_CONFIG_REL = ".specify/companion.yml"   # os.path.join form

resolve_living_specs(root) -> (living, meta)
```

- `living` is the existing normalized shape: `{"enabled": bool, "exempt": [glob], "capabilities": [{name, match, exclude, spec}]}`.
- `meta` is `{"origin": "registry" | "legacy" | "none", "path": str | None, "legacy_stale": bool, "warnings": [str], "errors": [str]}`. `warnings` are advisory (a stale legacy block); `errors` mean a file was present but unreadable, which is what the writers refuse on.
- Never raises. A project with neither file returns disabled, empty, no warnings, `origin: "none"`.

```
load_living_specs_block(block) -> living
```

Normalizes a bare mapping into `living`. Unwraps a `livingSpecs:` key when the mapping carries one. `load_living_specs(config)` keeps its current signature and delegates here.

Rendering and splicing the registry live alongside it: `render_registry`, `render_capability`, `splice_registry`, and the two block-boundary helpers `is_top_level_key` and `block_end` that both this module and the registration writer share.

```
is_project_root(path) -> bool
should_drop_legacy(meta) -> bool
```

`is_project_root` is true when `path` holds either the registry file or the legacy settings file. Only a confirmed absence of both returns false; any other error returns true so an unreadable candidate still bounds a scan. `should_drop_legacy` is true only for `origin: "legacy"` — the one case where the legacy block's capabilities were the set just written forward.

## Python — `speckit-extension/scripts/resolve-spec-paths.py`

```
load_living(root) -> living
load_living_with_meta(root) -> (living, meta)
```

`load_living` keeps its existing one-value signature so `drift.py`, `check-coverage.py`, and `living_spec_fold.py` need no change. `load_living_with_meta` is the variant that also surfaces the origin and warnings, for callers that report them.

## Python writers

`register-capability.py` and `relocate-capability.py` both:

1. Resolve through the shared rule.
2. Write the full capability set to `living-specs.yml`, creating it when absent and splicing it when present.
3. When `origin` was `legacy` — and only then — remove the `livingSpecs` block from `.specify/companion.yml`, leaving every sibling block, comment, and blank line untouched. A `legacy_stale` block is left in place: the registry answered instead, so that block's capabilities were never carried forward and deleting it would lose them. It is reported, not removed.
4. Report the move on stdout in plain language, and carry it in the JSON result as `migratedFrom`.
5. Refuse to write, exit code 2, nothing truncated, when either file is present but unparseable — detected from `meta["errors"]`, not by matching warning text.

Result objects gain `configPath: "living-specs.yml"` and, when a move happened, `migratedFrom: ".specify/companion.yml"`. When the registry answered over a legacy block that was left in place, they carry `staleLegacy: ".specify/companion.yml"` instead, and the CLI says so on stderr.

## TypeScript — `src/features/specs/livingSpecsModel.ts`

```
readLivingSpecs(workspaceRoot, options?) -> LivingSpecsListing
```

`LivingSpecsListing` gains `legacyStale: boolean`. Resolution order and precedence match the Python rule exactly: registry file first; legacy only when the registry file is absent; a parse failure of the registry yields an inert listing rather than a fallback.

The nested-project boundary probe matches either file, keeping its existing rule that only `ENOENT` on both counts as "not a project".

## Change watching — `src/extension.ts`

The Living Specs refresh watcher's pattern includes `living-specs.yml` alongside the existing entries, and reacts to create, change, and delete.
