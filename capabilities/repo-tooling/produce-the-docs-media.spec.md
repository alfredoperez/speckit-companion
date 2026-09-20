# Produce the docs media — Living Spec

## Purpose

A maintainer produces every docs image, README GIF and site clip from the product's own screens, so the pictures never drift from what ships. Without these rules a rename breaks the live Marketplace listing, a retheme leaves two palettes on one page, or the deployed site shows broken images.

## Requirements

### A published image keeps its filename forever
<!-- touches: docs/screenshots/generated/**, tooling/scripts/capture-docs-images.mjs, tooling/scripts/build-clip-gifs.mjs -->

A file under `docs/screenshots/generated/` SHALL be overwritten in place and never renamed or deleted. The Marketplace serves the last published README and resolves its images against current `main`, so a moved file breaks a listing that is already live. A capture story may be renamed. The file it writes may not.

#### Scenario: a capture story is renamed
- **WHEN** a maintainer renames the story behind a published image
- **THEN** the image is still written under its old filename

### A generated image is changed at its source and regenerated
<!-- touches: tooling/scripts/capture-docs-images.mjs, tooling/scripts/build-clip-gifs.mjs, tooling/scripts/build-stills.mjs, docs/screenshots/generated/**, content/media/web/** -->

Every docs image, GIF, web clip, poster and still SHALL come from a command, shot from the capture stories and their fixtures or cut from a clip's own frames. A hand edit to an output is lost on the next run. The capture script's story list and the GIF script's list are the authority for which source feeds which file.

#### Scenario: a screenshot needs a touch-up
- **WHEN** a maintainer wants a published image to look different
- **THEN** they change the story, the fixture, the composition or the script's list, and rerun the command

### Two runs over unchanged screens produce the same bytes
<!-- touches: apps/vscode/webview/src/spec-viewer/__stories__/captureFrame.tsx, tooling/scripts/capture-docs-images.mjs, tooling/scripts/visual-builder.mjs -->

A capture run over sources nobody changed SHALL write files identical to the last run's. The screens are shot with the clock pinned to one instant, with animations and transitions finished, and with scrollbars gone, so a relative time, a running timer, a half-played transition or a scroll gutter cannot differ between runs. Overwriting in place only works when a rerun is free.

#### Scenario: a rerun with nothing changed
- **WHEN** a maintainer re-shoots the docs images having changed nothing
- **THEN** no file shows as modified

#### Scenario: a screen shows an elapsed time
- **WHEN** a screen holding a running timer is captured twice, months apart
- **THEN** both captures read the same elapsed time

### A change to what the screens look like runs the whole chain
<!-- touches: tooling/scripts/**, .storybook/capture-theme.ts, content/media/feature-clips/**, package.json -->

A change to the webview UI, styling, design tokens, capture palette, capture stories or fixtures SHALL be followed by the chain in order: re-shoot the docs images, re-shoot the clip captures, re-render each affected composition, encode the web clips, cut the stills, encode the GIFs, sync to the site, check. `npm run media:all` runs every stage except the per-composition render, which is done by hand first. A composition that is drawn instead of captured does not follow the palette and is rethemed by hand.

#### Scenario: the chain stops early
- **WHEN** the clips are re-rendered but the GIFs are not re-encoded
- **THEN** the README shows the old palette while the site shows the new one

#### Scenario: one clip changed
- **WHEN** a maintainer re-shoots with a composition name as the filter
- **THEN** only that composition's captures are rewritten

### The media manifest says what each feature owes and who reads it
<!-- touches: content/media/manifest.json, tooling/scripts/check-media-manifest.mjs, tooling/scripts/new-clip.mjs, README.md, apps/speckit-extension/README.md -->

`content/media/manifest.json` SHALL list, per feature, every output the feature owes, its alt text, and which README references which path. A path is listed whether or not the file exists yet. The check fails as broken when a published path is gone, a README references a path the manifest lacks, the manifest claims a reference a README no longer has, or alt text differs between the two. An output not produced yet is pending. A render that is not kept in git is reported as not built and does not fail the check. A new clip is started with `npm run clips:new`, which writes the manifest entry, the composition and its capture stub together.

#### Scenario: a README adds an image the manifest does not list
- **WHEN** `npm run clips:check` runs
- **THEN** it exits as broken and names the path

#### Scenario: a fresh clone
- **WHEN** the check runs where no clip has been rendered
- **THEN** the full-size renders are listed as not built locally and the check still passes

### The two READMEs link images differently
<!-- touches: README.md, apps/speckit-extension/README.md -->

The root README SHALL link images by relative path, which GitHub resolves and packaging rewrites to absolute. The spec-kit extension README SHALL link them by absolute `raw.githubusercontent.com/.../main/` address, because the community catalog renders that file from `main` and cannot resolve a relative path.

#### Scenario: an image is added to the extension README
- **WHEN** a maintainer embeds a generated image there
- **THEN** the link is the absolute address pinned to `main`

### The site serves only the web outputs the manifest names, and they are kept in git
<!-- touches: content/media/web/**, content/media/.gitignore, apps/website/scripts/sync-media.mjs, tooling/scripts/render-web-clips.mjs -->

The site's media folder SHALL be filled by copying the outputs under `content/media/web/` that the manifest's site surfaces read, and the site's own build runs that copy. `content/media/web/` SHALL stay tracked in git, because a deploy cannot produce the captures or renders it is made from. The full-size renders stay out of git.

#### Scenario: a site surface starts reading a new output
- **WHEN** a key is added to a site surface in the manifest
- **THEN** the next sync copies that output with no other edit

#### Scenario: a deploy from a fresh clone
- **WHEN** the site builds on a machine that never rendered a clip
- **THEN** every clip, poster and still is present

### A clip's poster is its first frame
<!-- touches: tooling/scripts/render-web-clips.mjs, content/media/web/** -->

Each web clip SHALL ship with a WebM, an MP4 fallback, a poster and a 16:9 social card, and the poster SHALL be frame zero of the encoded clip. The encode fails when it is not, because the site swaps the video in over the poster and a mismatch shows as a jump.

#### Scenario: a poster is left over from an older render
- **WHEN** the web clips are verified
- **THEN** the run fails on the poster that does not match its clip's first frame

## Uncovered

- The five hand-taken screenshots have no command behind them. Nothing flags them as stale after a UI change.
- Nothing checks that a drawn composition was rethemed along with the captured ones.
