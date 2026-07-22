# Research: Fast path fills the Overview

## Decision: Make the RECORDING deterministic, not the AI's judgement

- **Decision**: Add a script (`record-living-specs.py`) that itself gates on `enabled`, runs the resolver, and writes `livingSpecs.loaded`. The node bodies call this one line; the AI is no longer asked to read the registry, check `enabled`, run the resolver, and decide whether to record.
- **Rationale**: A real fast-path run (spec 515) recorded `last_action: "living specs evaluated — skipped (not configured)"` even though `living-specs.yml` is enabled and the resolver returns matches. The load was entirely prompt-driven, so the AI mis-judged "not configured" and skipped. "Run a script" is reliable; "read config, judge, then decide to record" is best-effort. Moving the gate-and-record into a script converts an unreliable AI judgement into a deterministic write.
- **Alternatives considered**: Sharpen the prose to insist the AI record — rejected, it is the same prompt-driven class that already failed. Record in the extension (TypeScript) — rejected, the extension is blind after dispatch and has no touched-file list at that point; the command body does.

## Decision: Reuse `resolve-spec-paths.py`, do not reimplement the resolver

- **Decision**: Import the hyphenated resolver by path (`importlib.util.spec_from_file_location`), the exact pattern `drift.py` / `check-coverage.py` / `living_spec_fold.py` already use, and call its `load_living` + `match_changed`.
- **Rationale**: The glob/membership/specificity/ordering rules are subtle (POSIX-path globbing, most-specific-first). One fact, one derivation — a second copy would drift. The resolver is also already inert when the feature is off, so its gating is reused too.
- **Alternatives considered**: Call the resolver as a subprocess and parse its JSON — rejected, an in-process import is simpler, faster, and avoids a second `python3` spawn and JSON round-trip.

## Decision: Write via `capture.set_living_specs_loaded`, leaf-first

- **Decision**: The recorder writes matched names through the existing `set_living_specs_loaded` (re-exported by `write-context.py`), which merges onto `livingSpecs.loaded`, de-dupes, preserves resolver order, and never touches lifecycle keys.
- **Rationale**: That writer is the sanctioned additive path the prose `--living-specs` call already used, so the on-disk shape is identical whether the AI or the script records. `match_changed` returns most-specific-first, which is the leaf-first order the readers expect.

## Decision: Callers pass touched files only when nothing was recorded earlier

- **Decision**: The node bodies keep the "only if `livingSpecs.loaded` is empty" guard around the recorder call. The recorder itself merges idempotently, so a double call is harmless, but the guard avoids re-resolving.
- **Rationale**: Preserves FR-006 (no duplicate/re-resolve). The pre-draft load may already have recorded when the surface was known early.

## Decision: Best-effort contract lives inside the script

- **Decision**: The recorder wraps its whole body so any exception (missing registry, unreadable config, unresolvable dir, resolver error, absent dependency) prints one stderr line and exits 0. It writes nothing when the feature is off or nothing matches.
- **Rationale**: The capture-runtime living spec's headline requirement — "Recording state MUST NOT be able to break the run it observes." A capture defect must degrade to a gap, never a halt. The node bodies also front-guard with `python3 … || true`-style best-effort as the other capture calls do.
