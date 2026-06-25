# Research: Brownfield Adoption Wizard (Living Specs LS·5)

## Decision 1 — Split: AI-prose command body vs. deterministic Python helper

**Decision**: The wizard is a markdown command (`speckit.companion.adopt.md`) whose body is runtime prose the AI executes — read the area's surface, propose capabilities, draft the spec. The single deterministic, testable piece is a Python helper, `register-capability.py`, that performs the registry append.

**Rationale**: This mirrors the established Living Specs split. LS·2's auto-load and LS·3's fold-back put the AI judgment in command prose and kept the verifiable mechanics (resolve, fold, record) in Python that pytest covers. The drafting (reading code, writing prose) is inherently a live model step and cannot be deterministically asserted; the registry append is pure data manipulation and must be exactly reproducible. Keeping them apart lets the sandbox demo prove the deterministic half real while honestly marking the live-draft step INCONCLUSIVE.

**Alternatives considered**: A single all-Python wizard that also does the drafting (rejected — surface extraction + prose synthesis is exactly what the model is for, and hardcoding it would be brittle and low-quality). A pure-prose command with no script (rejected — the registry write must be idempotent and not corrupt existing config; that is a deterministic contract worth testing).

## Decision 2 — Append onto the existing config, never rewrite the whole file

**Decision**: `register-capability.py` reads the existing `.specify/companion.yml`, checks whether `livingSpecs.capabilities[]` already contains the name, and if not appends a single new capability block. It reuses `companion_config.py`'s `load_config` / `load_living_specs` to read, then re-emits the YAML.

**Rationale**: The #363 lesson and the review-checklist `feature-dir-repo` / well-formed-creation lessons demand incremental, non-destructive writes. The resolver and fold-back already treat `companion.yml` as durable shared config. Adoption is explicitly "append, never a whole-repo bootstrap" (FR-010). Reusing the shipped reader (FR-012) means the helper can never diverge from the parser the rest of the pipeline trusts.

**Alternatives considered**: A third-party YAML library round-trip (rejected — the extension is stdlib-only by design; `companion_config.py` ships its own constrained reader precisely to avoid a dependency). Blind string-append of a capability block to the end of the file (rejected — it can't dedupe by name and would mangle a file with no `livingSpecs` block yet).

## Decision 3 — Idempotency key is the capability **name**

**Decision**: A capability is "already registered" iff its `name` already appears in `livingSpecs.capabilities[]`. Re-running register for an existing name is a no-op (exit 0, file unchanged), reported on stderr.

**Rationale**: Name is the resolver's identity for a capability (`discover_all` de-dupes by resolved spec path, but the user-facing handle and the registry key is the name). Matching the review-checklist idempotency expectation (LS·3/LS·4 folds are idempotent) keeps adoption safe to re-run. Two capabilities with the same name would produce duplicate `<option>`-style collisions the checklist warns against.

**Alternatives considered**: Keying on the `match` glob (rejected — two names could legitimately share an overlapping match; name is the stable handle). Keying on spec path (rejected — colocated specs can collide while names differ).

## Decision 4 — Degrade safely on a malformed existing config

**Decision**: If the existing `companion.yml` cannot be parsed (`load_config` returns the malformed warning), the helper refuses to write — it exits non-zero with a clear stderr message rather than truncating or overwriting the file. A wholly-absent config is fine: the helper creates a minimal well-formed `livingSpecs` block.

**Rationale**: Review-checklist evidence-path-hygiene and the #363 "don't destroy a file you can't fully parse" spirit. Corrupting a user's hand-authored config to add one capability is a far worse outcome than asking them to fix the parse error first. Absent-vs-malformed is the same distinction `companion_config.load_config` already draws (absent → defaults silently; malformed → warning), so the helper keys off that.

**Alternatives considered**: Best-effort overwrite (rejected — data loss). Always create-from-scratch (rejected — clobbers existing capabilities).

## Decision 5 — The live-draft step is honest, not faked

**Decision**: The sandbox demo proves two deterministic things real: (a) the register helper adds a `billing` capability and the resolver then recognizes `src/billing/x.ts`; (b) a drafted `capabilities/billing/spec.md` has the required structure ([DRAFT] banner, observed/inferred tags, `## Uncovered`) — given a **seeded** draft. The live AI extraction itself is marked INCONCLUSIVE in the evidence; the demo never fabricates a drafted spec as if a model produced it.

**Rationale**: The evidence contract's honesty rules (no fake passes; `mode` ∈ deterministic/real/real+seeded-spec) and the review-checklist tests-and-PR-hygiene lesson ("regenerate captured artifacts from a real run, never hand-edit them to fake a result"). The structure check runs against a fixture draft we author as the test input, clearly labeled as seeded — distinct from claiming the model drafted it.

**Alternatives considered**: Run a real model draft in the harness (rejected — the bench harness has no live-AI step; LS·2 already set the precedent of marking the live half INCONCLUSIVE). Skip the structure proof entirely (rejected — the drafted-spec structure is a deterministic contract worth asserting against a seeded input).
