#!/bin/bash
# Put the living-qa sandbox into the state one Part of the runbook needs.
#
#   seed-living-qa.sh                 seven capabilities, one drifted, one orphan
#   seed-living-qa.sh --no-drift      the same, everything in sync
#   seed-living-qa.sh --drifted-3     three capabilities drifted, one uncommitted
#   seed-living-qa.sh --with-feature  in sync, plus a finished feature spec to fold
#
# Every mode leaves the sandbox committed except where a Part needs an
# uncommitted edit to look at. Re-runnable: each Part resets to HEAD first.
set -euo pipefail
MODE="${1:-}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/living-qa" && pwd)"
cd "$ROOT"
git config core.hooksPath /dev/null 2>/dev/null || true
commit() { git add -A >/dev/null; git -c user.email=qa@qa -c user.name=qa commit -qm "$1" --no-verify; }

# One requirement, with its marker on the line under the heading. `$4` blank
# means the marker sits one blank line below, which is what a formatter leaves
# behind and what #690 was about — Part ⑤ checks it still counts.
req() { # heading, touches, scenario name, spaced?
  printf '### %s\n' "$1"
  [ -n "${4:-}" ] && printf '\n'
  printf '<!-- touches: %s -->\n\n' "$2"
  printf 'The area SHALL behave as this requirement describes.\n\n'
  printf '#### Scenario: %s\n- **WHEN** a reader reaches this surface\n- **THEN** it behaves as described\n\n' "$3"
}

spec() { # path, title, then requirement blocks on stdin
  mkdir -p "$(dirname "$1")"
  { printf '# %s — Living Spec\n\n' "$2"
    printf '> [DRAFT] Seeded for the living-specs walk. Review before trusting.\n\n'
    printf '## Purpose\n\nWhat %s guarantees, and what would go wrong without it.\n\n## Requirements\n\n' "$2"
    cat; } > "$1"
}

rm -rf capabilities living-specs.yml src/shared/lib/orphan.spec.md src/pages/login/auth.spec.md
cat > living-specs.yml <<'YML'
enabled: true
exempt: ["*.config.*", "*.test.*", "webpack.config.js"]
capabilities:
  - name: articles
    match: ["src/entities/article/**", "src/features/article/**", "src/pages/article/**"]
    spec: capabilities/articles/articles.spec.md
  - name: editor
    match: ["src/pages/editor/**"]
    spec: capabilities/editor/editor.spec.md
  - name: auth
    match: ["src/entities/session/**", "src/features/session/**", "src/pages/login/**", "src/pages/register/**"]
    spec: src/pages/login/auth.spec.md
  - name: profile
    match: ["src/entities/profile/**", "src/features/profile/**", "src/pages/profile/**"]
    spec: capabilities/profile/profile.spec.md
  - name: home-feed
    match: ["src/pages/home/**", "src/widgets/articles-feed/**"]
    spec: capabilities/home-feed/home-feed.spec.md
  - name: shared-api
    match: ["src/shared/api/**"]
    spec: capabilities/shared-api/shared-api.spec.md
  - name: shared-ui
    match: ["src/shared/ui/**"]
    spec: capabilities/shared-ui/shared-ui.spec.md
YML

spec capabilities/articles/articles.spec.md "Articles" <<EOF
$(req "An article renders from its slug" "src/pages/article/**" "a reader opens an article")
$(req "Favouriting an article is one action" "src/features/article/**" "a reader favourites")
$(req "An article entity owns its read queries" "src/entities/article/**" "a list is fetched")
EOF
spec capabilities/editor/editor.spec.md "Editor" <<EOF
$(req "The editor form is one slice" "src/pages/editor/**" "an author writes")
$(req "A draft is kept on the device" "src/pages/editor/**" "an author returns" spaced)
EOF
spec src/pages/login/auth.spec.md "Auth" <<EOF
$(req "A session survives a reload" "src/entities/session/**" "a reader returns")
$(req "Signing out clears device state" "src/features/session/**" "a reader signs out")
EOF
spec capabilities/profile/profile.spec.md "Profile" <<EOF
$(req "A profile page shows its author's articles" "src/pages/profile/**" "a reader opens a profile")
$(req "Following is one action" "src/features/profile/**" "a reader follows")
EOF
spec capabilities/home-feed/home-feed.spec.md "Home feed" <<EOF
$(req "The feed offers a global and a personal tab" "src/pages/home/**" "a reader lands")
$(req "A feed row is a preview, never the article" "src/widgets/articles-feed/**" "a row renders")
EOF
spec capabilities/shared-api/shared-api.spec.md "Shared API" <<EOF
$(req "Every request goes through one client" "src/shared/api/**" "any call is made")
EOF
spec capabilities/shared-ui/shared-ui.spec.md "Shared UI" <<EOF
$(req "A shared component knows nothing about a domain" "src/shared/ui/**" "a primitive is used")
EOF

# `articles` alone carries a coverage sibling, two of its three requirements.
cat > capabilities/articles/articles.coverage.md <<'EOF'
# Articles — Coverage

| Requirement | Covered by |
|---|---|
| An article renders from its slug | `src/pages/article/article-page.test.tsx` |
| Favouriting an article is one action | `src/features/article/favorite-article/favorite-article.test.tsx` |
EOF

# An unclaimed spec: no registry entry matches it, so it shows under Orphans.
spec src/shared/lib/orphan.spec.md "Orphan" <<EOF
$(req "Nothing in the registry claims this file" "src/shared/lib/**" "the tree is read")
EOF

commit "seed: seven capabilities"

case "$MODE" in
  --no-drift)
    ;;
  --drifted-3)
    printf '\n// changed outside the pipeline\n' >> src/pages/profile/profile-page.ui.tsx
    printf '\n// changed outside the pipeline\n' >> src/pages/editor/editor-page.ui.tsx
    commit "edit profile and editor directly"
    printf '\n// uncommitted, only --working sees this\n' >> src/entities/article/article.api.ts
    ;;
  --with-feature)
    mkdir -p specs/001-reading-time
    cat > specs/001-reading-time/reading-time.spec.md <<'EOF'
# Feature Specification: Reading time

## Summary

An article preview and an article page both show how long the article takes to read.

## ADDED Requirements
<!-- capability: articles -->

### An article shows how long it takes to read

The reading time SHALL be derived from the body and shown on the preview and the page.

#### Scenario: a reader scans the feed
- **WHEN** a reader looks at a preview
- **THEN** the reading time is shown beside the date

## MODIFIED Requirements
<!-- capability: home-feed -->

### A feed row is a preview, never the article

A row shows the title, the excerpt, the author, the date and the reading time, and never the body.

#### Scenario: a row renders
- **WHEN** a row renders
- **THEN** it shows the reading time and not the body
EOF
    printf '{"status":"implemented","currentStep":"implement","history":[],"livingSpecs":{"loaded":["articles","home-feed"]}}' > specs/001-reading-time/.spec-context.json
    printf '{"feature_directory":"specs/001-reading-time"}' > .specify/feature.json
    commit "feature: reading time, ready to fold"
    ;;
  *)
    printf '\n// changed outside the pipeline\n' >> src/pages/profile/profile-page.ui.tsx
    commit "edit profile directly"
    ;;
esac

echo "seeded${MODE:+ }$MODE — 7 capabilities, 1 orphan, $(git log --oneline | wc -l | tr -d ' ') commits"
