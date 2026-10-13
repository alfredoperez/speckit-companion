---
allowed-tools: Bash(git:*), Bash(gh:*), Bash(npm test:*), Read, Edit
description: Write one changelog entry in the house voice for a PR or a diff — picks the changelog file, the area tag, bullet or highlight, and the picture
argument-hint: "[PR number | blank for the current diff]"
---

# Changelog entry

Write the entry for `$ARGUMENTS` (a PR number: `gh pr view <N>` and `gh pr diff <N>`), or for the current branch's diff against `main` when it is blank. The rules are "Changelog voice" at the end of this file; read them first, they are short.

1. **What does the user do or see?** Say it in one sentence before writing anything. No entry, say so and stop, for: a change a user never meets (a refactor, a test, tooling, package size), a docs or site change, a change to the wording of the Companion's own prompts, and a fix to something added in this same unreleased block (edit that entry instead).
2. **Fold before you add.** Read the `[Unreleased]` block first. When it already has an entry for the same area and the same kind of change, rewrite that entry to cover both and add this PR's link to it. Small UI polish (wrapping, spacing, an empty state, a tab title) is always one line per area, never a line per fix. A release holds at most 12 bullets and 3 highlights, and the test fails past that.
3. **Which file.** By where the change lives, one entry per file it touches:
   - `apps/speckit-extension/` → `apps/speckit-extension/CHANGELOG.md`
   - `apps/claude-mod/` → `apps/claude-mod/CHANGELOG.md` (no PR link, no area tag, no `==`)
   - `apps/copilot-canvas/` → `apps/copilot-canvas/CHANGELOG.md` (no PR link, no area tag)
   - the VS Code extension → root `CHANGELOG.md`
4. **Bullet or highlight.** A highlight is a feature worth a picture; everything else is a bullet under Added, Changed, Fixed or Security.
5. **Write it** under `## [Unreleased]`, never under a version, and leave every version number alone.
   - Bullet: `- **Title of at most 8 words.** One sentence of at most 22 words. ([#N](https://github.com/alfredoperez/speckit-companion/pull/N)) <!-- area: <id> -->`
   - Highlight: a `#### Title`, at most two such sentences, then `<!-- area: <id>; pr: N; media: <ids> -->`
   - Second person, present tense, what you do or see first. At most one `==phrase==` of two to four words. Setting keys, commands and button names in code or bold. No file or symbol names, no "now", no "previously", no history of the bug.
6. **Area.** One id from `apps/website/src/components/changelog/changelogAreas.ts`.
7. **Picture.** For a highlight, look for a matching shot in `tooling/scripts/shots.json` (its output is `.shots/`) and name its id under `media:`; a media id also needs its entry in `content/media/changelog.json` or the site build fails. No shot fits: say which one is missing instead of inventing an id.
8. **Check.** `npm test -- docs-consistency` names any entry that breaks a rule. Cut words until it passes; a fact that does not fit belongs in the docs page.

Report the entry as written and the file it went into.

## Changelog voice

An entry is a headline for someone skimming, not the story of the change. The detail lives in the docs page and the PR. The same voice holds in all four changelogs (root, `apps/speckit-extension/`, `apps/claude-mod/`, `apps/copilot-canvas/`).

- **A bullet** is a bold title of at most 8 words, then ONE sentence of at most 22 words. Nothing else.
- **A highlight** is a `####` title, at most two sentences of that length, and its pictures.
- **Start with what you do or see**, second person, present tense. Light and a little playful is welcome; never a pun that hides the fact.
- **At most one `==highlighted phrase==` per entry**, in the body: the two to four words a skimmer must not miss. The site draws it as a marker stroke.
- **Keep what you type or press** in code or bold: setting keys, command names, button names. No file or symbol names, no "now", no "previously", no history of the bug.

Before: "**A paragraph wrapped across several lines reads as one paragraph.** A spec file that breaks a paragraph over several source lines used to show every line as its own paragraph, each with its own comment button, so sentences broke in the middle. The viewer now joins them…" After: "**Wrapped paragraphs stay whole.** A paragraph split across lines in the file is ==one paragraph, one comment button==."

`npm test -- docs-consistency` holds every entry under `## [Unreleased]` to it; released versions are never checked. A release has this shape:

```markdown
## [0.35.0] - 2026-10-03

One plain sentence that says what the release is about.

### Highlights

#### Drag a hook to move it
Grab a hook in the Pipeline Builder and ==drop it where it runs==. The file keeps every other line as you wrote it.
<!-- area: pipeline-builder; pr: 818; media: move-hook -->

### Fixed
- **Move to phase… works in a narrow builder.** The menu opens ==inside the window== however narrow the Pipeline Builder gets. ([#805](https://github.com/alfredoperez/speckit-companion/pull/805)) <!-- area: pipeline-builder -->
```

- **Highlights are the big features**, each its own `####` block, and each gets a section on the site with its screenshots (the media step in `/publish`). The comment is for the site only: `area`, one or more `pr` numbers, and the `media` ids. A feature that is not worth a picture is not a highlight.
- **Everything else is one bullet** under Added, Fixed, Changed or Security: the bold title, the sentence, the full PR link, then `<!-- area: … -->`. Never a section of its own.
- **Every entry links its PR**, highlight or bullet. When a fix spans PRs, list each. The Claude Code mod's changelog is the exception: it writes neither PR links nor area tags, so leave `==` out there. The site's changelog page shows it under its own Claude Code mod filter, beside the Copilot app (`apps/copilot-canvas/CHANGELOG.md`).
- **Areas**: `spec-viewer`, `overview`, `sidebar`, `create-spec`, `pipeline-builder`, `pipeline` (the Companion pipeline's commands), `copilot-app`, `living-specs`, `run-record`, `assistants` (assistants and terminals), `install` (install and updates), `docs`. The list lives in `apps/website/src/components/changelog/changelogAreas.ts`; an entry without a tag is filed by a keyword map there, and the site build names it so it can be tagged.
