# Living Specs — Tiered consumption: arch + coverage (LS·8)

**Issue:** #368 · **Surface:** spec-kit extension (`id: companion`) · **Depends on:** #362 (LS·2 read path, merged) · **Opt-in (OFF by default).** · **Final living-specs ticket.**

## What it does

A living spec is more than its requirements. Alongside the hot requirements file (`<base>.spec.md`) the resolver already recognizes two colder sibling files per capability — an architecture file (`<base>.arch.md`, diagrams and structural decisions) and a coverage file (`<base>.coverage.md`, a requirement-to-tests map). Until now those two tiers were reserved: the resolver knew their names but nothing ever read them. This change turns them on.

Two things happen. First, the plan step learns to pull a capability's architecture file *lazily* — only when the change is actually architecture-significant. A small, fast-path change never drags in the cold architecture tier; a normal or oversized plan does, so the plan is briefed on how the area is built without paying that cost on trivial work. Second, a small read-only checker reads a capability's coverage file and reports which of its requirements have a test mapped and which don't. It's an informational on-ramp to conformance — it never fails the build, mirroring how the drift command behaves.

Everything stays opt-in. With living specs off, or a capability that ships only its `.spec.md` and no sibling tiers, the plan and the checker behave exactly as before — the reserved tiers stay reserved and nothing changes.

## Requirements

### Functional

- **FR-001** The resolver (`resolve-spec-paths.py`) MUST be able to derive a capability's tier-sibling paths (`<base>.arch.md`, `<base>.coverage.md`) from its resolved `spec` path, and expose them (with on-disk existence) so the plan node and the coverage checker reuse the resolver instead of hardcoding the tier filenames.
- **FR-002** The plan step MUST load a capability's `.arch.md` (in addition to its already-loaded `.spec.md`) ONLY when the change is architecture-significant — tied to the recorded `size` signal: load on a `normal` / `oversized` plan, never on a `simple` fast-path change.
- **FR-003** The plan node MUST resolve the `.arch.md` path via the resolver (not a hardcoded filename), skip it silently when the file does not exist, and never fail the plan when it is absent.
- **FR-004** A deterministic coverage checker (`check-coverage.py`) MUST read a capability's `.spec.md` requirements and its `.coverage.md` requirement→test map and report, per requirement, whether it is covered (has a coverage entry) or uncovered.
- **FR-005** The coverage checker MUST be read-only and non-failing — it always exits 0 and never edits anything, consistent with the drift command's contract. It MUST reuse the resolver for the tier paths.
- **FR-006** The coverage checker MUST be invokable for a single capability (by name) or across all configured capabilities, and emit both a concise human report and a `--json` object.
- **FR-007** The checker MUST be registered in `extension.yml` `provides.commands` if it ships a `.md` command surface; a new command must be added there or the installer skips it.

### Opt-in / safety

- **FR-008** With living specs disabled (`livingSpecs.enabled` unset/false) or no config present, the checker MUST report nothing and exit 0, and the plan's arch-tier load MUST be a no-op (the LS·1 inert contract).
- **FR-009** A capability with only `.spec.md` (no `.arch.md` / `.coverage.md`) MUST be unaffected: the plan loads no arch tier and the checker reports the capability with no coverage data, never erroring.
- **FR-010** The plan node edit MUST keep the assembled `speckit.companion.plan.md` shape-parity-clean (golden re-blessed, `check-shape-parity.py` green).

## How to test

A baked sandbox (mode = `deterministic` — pure resolver + Python checker, no AI) configures a `billing` capability with all three tiers committed: `capabilities/billing/spec.md`, `spec.arch.md`, and `spec.coverage.md`. The demo asserts: (a) the resolver derives and exists-flags the arch + coverage paths; (b) the deterministic tier-selection logic picks the arch path for a `normal`/`oversized` plan but NOT for a `simple` plan (the actual AI consumption is the live part → marked honestly); (c) the coverage checker maps a `.spec.md` requirement to its `.coverage.md` test(s) and flags an uncovered requirement; and (d) the opt-out run (`enabled: false`) reports nothing. Evidence captured to `examples/todo-claude/bench/living-specs/evidence/LS8.json`.

## Out of scope

- Live AI consumption of `.arch.md` inside a plan run (that's the live half — the demo asserts only the deterministic path-selection, marked honestly).
- A conformance *gate* that fails the build on uncovered requirements (the checker is informational, like drift).
- Conventions tier (no separate conventions file ships in this change; only arch + coverage are consumed).
