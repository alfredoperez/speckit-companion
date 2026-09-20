# Media Pipeline — Living Spec

## Purpose

How the documentation images, README GIFs, and site renders get built, checked and kept in step with each other — The two narrated runbooks this was written from are gone; what they carried that is still true is stated here as requirements, and the commands themselves are the `media:*` and `clips:*` scripts in the root `package.json`.

## Requirements

### A capture rebuild overwrites its filenames, never renames or drops one
<!-- touches: tooling/scripts/capture-docs-images.mjs -->

Re-running the documentation capture SHALL rewrite the same set of published filenames under `docs/screenshots/generated/`, because those paths are pinned into a previously published README. It SHALL never produce a new filename for an existing image or leave a stale one behind.

#### Scenario: a webview styling change makes the captured images stale
- **WHEN** `npm run clips:capture` runs afterward
- **THEN** the same filenames are rewritten in place, and none are renamed or removed

### A retheme is not finished until the whole render chain has run
<!-- touches: tooling/scripts/capture-docs-images.mjs, tooling/scripts/render-web-clips.mjs, tooling/scripts/build-stills.mjs, tooling/scripts/build-clip-gifs.mjs -->

Changing the active capture palette SHALL make the generated documentation images, every clip capture, every clip render, the published GIFs, and the site stills all stale at the same moment. Stopping partway through the command chain SHALL leave some published surfaces on the old palette while others show the new one.

#### Scenario: only the documentation images are re-captured after a retheme
- **WHEN** the clip renders, GIFs and site stills are not also rebuilt
- **THEN** the README's GIFs and the site still show the old palette while the docs images show the new one

#### Scenario: the full chain runs in order
- **WHEN** capture, `clips:render`, `clips:stills`, `clips:gifs`, `clips:sync` and `clips:check` all complete
- **THEN** every published surface shows the same palette

### The manifest checker tells broken apart from merely unproduced
<!-- touches: tooling/scripts/check-media-manifest.mjs -->

Checking the media manifest against the filesystem and both READMEs SHALL classify every gap into broken, pending, or not built locally, and SHALL fail only on broken: a missing published path a README still references, a README reference the manifest does not know, or alt text that disagrees between the two.

#### Scenario: a published GIF is deleted but a README still references it
- **WHEN** the checker runs
- **THEN** it reports the path broken and exits non-zero

#### Scenario: a manifest entry names an output nobody has produced yet
- **WHEN** the checker runs
- **THEN** it reports the output pending, and this alone does not fail the check the way broken does

### A composition's storyboard and its code stay one fact, not two
<!-- touches: tooling/scripts/clip-storyboard.mjs -->

Checking a composition's storyboard SHALL compare the `BEATS` and `CUTS` arrays coded in its `index.html` against the Beats table in its `STORYBOARD.md`, and SHALL report any difference in beat count, timing, or label. A hand-authored composition with no `BEATS` array SHALL be reported skipped, not failing.

#### Scenario: a beat's label is changed in `index.html` without updating the storyboard
- **WHEN** `npm run clips:check` runs
- **THEN** the mismatch is reported and the check exits non-zero

#### Scenario: the storyboard's label is edited instead, and `--apply` is run
- **WHEN** the composition is named on the command
- **THEN** the label is written into `index.html` and its matching element, and nothing else in the file changes

### A web render's poster always matches the clip's first frame
<!-- touches: tooling/scripts/render-web-clips.mjs -->

Encoding a composition's web outputs SHALL lift the poster from the encoded WebM rather than the source render, and SHALL verify it against the WebM's own first decoded frame before the render is considered complete.

#### Scenario: the lifted poster does not match the encoded video's first frame
- **WHEN** `npm run clips:render` verifies it
- **THEN** the render fails rather than shipping a poster that flashes when the clip starts

### Two capture runs over unchanged sources produce byte-identical files
<!-- touches: tooling/scripts/capture-docs-images.mjs, tooling/scripts/lib/storybook-browser.mjs -->

A capture run SHALL freeze the clock and remove animation, transition and scrollbar variance before shooting, and SHALL read the active palette from a plain object with no dependency on the clock, the environment, or prior DOM state, so a second run over unchanged sources writes nothing new.

#### Scenario: the capture script runs twice with no source change between runs
- **WHEN** the second run finishes
- **THEN** `git status` on `docs/screenshots/generated/` is empty

### The Pipeline Builder's CI gate checks layout only; pixels stay local
<!-- touches: tooling/scripts/visual-builder.mjs -->

The Pipeline Builder's visual tests SHALL separate a layout check that holds on any machine from a pixel comparison that does not, so CI runs the former and never the latter.

#### Scenario: a panel change overflows its shell at the narrow width
- **WHEN** `npm run test:visual:ci` runs
- **THEN** it fails on any machine, including CI

#### Scenario: only font rasterization differs between two machines
- **WHEN** `npm run test:visual` compares pixels locally
- **THEN** it may report a diff, while `npm run test:visual:ci` still passes

### The web output directory stays populated even on a fresh clone
<!-- touches: content/media/manifest.json -->

`content/media/web/` SHALL stay tracked in git even though its files are regenerable, because rebuilding them needs Storybook captures and renders a deploy cannot produce; the per-composition `renders/` directories SHALL stay gitignored, since only a local `npm run render` can rebuild those and shipping ~100MB of MP4 in history is not worth it.

#### Scenario: the repository is freshly cloned
- **WHEN** the site or the README is built from that clone
- **THEN** `content/media/web/` already holds real files, while every composition's `renders/` is empty until `npm run render` is run locally

## Uncovered

_`tooling/scripts/build-favicons.mjs`, `build-lightwell.mjs`, `build-mascot-assets.mjs` and `new-clip.mjs` are page-chrome and scaffolding tools outside the capture-palette chain; each is named by its own `package.json` script. `content/media/feature-clips/**` holds the compositions the requirements above build and check, not additional behaviour of its own._
