---
allowed-tools: Bash(git:*), Bash(gh:*), Bash(npm test:*), Read, Edit
description: Write one changelog entry in the house voice for a PR or a diff — picks the changelog file, the area tag, bullet or highlight, and the picture
argument-hint: "[PR number | blank for the current diff]"
---

# Changelog entry

Write the entry for `$ARGUMENTS` (a PR number: `gh pr view <N>` and `gh pr diff <N>`), or for the current branch's diff against `main` when it is blank. The rules are "Changelog voice" in `docs/doc-sync.md`; read them first, they are short.

1. **What does the user do or see?** Say it in one sentence before writing anything. A change a user never meets (a refactor, a test, tooling) gets no entry: say so and stop.
2. **Which file.** By where the change lives, one entry per file it touches:
   - `apps/speckit-extension/` → `apps/speckit-extension/CHANGELOG.md`
   - `apps/claude-mod/` → `apps/claude-mod/CHANGELOG.md` (no PR link, no area tag, no `==`)
   - everything else a user meets (the VS Code extension, the Copilot canvas, which has no changelog of its own, the site) → root `CHANGELOG.md`
3. **Bullet or highlight.** A highlight is a feature worth a picture; everything else is a bullet under Added, Changed, Fixed or Security.
4. **Write it** under `## [Unreleased]`, never under a version, and leave every version number alone.
   - Bullet: `- **Title of at most 8 words.** One sentence of at most 22 words. ([#N](https://github.com/alfredoperez/speckit-companion/pull/N)) <!-- area: <id> -->`
   - Highlight: a `#### Title`, at most two such sentences, then `<!-- area: <id>; pr: N; media: <ids> -->`
   - Second person, present tense, what you do or see first. At most one `==phrase==` of two to four words. Setting keys, commands and button names in code or bold. No file or symbol names, no "now", no "previously", no history of the bug.
5. **Area.** One id from `apps/website/src/components/changelog/changelogAreas.ts`.
6. **Picture.** For a highlight, look for a matching shot in `tooling/scripts/shots.json` (its output is `.shots/`) and name its id under `media:`; a media id also needs its entry in `content/media/changelog.json` or the site build fails. No shot fits: say which one is missing instead of inventing an id.
7. **Check.** `npm test -- docs-consistency` names any entry that breaks a rule. Cut words until it passes; a fact that does not fit belongs in the docs page.

Report the entry as written and the file it went into.
