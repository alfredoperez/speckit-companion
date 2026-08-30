# Media Manifest

The feature asset bundle contract. One feature is produced once and read by several surfaces, and `media/manifest.json` is the single place that says which file each surface reads — its `surfaces` block is the roster.

`docs/visual-assets.md` is the rulebook for how the images and clips get *made*. This document is the rulebook for what a finished feature *owes*, and where each output goes. For the command-by-command chain that produces a clip, use the `feature-clip` skill; neither of these documents repeats it.

## Why this exists

Before the manifest, the outputs were scattered with nothing indexing them. GIFs are published under `docs/screenshots/generated/`, MP4s sit in `media/feature-clips/<id>/renders/` which is gitignored, and several compositions have only timestamped MP4 filenames with no canonical name. Nothing recorded which of the two Overview compositions the root README's `overview.gif` actually comes from, so that fact lived in one line of a storyboard and was cited backwards for months. Every new surface that wanted an asset had to rediscover all of this, and the usual outcome was rebuilding something that already existed.

## The contract

A feature has an id. The id is the composition directory name for a clip, or a short slug for a still that has no clip. Every composition under `media/feature-clips/` is indexed, plus a still-only entry for each published image that has no clip behind it; `media/manifest.json` and the checker's `features` count are the roster, so don't carry a number around in prose. For each feature the manifest records:

| Field | What it is |
| --- | --- |
| `composition` | The HyperFrames project directory, or `null` for a still-only feature |
| `canonicalMp4` | The full-resolution render, under the composition's `renders/`, named `<id>.mp4` |
| `webWebm` | The clip encoded for muted autoplay on the site |
| `webMp4` | The H.264 fallback, because Safari does not take every WebM |
| `poster` | Frame zero as a PNG, so a paused player shows the clip's resting pose instead of a black box |
| `xCrop` | A 16:9 crop of the poster frame, for social timelines |
| `heroStill` | The crop the landing page's hero cycles through, for the features that appear there |
| `panelStill` | The figure beside this feature's row in the landing page's feature accordion |
| `lightwellHero` / `lightwellSection` | Page chrome, not product imagery: the painted light a product frame sits in front of |
| `docsStill` | The published PNG a docs page or a README points at |
| `readmeGif` | The published GIF a README embeds |
| `extraStills` | Other published stills the same feature owns, such as an annotated variant |
| `alt` | Alt text, keyed by path, because the same feature's GIF and still are described differently |
| `referencedBy` | Which README references which path |
| `claim` | One line, empty for now. Wave 2 fills it from the claim ledger (ticket T9) |
| `unnormalized` | Timestamped renders that still need collapsing into the canonical name (ticket T6) |

Not every feature owes every key: only the features the landing page shows carry a `heroStill` or a `panelStill`, and the lightwell pair belongs to one still-only entry. `conventions.webNaming` holds the filename pattern for each key and `conventions.producedBy` names the script that writes it, so the manifest answers "what made this file" as well as "who reads it".

Paths that don't exist yet are listed anyway. The manifest states the shape a feature is supposed to have, not an inventory of what happens to be on disk, and the checker reports the difference.

## Which surface reads what, and why

**The root README** (`README.md`) reads `readmeGif`, `docsStill` and `extraStills` through relative paths. Relative is deliberate: GitHub resolves them, and `vsce` rewrites them to absolute raw URLs at package time. GitHub can't play video, so the animated surface here has to be a GIF even though a GIF costs several times what the same clip costs as WebM.

**The Spec Kit extension README** (`speckit-extension/README.md`) reads the same three kinds through absolute `raw.githubusercontent.com/.../main/` URLs. The Spec Kit community catalog renders that file from `main` and can't resolve relative paths, so it has no other option.

**The landing page** at `website/` reads `webWebm`, `webMp4` and `poster`, plus `heroStill`, `panelStill` and the lightwell pair. It carries several clips on one screen, which a set of GIFs can't survive. The poster matters as much as the video: it's the frame a reader sees before anything plays, and it has to match frame zero or the clip flashes when it starts. The stills are crops of the same clips rather than separate shots — `scripts/build-stills.mjs` cuts them, because a whole IDE window shrunk into the hero column is unreadable, and because cutting from the clip's own pixels means the figure can never drift away from what the clip shows.

**The docs pages** read `docsStill` first and the clip only when the point being made is a state change. A guide mostly wants one still it can refer to in prose.

**Articles** read `readmeGif` and `docsStill`. They're published from a different repo on a different host, so GIF and PNG travel without a build step in a way video wouldn't.

**X posts** read `xCrop`, falling back to `docsStill`. The captures are 1836x1164, which is 1.577:1, and X crops that badly in timeline preview. Cutting the 16:9 frame once, here, beats letting the platform choose where to cut. `scripts/render-web-clips.mjs` produces it alongside the poster, as a centred vertical crop: a 16:9 cut of a 1.577:1 frame loses height and never width.

## How assets reach the site

The web outputs are the only ones that get copied. `node website/scripts/sync-media.mjs` (or `npm run clips:sync`) copies the paths under `media/web/` that the manifest names into `website/public/media/`, because Astro serves from a public directory and doesn't follow a symlink reliably on a host. Which files that means is derived, not hardcoded: the script takes every surface whose id starts with `site-`, unions the output keys those surfaces read, and keeps the keys whose declared path sits under `site.sourceDir`. Add a key to a `site-*` surface and it starts syncing; nothing else has to be edited. The full-size canonical MP4s live outside `sourceDir` and no site surface reads them, so they can never enter the set; neither can `xCrop`, which only the social-x surface reads.

**The site's own build runs it.** `website`'s `build` script is `sync:media && astro build`, so a deploy always syncs whatever is in `media/web/` — nobody has to remember the step, and a deploy can't ship against a stale copy. Run it by hand only when you want a fresh render visible in a local dev server without a full build.

`--check` reports without writing. Duplicating the sources into the site folder by hand would reintroduce exactly the drift this file exists to kill.

The mascot art travels on its own track. `node scripts/build-mascot-assets.mjs` derives the site's WebP and PNG poses from `assets/mascot/poses/` straight into `website/public/mascot/`, with its own small manifest of per-pose pixel dimensions beside them. It doesn't pass through `media/manifest.json`, because nothing it produces is a clip output and no README references it. The manifest's `mascot-hero` entry covers a different file: the illustrated `speckit-extension/assets/hero.png` that the Spec Kit extension README embeds.

Everything else is referenced in place. `docs/screenshots/generated/` is never copied anywhere, which is why the manifest distinguishes web outputs from README outputs rather than treating them as one pile.

## Published filenames can't move

Every path under `docs/screenshots/generated/` is load-bearing. README image URLs are pinned to `main`, and the Marketplace serves the *last published* README while resolving its images against *current* `main`. Renaming or deleting a referenced screenshot retroactively 404s the live listing, which has already happened once to the v0.18.0 listing.

So: overwrite in place, never rename, never delete. The pair of Overview compositions is the case that keeps getting cited backwards, so state it once:

- `docs/screenshots/generated/overview.gif` is rendered from the **`overview`** composition — the fast ten-beat cut. That entry's `readmeGif` in the manifest, and the first line of `media/feature-clips/overview/STORYBOARD.md`, are the two places to check it.
- `overview-readme`, the slower cut of the same page, publishes nothing at all. It is kept for the establishing pull-back and the end card the faster one has no room for. Its own storyboard opens by saying so.

A composition existing is not evidence that it publishes; the manifest's `readmeGif` is.

The checker enforces this from both directions. It fails if a README references a path the manifest doesn't list, and it fails if the manifest claims a reference the README no longer has.

## Renders aren't in git, but the web outputs are

`media/.gitignore` excludes `**/renders/`, so canonical MP4s exist only on a machine that has rendered them. About 100 MB of MP4 that any clone can rebuild doesn't belong in the extension's history. A fresh clone will always see those paths reported as not built; that's correct, and the checker separates them from real breakage and labels them so.

`media/web/` is the exception, and it's tracked deliberately. Its files are regenerable in principle, but only from the Storybook captures and the hyperframes renders — neither of which is in the repo, and neither of which a deploy could produce. While it was ignored, a fresh clone had no imagery at all and the deployed site rendered every screenshot and clip as a broken image. The cost is that a retheme rewrites the whole set and history grows by roughly its size each time; Git LFS is the fix if that ever bites, not un-tracking it again.

One thing hasn't caught up: `conventions.webSourceDirTracked` in the manifest still reads `false`. `media/.gitignore` is the authority, and it says tracked.

## Checking it

```
node scripts/check-media-manifest.mjs      # or: npm run clips:check, which also runs the storyboard check
```

It prints, per feature, exactly which outputs are missing, and sorts them into three groups:

- **Broken.** A published path is gone, a README references something the manifest doesn't know, or alt text has drifted between the README and the manifest. Exit code 2.
- **Pending.** An output the contract names hasn't been produced yet. Exit code 1.
- **Not built locally.** A gitignored render that rebuilds with `npm run render` in the composition directory. Doesn't affect the exit code on its own.

**A clean tree exits 0 now, so treat anything else as a real signal.** Every key the contract names has a producer: `scripts/render-web-clips.mjs` writes the WebM, the MP4 fallback, the poster and the 16:9 card; `scripts/build-stills.mjs` writes the hero and panel crops; `scripts/build-lightwell.mjs` writes the lightwell pair; `scripts/build-clip-gifs.mjs` writes the published GIFs. The only entries a checked-out tree should still list are canonical MP4s under the gitignored `renders/`, and the compositions still carrying a timestamped render filename instead of `<id>.mp4` (their `unnormalized` array names them, ticket T6).

The number that must stay at zero is the broken count. Pending is a to-do list; broken is a publishing bug.

## Adding a feature

1. Add the entry to `media/manifest.json` with every output path filled in, existing or not. For a clip, `npm run clips:new -- <id> "Human name"` writes this entry for you, along with the composition and its `CLIP_CAPTURES` stub — a hand-copied composition skips all three.
2. Fill in only the keys the feature actually owes. A clip that never appears on the landing page has no `heroStill` or `panelStill`; adding one means the checker starts asking for a file nobody is going to make.
3. Write alt text for every image output. Leave it empty only when the asset doesn't exist yet and you'd have to guess what it shows, or when the image is decorative page chrome — the lightwell pair is empty by design and says so in its `notes`.
4. Leave `claim` empty unless the claim ledger has a verified line for it.
5. Run `npm run clips:check`. The broken count must be zero.
