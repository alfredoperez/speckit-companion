# Research: Living Specs LS·1

## Decision: Reuse the SDD resolver model, rebuild in Companion vocabulary

**Decision:** Port the path-resolution model from `~/dev/GitHub/sdd/lib/scripts/resolve-spec-paths.py` (domains → membership → resolve → discover → orphans → most-specific ordering) but rename the vocabulary: `domains` → `capabilities`, `pattern`/`include` → `match` globs, `specDir`/`.sdd.json` → `livingSpecs` block in `.specify/companion.yml`, `.specs/<d>/spec.md` → `capabilities/<name>/spec.md`.

**Rationale:** The SDD model is proven and already battle-tested for the exact problem (changed-files → spec ordering, union discovery, orphan exemption of `.arch.md`/`.coverage.md`). Rebuilding from scratch would risk subtle ordering/de-dup bugs. Companion uses OpenSpec-flavored nouns (`capabilities`), so a verbatim copy would be off-brand and confusing.

**Alternatives considered:** A verbatim copy of the SDD script (rejected — wrong vocabulary, wrong config file, JSON config vs Companion's YAML); a fresh from-scratch implementation (rejected — re-derives solved ordering/orphan logic).

## Decision: Glob membership via fnmatch + recursive-glob shim

**Decision:** Match `match`/`exclude` globs against the POSIX relative path using `fnmatch`. Since `fnmatch` does not treat `**` as cross-directory, normalize a `**` glob to also match its prefix (`src/checkout/**` matches `src/checkout/cart/x.ts`) by testing both `fnmatch` and a `**`→prefix expansion.

**Rationale:** Stdlib-only, no PyYAML / no third-party glob. The issue's examples (`match: ["src/checkout/**"]`) need recursive matching.

**Alternatives considered:** `pathlib.PurePath.match` (no `**` support pre-3.13); regex patterns like SDD (rejected — globs read better in YAML and match the issue contract).

## Decision: Specificity by longest literal-prefix of the matching glob

**Decision:** For each capability that matches a file, compute specificity as the length of the glob's literal prefix (everything before the first wildcard) when that prefix prefixes the file path. Order descending, tiebreak by capability name ascending.

**Rationale:** `src/checkout/cart/**` has a longer literal prefix than `src/checkout/**`, so `checkout-cart` sorts before `checkout` — exactly the required `[checkout-cart, checkout]` ordering. Deterministic and simple.

**Alternatives considered:** Segment count (ambiguous with `**`), declaration order (not "most-specific").

## Decision: Config reader on companion_config.py, defaulting enabled=false

**Decision:** Add `load_living_specs(config) -> dict` to `companion_config.py` returning `{enabled: bool, capabilities: [{name, match, exclude, spec}]}`, normalizing scalar `match`/`exclude` to lists and resolving the default `spec` to `capabilities/<name>/spec.md`. The resolver calls `load_config` + `load_living_specs`.

**Rationale:** Single YAML parser; the config module is already the executable spec of `.specify/companion.yml`. Mirrors `resolve_order` / `merge_hooks` accessor style.

**Alternatives considered:** Parsing YAML inside the resolver (rejected — duplicate parser, drift).

## Decision: Deterministic sandbox mode

**Decision:** The LS·1 demo runs the resolver + pytest only (no AI), captured via `execFileSync`. `mode: "deterministic"` per the evidence contract.

**Rationale:** LS·1 has no live AI step. Deterministic capture is honest and reproducible; the contract reserves `real`/`real+seeded-spec` for later tickets that exercise the AI.
