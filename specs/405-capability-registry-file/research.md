# Phase 0 Research: Capability registrations get their own file

## Decision 1 — the registry lives at `living-specs.yml` in the project root

**Decision**: capability registrations move to a project-root file named `living-specs.yml`.

**Rationale**: it satisfies all four constraints at once. It is outside `.specify/`, so the cleanup step `git restore package.json package-lock.json .specify/` cannot reach it — the whole point. It is an ordinary root config file, so it is committed and shared like any other project setting. It is named for the feature the documentation teaches, so someone who reads about "living specs" and then looks for the file finds it on the first guess, and someone browsing the project's top level can tell what it holds without opening it. And putting it at the root rather than in a new folder means adopting living specs adds one file, not a directory.

**Alternatives considered**:
- *Another file inside `.specify/`* (for example `.specify/living-specs.yml`) — rejected outright. Any path under `.specify/` is swept by the same cleanup line, which is the bug.
- *Narrowing the cleanup line to the regenerated paths only* — this was option 2 in the issue and was rejected there. It needs every workflow document carrying the line to change, and the old line gets pasted back the first time someone copies from an older document.
- *`capabilities.yml`* — pairs nicely with the default `capabilities/` spec folder, but the word is generic enough to collide with unrelated project tooling, and it reads as a list of capabilities rather than the living-specs configuration it actually is.
- *A hidden `.companion/` directory* — adds a directory for one file and is less discoverable than a visible root file.

## Decision 2 — the registry uses a flattened shape, and also accepts the wrapper

**Decision**: the new file puts `enabled`, `exempt`, and `capabilities` at the top level with no `livingSpecs:` wrapper. The loader additionally accepts a file whose top level *is* a `livingSpecs:` mapping and unwraps it.

**Rationale**: in a file whose only job is living specs, a `livingSpecs:` wrapper says nothing and costs every hand-editor an extra indent level. Accepting the wrapper too costs a single line and makes the most likely hand-migration — copying the old block into the new file verbatim — simply work instead of silently resolving to nothing.

**Alternatives considered**: *keep the wrapper as the only shape* — it would let the existing splice helper be reused byte-for-byte, but it hands every future reader a pointless nesting level in a dedicated file. The splice generalization needed for the flattened shape is small and is written once.

## Decision 3 — read-time fallback, migrate on the next write

**Decision**: readers prefer the registry file and fall back to `.specify/companion.yml` when only the old file has registrations. Nothing is migrated during a read. The next write — a registration or a relocation — writes the registry file and removes the block from the old file in the same operation, and reports that it did.

**Rationale**: reading must be free of side effects. Readers run from the sidebar on every file change, from drift and coverage checks, and inside the pipeline; several of those can run against a read-only checkout or a project the person is only browsing. A read that rewrites two files would produce surprise diffs in a working tree at moments the person did not ask for a change, which is a different flavor of the same "my files changed without me" complaint this feature is fixing. A write, by contrast, is a moment the person has deliberately chosen to change their configuration, so folding the move into it is invisible and safe.

**Alternatives considered**:
- *Automatic migration on first read* — fastest to fully retire the old location, but it mutates two tracked files from a read path, and it would fire from a background sidebar refresh.
- *Read-time fallback with no migration at all* — leaves the old location live forever, so the bug's blast radius never actually shrinks for existing adopters.

## Decision 4 — when both locations hold registrations, the registry wins outright

**Decision**: if the registry file exists and parses, it is the answer, whatever the old file says. A leftover block in the old file produces a warning that it is stale and ignored. The two are never merged.

**Rationale**: merging two partial sets produces a set matching neither file, which is exactly the kind of state nobody can debug. One file wins, and the loser is called out.

**Alternatives considered**: *merge by capability name* — rejected; it makes deleting a capability from the registry impossible while a stale copy exists in the old file.

## Decision 5 — a malformed registry does not fall back

**Decision**: a registry file that exists but cannot be parsed yields no capabilities plus a warning. It does not fall back to the old location.

**Rationale**: falling back would resurrect a stale set the person believes they have replaced, and it would do so silently at the exact moment they have a typo they cannot see. Failing loudly and empty is the honest answer, and it matches the writers, which already refuse to overwrite a file they cannot parse.

## Decision 6 — the nested-project boundary recognizes either file

**Decision**: the rule that treats a sub-directory as a separate project now matches on the registry file or the old settings file.

**Rationale**: a nested sample app or sandbox that has already migrated would otherwise stop being a boundary, and the parent's scan would descend into it and report its specs as the parent's orphans — the regression a previous fix already closed once. The existing "only a confirmed absence means not a project" rule is preserved: an unreadable candidate still bounds the scan.

## Decision 7 — the on/off switch travels with the capabilities

**Decision**: `enabled` moves into the registry file rather than staying behind as a setting in `.specify/companion.yml`.

**Rationale**: the switch and the registrations express one decision. Splitting them means someone can restore or share the registry file and get capabilities that do nothing, or lose the switch to the very cleanup step this feature exists to survive. Keeping the switch in the swept file would leave half the bug in place. The drift exemption list moves with them for the same reason — it is meaningless without capabilities.
