# Plan — Drift command (LS·6)

## Approach

Port the SDD drift skill (`~/dev/GitHub/sdd/skills/drift/SKILL.md`) into Companion vocabulary, deterministic and resolver-backed. All logic lands in one new Python script reusing the LS·1 resolver; a thin command body invokes it. One config field (`exempt`) is added to the existing `livingSpecs` parser. Everything is opt-in and exits 0.

## Files & dependencies

| File | Change | Why |
|------|--------|-----|
| `speckit-extension/scripts/companion_config.py` | Add `exempt` to `load_living_specs` (default `["*.config.*","*.test.*","**/migrations/**"]`) | FR-003 — drift needs the exempt list from config |
| `speckit-extension/scripts/drift.py` | **New** — deterministic drift detector | FR-001…FR-006, FR-009, FR-010 |
| `speckit-extension/commands/speckit.companion.drift.md` | **New** — thin command invoking the script | FR-007 |
| `speckit-extension/extension.yml` | Register `speckit.companion.drift`; bump `extension.version` | FR-008 + per-release rule |
| `speckit-extension/tests/test_living_specs.py` | pytest for drift classification + exempt + opt-out + uncommitted-skip | NFR004 |
| `speckit-extension/README.md` + `speckit-extension/CHANGELOG.md` | Document the command | docs-are-part-of-the-change |
| `examples/todo-claude/bench/living-specs/ls-lib.mjs` | `bakeLs6Repo`, `runDrift`, git-commit helper | sandbox demo harness |
| `examples/todo-claude/bench/living-specs/ls-demos.mjs` | `runLs6`, register in `RUNNERS` | sandbox demo runner |
| `examples/todo-claude/bench/living-specs/evidence/LS6.json` | Captured from a real run | evidence contract |
| `~/dev/GitHub/obsidian-vault/.../living-specs/status.html` | Append LS·6 section, flip row to shipped | evidence contract |

### drift.py design

Reuses resolver functions directly (`import resolve-spec-paths` is hyphenated → import by path via `importlib`, mirroring how the resolver imports `companion_config`). For each capability from `discover_all`/the living block:

1. `spec_commit = git log -n1 --format=%H -- <spec>` anchored to `--root` (via `git -C <root>`). Untracked/empty → skip with `ℹ <name>: spec.md not yet committed; skipping`.
2. `changed = git -C <root> diff --name-only <spec_commit>..HEAD` → filter to files the capability `matches()` (resolver's membership), drop the spec itself, drop any exempt-glob match (reuse resolver's `_glob_matches`).
3. Classify each survivor: scan every `specs/*/.spec-context.json` under root; gather files from the changed/modified sets recorded since the spec commit → if the file is in that union, `tracked`; else `unspeced`.
4. Print per-capability report; all-in-sync → single `✓ All capabilities in sync.` line. Always `return 0`.

`--json` flag for the machine-readable object (the bench asserts against it). Opt-in: `living["enabled"]` false → emit empty/all-clear, exit 0.

### Checklist lessons honored

- **glob-segment** (#361): reuse the resolver's `_glob_matches` (POSIX `*`-no-cross-`/`) for exempt globs — don't re-roll `fnmatch`.
- **evidence-path-hygiene** (#361): LS6.json paths repo-relative, no `/Users/`.
- **lifecycle-state** (#363): all git ops via `git -C <root>` / path-anchored, not cwd.
- **mock-completeness / test-real-path** (#310, #347): the pytest calls the real `drift.py` functions, doesn't re-derive the predicate.
- **config-splice-safety** (#365): drift only READS config — no write path, so no splice risk; note it.
- **Two extensions** (CLAUDE.md): bump `extension.yml` version + `speckit-extension/` README+CHANGELOG; NOT root.

## Summary

**Problem:** A living spec goes stale silently — code in its area keeps changing with no signal that the spec is now lying. **Solution:** A read-only `drift` command that, per capability, lists the files changed since the spec was last committed and labels each as a missed sync (`tracked`) or an off-pipeline change (`unspeced`), honoring an exempt list, never failing the build, and printing one clean line when everything is in sync. Pure git + the existing resolver, opt-in, proven by a deterministic sandbox demo.
