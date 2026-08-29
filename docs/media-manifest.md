# Media Manifest

The feature asset bundle contract. One feature is produced once and read by five surfaces, and `media/manifest.json` is the single place that says which file each surface reads.

`docs/visual-assets.md` is the rulebook for how the images and clips get *made*. This document is the rulebook for what a finished feature *owes*, and where each output goes.

## Why this exists

Before the manifest, the outputs were scattered with nothing indexing them. GIFs are published under `docs/screenshots/generated/`, MP4s sit in `media/feature-clips/<id>/renders/` which is gitignored, and several compositions have only timestamped MP4 filenames with no canonical name. Nothing recorded that the root README's `overview.gif` is rendered from the `overview-readme` composition and not from `overview`, so that fact lived in one line of a storyboard. Every new surface that wanted an asset had to rediscover all of this, and the usual outcome was rebuilding something that already existed.

## The contract

A feature has an id. The id is the composition directory name for a clip, or a short slug for a still that has no clip. Twenty features are indexed today: the fourteen compositions under `media/feature-clips/`, plus six still-only entries. For each feature the manifest records:

| Field | What it is |
| --- | --- |
| `composition` | The HyperFrames project directory, or `null` for a still-only feature |
| `canonicalMp4` | The full-resolution render, under the composition's `renders/`, named `<id>.mp4` |
| `webWebm` | The clip encoded for muted autoplay on the site |
| `webMp4` | The H.264 fallback, because Safari does not take every WebM |
| `poster` | Frame zero as a PNG, so a paused player shows the clip's resting pose instead of a black box |
| `xCrop` | A 16:9 crop of the poster frame |
| `docsStill` | The published PNG a docs page or a README points at |
| `readmeGif` | The published GIF a README embeds |
| `extraStills` | Other published stills the same feature owns, such as an annotated variant |
| `alt` | Alt text, keyed by path, because the same feature's GIF and still are described differently |
| `referencedBy` | Which README references which path |
| `claim` | One line, empty for now. Wave 2 fills it from the claim ledger (ticket T9) |
| `unnormalized` | Timestamped renders that still need collapsing into the canonical name (ticket T6) |

Paths that don't exist yet are listed anyway. The manifest states the shape a feature is supposed to have, not an inventory of what happens to be on disk, and the checker reports the difference.

## Which surface reads what, and why

**The root README** (`README.md`) reads `readmeGif`, `docsStill` and `extraStills` through relative paths. Relative is deliberate: GitHub resolves them, and `vsce` rewrites them to absolute raw URLs at package time. GitHub can't play video, so the animated surface here has to be a GIF even though a GIF costs several times what the same clip costs as WebM.

**The Spec Kit extension README** (`speckit-extension/README.md`) reads the same three kinds through absolute `raw.githubusercontent.com/.../main/` URLs. The Spec Kit community catalog renders that file from `main` and can't resolve relative paths, so it has no other option.

**The landing page** at `website/` reads `webWebm`, `webMp4` and `poster`. It carries several clips on one screen, which a set of GIFs can't survive. The poster matters as much as the video: it's the frame a reader sees before anything plays, and it has to match frame zero or the clip flashes when it starts.

**The docs pages** read `docsStill` first and the clip only when the point being made is a state change. A guide mostly wants one still it can refer to in prose.

**Articles** read `readmeGif` and `docsStill`. They're published from a different repo on a different host, so GIF and PNG travel without a build step in a way video wouldn't.

**X posts** read `xCrop`, falling back to `docsStill`. The captures are 1836x1164, which is 1.577:1, and X crops that badly in timeline preview. Cutting the 16:9 frame once, here, beats letting the platform choose where to cut.

## How assets reach the site

The web outputs are the only ones that get copied. `node website/scripts/sync-media.mjs` copies the paths under `media/web/` that the manifest names into `website/public/media/`, because Astro serves from a public directory and doesn't follow a symlink reliably on a host. Which files that means is derived, not hardcoded: the script takes every surface whose id starts with `site-`, unions the output keys those surfaces read, and keeps the keys whose declared path sits under `site.sourceDir`. Today that resolves to `webWebm`, `webMp4` and `poster`. The full-size canonical MP4s live outside `sourceDir` and no site surface reads them, so they can never enter the set; neither can `xCrop`, which only the social-x surface reads.

`--check` reports without writing. Duplicating the sources into the site folder by hand would reintroduce exactly the drift this file exists to kill.

The mascot art travels on its own track. `node scripts/build-mascot-assets.mjs` derives the site's WebP and PNG poses from `assets/mascot/poses/` straight into `website/public/mascot/`, with its own small manifest of per-pose pixel dimensions beside them. It doesn't pass through `media/manifest.json`, because nothing it produces is a clip output and no README references it. The manifest's `mascot-hero` entry covers a different file: the illustrated `speckit-extension/assets/hero.png` that the Spec Kit extension README embeds.

Everything else is referenced in place. `docs/screenshots/generated/` is never copied anywhere, which is why the manifest distinguishes web outputs from README outputs rather than treating them as one pile.

## Published filenames can't move

Every path under `docs/screenshots/generated/` is load-bearing. README image URLs are pinned to `main`, and the Marketplace serves the *last published* README while resolving its images against *current* `main`. Renaming or deleting a referenced screenshot retroactively 404s the live listing, which has already happened once to the v0.18.0 listing.

So: overwrite in place, never rename, never delete. Two published names don't match their feature id and stay that way on purpose:

- `docs/screenshots/generated/overview.gif` is rendered from the `overview-readme` composition, not from `overview`.
- The `overview` composition's own GIF isn't published at all.

The checker enforces this from both directions. It fails if a README references a path the manifest doesn't list, and it fails if the manifest claims a reference the README no longer has.

## Renders aren't in git

`media/.gitignore` excludes `**/renders/` and `media/web/`, so canonical MP4s and web outputs exist only on a machine that has rendered them. About 100 MB of MP4 that any clone can rebuild doesn't belong in the extension's history.

This means a fresh clone will always see those paths reported as not built. That's correct. The checker separates them from real breakage and labels them so.

## Checking it

```
node scripts/check-media-manifest.mjs
```

It prints, per feature, exactly which outputs are missing, and sorts them into three groups:

- **Broken.** A published path is gone, a README references something the manifest doesn't know, or alt text has drifted between the README and the manifest. Exit code 2.
- **Pending.** An output the contract names hasn't been produced yet. Exit code 1.
- **Not built locally.** A gitignored render that rebuilds with `npm run render` in the composition directory. Doesn't affect the exit code on its own.

**It still reports `INCOMPLETE`, and that's expected.** The web render branch has landed: `node scripts/render-web-clips.mjs` produces the WebM, the MP4 fallback and the poster, and all fourteen compositions have that trio under `media/web/`. Two things are outstanding. The 16:9 `xCrop` has no producer yet, so it's pending on every clip. And the four newest compositions (`living-specs`, `review`, `own-workflow`, `workflow-documents`) still carry timestamped render filenames rather than the canonical `<id>.mp4`, which is why the checker lists their canonical MP4 as not built and flags a render to collapse. `INCOMPLETE` is a to-do list, not a failure. What must stay at zero is the broken count, and it is: the last run read 20 features, 0 broken, 14 pending, 4 not built locally.

## Adding a feature

1. Add the entry to `media/manifest.json` with every output path filled in, existing or not.
2. Write alt text for every image output. Leave it empty only when the asset doesn't exist yet and you'd have to guess what it shows.
3. Leave `claim` empty unless the claim ledger has a verified line for it.
4. Run the checker. The broken count must be zero.
