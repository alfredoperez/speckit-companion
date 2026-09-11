#!/bin/bash
# Put a sandbox into one of the states Part 6 of the living-specs runbook needs.
#
# Part 6 covers everything that shipped after the runbook was written, and most of
# it is about a state rather than an action: what the panel says on a project that
# has never used living specs, what three coverage rows look like side by side,
# what a capability claiming undescribed code reports. Manufacturing those by hand
# is most of the work and the easiest thing to get subtly wrong, so each one gets
# a mode here.
#
#   seed-part6.sh fresh          nothing set up — the panel's first-run states (6a)
#   seed-part6.sh adopted        one capability, ready to move (6b)
#   seed-part6.sh coverage       three capabilities, one per coverage row (6c)
#   seed-part6.sh starved        a capability claiming code no requirement describes (6e)
#   seed-part6.sh aligns         two capabilities joined by an aligns edge (6h)
#   seed-part6.sh drifted        code changed, spec still true — for --accept (6g)
#
# Run from any sandbox directory. Every mode resets that sandbox to HEAD first, so
# switching modes is safe and re-running one is idempotent.
set -euo pipefail
MODE="${1:-}"
[ -n "$MODE" ] || { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "run this from inside a sandbox git repo" >&2; exit 2; }

# The tag a walk starts from. Written once, on the first run, so a mode that commits
# (drifted) can be wound all the way back rather than leaving its commits behind for
# whoever walks next.
BASE_TAG=part6-base

reset_to_head() {
  git rev-parse -q --verify "refs/tags/$BASE_TAG" >/dev/null 2>&1 || git tag "$BASE_TAG"
  git reset --hard -q "$BASE_TAG"
  git clean -fdq
}

req() { # heading, touches glob, scenario name
  printf '### %s\n' "$1"
  printf '<!-- touches: %s -->\n\n' "$2"
  printf 'The area SHALL behave as this requirement describes.\n\n'
  printf '#### Scenario: %s\n- **WHEN** a reader reaches this surface\n- **THEN** it behaves as described\n\n' "$3"
}

spec() { # path, title; requirement blocks on stdin
  mkdir -p "$(dirname "$1")"
  { printf '# %s — Living Spec\n\n## Purpose\n\nWhat %s guarantees.\n\n## Requirements\n\n' "$2" "$2"
    cat; } > "$1"
}

# A real directory this sandbox actually has, so globs match something on disk.
AREA=$(ls -d src/*/ 2>/dev/null | head -1 | sed 's:/$::')
AREA=${AREA:-src}
AREA2=$(ls -d src/*/ 2>/dev/null | sed -n 2p | sed 's:/$::')
AREA2=${AREA2:-$AREA}

reset_to_head

case "$MODE" in
  fresh)
    # Nothing at all. The point of 6a is what the panel says with no registry:
    # it used to vanish, and it should now offer a way in.
    echo "No living-specs.yml, no capabilities."
    echo "Check: the panel offers Install, or Set up living specs, or Adopt — never nothing."
    ;;

  adopted)
    spec capabilities/one/one.spec.md "One" <<< "$(req 'It behaves' "$AREA/**" 'the surface is used')"
    cat > living-specs.yml <<YML
enabled: true
layout: central
capabilities:
  - name: one
    match: ["$AREA/**"]
    spec: capabilities/one/one.spec.md
YML
    echo "One central capability. Right-click it and Move Living Spec… should offer colocated."
    ;;

  coverage)
    # The three rows 6c is about, side by side, so they can be compared at a glance
    # rather than by remembering what the last one looked like.
    spec capabilities/covered/covered.spec.md "Covered" <<< "$(req 'It is covered' "$AREA/**" 'the surface is used')"
    printf '# Coverage\n\n- It is covered → %s/a.test.ts\n' "$AREA" > capabilities/covered/covered.coverage.md
    spec capabilities/uncovered/uncovered.spec.md "Uncovered" <<< "$(req 'It is not covered' "$AREA2/**" 'the surface is used')"
    cat > living-specs.yml <<YML
enabled: true
layout: central
capabilities:
  - name: covered
    match: ["$AREA/**"]
    spec: capabilities/covered/covered.spec.md
  - name: uncovered
    match: ["$AREA2/**"]
    spec: capabilities/uncovered/uncovered.spec.md
  - name: not-created
    match: ["src/nowhere/**"]
    spec: capabilities/not-created/not-created.spec.md
YML
    echo "Three rows: 'covered', 'no coverage file', 'not created'. All three must look different."
    ;;

  starved)
    # The Conduit bug, on a plate. The capability claims two areas and describes one,
    # so a change in the other resolves it and is handed nothing.
    spec capabilities/starved/starved.spec.md "Starved" <<< "$(req 'Only this area is described' "$AREA/**" 'the surface is used')"
    cat > living-specs.yml <<YML
enabled: true
layout: central
capabilities:
  - name: starved
    match: ["$AREA/**", "$AREA2/**"]
    spec: capabilities/starved/starved.spec.md
YML
    echo "Run living-validate: it should name $AREA2/** as claimed but undescribed."
    echo "Then resolve a file under $AREA2 and watch it return the capability with zero requirements."
    ;;

  aligns)
    spec capabilities/guarded/guarded.spec.md "Guarded" <<EOF
$(printf '### Writing requires being signed in\n<!-- touches: %s/** -->\n<!-- aligns: gate#A signed-out visitor is sent to login -->\n\nThe area SHALL check for a session first.\n\n#### Scenario: signed out\n- **WHEN** a signed-out visitor arrives\n- **THEN** they are sent to login\n\n' "$AREA")
EOF
    spec capabilities/gate/gate.spec.md "Gate" <<< "$(req 'A signed-out visitor is sent to login' "$AREA2/**" 'a signed-out visitor arrives')"
    cat > living-specs.yml <<YML
enabled: true
layout: central
capabilities:
  - name: guarded
    match: ["$AREA/**"]
    spec: capabilities/guarded/guarded.spec.md
  - name: gate
    match: ["$AREA2/**"]
    spec: capabilities/gate/gate.spec.md
YML
    echo "Resolve a file under $AREA with --follow-aligns: the gate rule should come too,"
    echo "marked via aligns and unmatched. Without the flag it should not."
    ;;

  drifted)
    spec capabilities/steady/steady.spec.md "Steady" <<< "$(req 'It behaves' "$AREA/**" 'the surface is used')"
    cat > living-specs.yml <<YML
enabled: true
layout: central
capabilities:
  - name: steady
    match: ["$AREA/**"]
    spec: capabilities/steady/steady.spec.md
YML
    # Committed because drift is measured from the spec's last commit: without one there
    # is no baseline and nothing to drift from. Both commits are dropped by the next
    # `reset_to_head`, so a sandbox is never left carrying a previous walk's history.
    git add -A >/dev/null && git commit -qm "seed: steady capability" >/dev/null
    find "$AREA" -name '*.ts' -o -name '*.tsx' | head -1 | while read -r f; do
      printf '\n// a change that does not alter what the spec says\n' >> "$f"
    done
    git add -A >/dev/null && git commit -qm "change code without changing the spec" >/dev/null
    echo "Drift now flags 'steady'. The spec is still true, so --accept it:"
    echo "  python3 .specify/extensions/companion/scripts/drift.py --accept steady"
    echo "Commit that, and it reports in sync again."
    ;;

  *) echo "unknown mode: $MODE" >&2; exit 2 ;;
esac

echo
echo "Sandbox: $(pwd)"
