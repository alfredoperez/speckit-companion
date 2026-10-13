# Media manifest

The feature asset bundle contract. One feature is produced once and read by several surfaces, and `content/media/manifest.json` is the single place that says which file each surface reads. Its `surfaces` and `features` blocks are the rosters, so never carry a count in prose. How the files get made is in `visual-assets.md` and `../SKILL.md`.

## The contract

A feature has an id: the composition directory name for a clip, or a short slug for a published still with no clip behind it. Per feature the manifest records:

| Field | What it is |
| --- | --- |
| `composition` | The HyperFrames project directory, or `null` for a still-only feature |
| `canonicalMp4` | The full-resolution render, under the composition's `renders/`, named `<id>.mp4` |
| `webWebm` | The clip encoded for muted autoplay on the site |
| `webMp4` | The H.264 fallback, because Safari does not take every WebM |
| `poster` | Frame zero as a PNG, so a paused player shows the clip's resting pose |
| `xCrop` | A 16:9 crop of the poster frame, for social timelines |
| `heroStill` | The crop the landing page's hero shows, for the features that appear there |
| `panelStill` | The figure beside this feature's row in the landing page's feature accordion |
| `lightwellHero` / `lightwellSection` | Page chrome: the painted light a product frame sits in front of |
| `docsStill` | The published PNG a docs page or a README points at |
| `readmeGif` | The published GIF a README embeds |
| `extraStills` | Other published stills the feature owns, such as an annotated variant |
| `alt` | Alt text keyed by path, because a feature's GIF and still are described differently |
| `referencedBy` | Which README references which path |
| `claim` | One line of marketing claim. Leave it empty unless the claim ledger has a verified line. |
| `unnormalized` | Timestamped renders not yet collapsed into the canonical `<id>.mp4` name |
| `notes` | Anything a reader of the entry needs that the fields do not say |

- **Not every feature owes every key.** Only features the landing page shows carry a `heroStill` or `panelStill`, and the lightwell pair belongs to one still-only entry. A key nobody will produce makes the checker ask for it forever.
- **Paths that do not exist yet are listed anyway.** The manifest states the shape a feature should have, and the checker reports the difference.
- `conventions.webNaming` holds the filename pattern for each key and `conventions.producedBy` names the script that writes it, so the manifest also answers "what made this file".

## Which surface reads what

| Surface | Reads | Why |
| --- | --- | --- |
| Root `README.md` | `readmeGif`, `docsStill`, `extraStills`, by relative path | `vsce` rewrites relative paths to raw URLs at package time. GitHub cannot play video, so motion is a GIF. |
| `apps/speckit-extension/README.md` | The same three, by absolute `raw.githubusercontent.com/.../main/` URL | The Spec Kit community catalog renders the file from `main` and cannot resolve relative paths |
| Landing page (`apps/website/`) | `webWebm`, `webMp4`, `poster`, `heroStill`, `panelStill`, the lightwell pair | Several clips share one screen, which GIFs cannot survive |
| Docs pages | `docsStill` first; the clip only when the point is a state change | A guide mostly wants one still it can refer to in prose |
| Articles | `readmeGif`, `docsStill` | Published from another repo and host, where GIF and PNG travel without a build step |
| X posts | `xCrop`, falling back to `docsStill` | X crops the 1.577:1 frame badly in timeline preview |

## How assets reach the site

Only the web outputs are copied. `npm run clips:sync` (`node apps/website/scripts/sync-media.mjs`) copies the paths under `content/media/web/` that the manifest names into `apps/website/public/media/`. The set is derived: every surface whose id starts with `site-`, the union of the output keys those surfaces read, kept when the declared path sits under `site.sourceDir`.

- Add a key to a `site-*` surface and it starts syncing. Nothing else needs editing.
- Canonical MP4s and `xCrop` can never enter the set: no site surface reads them.
- The site's `build` script runs the sync, so never copy sources into the site folder by hand.

Everything else is referenced in place. `docs/screenshots/generated/` is never copied anywhere.

Two things travel outside the manifest:

- **Mascot poses.** `node tooling/scripts/build-mascot-assets.mjs` writes straight into `apps/website/public/mascot/` with its own small manifest of pixel dimensions. The `mascot-hero` entry here is a different file: the illustrated `apps/speckit-extension/assets/hero.png` the Spec Kit extension README embeds.
- **Changelog screenshots.** `content/media/changelog.json` has one entry per screenshot, keyed by release and media id, with alt text and an optional highlight box. It points at stills that already exist and copies nothing.

## Published filenames cannot move

Every path under `docs/screenshots/generated/` is load-bearing. README image URLs are pinned to `main`, and the Marketplace serves the last published README while resolving its images against current `main`, so renaming or deleting a referenced file breaks the live listing. Overwrite in place.

The checker enforces the references from both sides: it fails when a README references a path the manifest does not list, and when the manifest claims a reference the README no longer has.

A composition existing is not evidence that it publishes; the manifest's `readmeGif` is. `overview.gif` is rendered from the **`overview`** composition, and `overview-readme`, the slower cut of the same page, publishes nothing.

## Checking it

```
npm run clips:check                                # storyboard check, then the manifest check
node tooling/scripts/check-media-manifest.mjs      # the manifest check alone
```

It prints, per feature, which outputs are missing, in three groups:

| Group | Meaning | Exit code |
| --- | --- | --- |
| Broken | A published path is gone, a README references something the manifest does not know, or alt text differs between the README and the manifest | 2 |
| Pending | An output the contract names has not been produced | 1 |
| Not built locally | A canonical MP4 under the gitignored `renders/`, rebuilt with `npm run render` in the composition directory. A fresh clone always lists these. | No effect |

A clean tree exits 0. Broken is a publishing bug and must stay at zero; pending is a to-do list.

## Adding a feature

1. For a clip, run `npm run clips:new -- <id> "Human name"`, which writes the manifest entry. For a still-only feature, add the entry by hand with every owed output path filled in, existing or not.
2. Keep only the keys the feature owes.
3. Write alt text for every image output. Leave it empty only for an asset that does not exist yet or for decorative page chrome (say so in `notes`).
4. Leave `claim` empty.
5. Run `npm run clips:check`. The broken count must be zero.
