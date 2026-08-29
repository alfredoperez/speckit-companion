# Web renders

The web video branch of the clip pipeline: `node scripts/render-web-clips.mjs`. It reads the MP4s that hyperframes already rendered into `media/feature-clips/<id>/renders/` and writes, per composition, a VP9 WebM, an H.264 MP4 fallback for Safari, and a poster PNG lifted from frame zero. Output lands in `media/web/`, which `media/.gitignore` excludes because it's regenerable.

The GIF path is not part of this. The script never reads, writes, or deletes a `.gif`, and never writes into `renders/`. The seven published GIFs in `docs/screenshots/generated/` still total 14,226,018 bytes and are still what the two READMEs embed, because a README can't play video.

## Running it

```
node scripts/render-web-clips.mjs                 # every composition
node scripts/render-web-clips.mjs overview        # one composition
node scripts/render-web-clips.mjs --list          # which source MP4 each id resolves to
node scripts/render-web-clips.mjs --verify-only   # re-check existing outputs, encode nothing
```

Flags: `--width=`, `--vp9-crf=`, `--h264-crf=`, `--out=`, `--jobs=`. If `ffmpeg` or `ffprobe` isn't on PATH the script exits 1 and writes nothing. If a composition has no MP4 in its `renders/` it's skipped by name with the reason printed, and the rest still encode.

Filenames follow `media/manifest.json` under `conventions.webNaming`: `<id>.webm`, `<id>.mp4`, `<id>-poster.png`. The 16:9 X crop that the manifest also names is a different ticket and this script doesn't produce it.

## Source selection

Some compositions carry several timestamped takes in `renders/`. The rule is: use the plain `<id>.mp4` if the composition has one, otherwise the newest timestamped file. `--list` prints what each id resolved to, so the choice is never silent.

That gives ten sources, all 1836x1164 at 30 fps, 163.4 seconds of footage, 30.94 MB. The full `renders/` tree is 53,613,707 bytes across sixteen MP4s, but six of those are superseded takes that no surface points at.

## Encode settings

Measured with ffmpeg 9.0.1 (Homebrew, `--enable-libvpx --enable-libx264 --enable-libvmaf`).

Shared filter, applied to both formats:

```
scale=960:-2:flags=lanczos,setsar=1
```

960 wide gives 960x608 with square pixels. Frame rate is left alone. The sources are 30 fps and resampling to 24 lands on a 1.25 ratio, which duplicates every fourth frame and shows up as judder on the smooth pans. Dropping to 15 would be clean arithmetic but too choppy for UI motion, so native 30 it is.

**VP9 WebM**, two-pass:

```
-c:v libvpx-vp9 -b:v 0 -crf 46 -row-mt 1 -tile-columns 2 -g 240
-auto-alt-ref 6 -lag-in-frames 25 -deadline good -cpu-used 2 -pix_fmt yuv420p
```

**H.264 MP4** fallback:

```
-c:v libx264 -crf 32 -preset veryslow -profile:v main -level 4.0
-pix_fmt yuv420p -movflags +faststart
```

**Poster**, extracted from the encoded WebM:

```
-frames:v 1 -c:v png -compression_level 100 -pred mixed
```

Both encodes also carry `-an -sn -dn -map_metadata -1`. There's no audio stream at all, which is the strongest form of muted-autoplay friendly: nothing for a browser's autoplay policy to object to. `main` profile at level 4.0 with `yuv420p` is what Safari and every mobile decoder accept, and `+faststart` puts `moov` ahead of `mdat` so playback starts before the file finishes downloading. The page element still needs `muted playsinline` alongside `autoplay loop preload="none"`; the encode can't supply those.

## Measured output

Bytes, from the run of 2026-08-27.

| clip | duration | webm | mp4 | poster | poster == frame 0 |
| --- | --- | --- | --- | --- | --- |
| coverage | 7.9s | 147,949 | 131,610 | 100,133 | yes |
| inline-comments | 9.2s | 182,645 | 162,369 | 100,684 | yes |
| make-it-yours | 24.0s | 93,728 | 119,129 | 43,913 | yes |
| overview | 10.0s | 216,693 | 177,897 | 128,544 | yes |
| run-in-flight | 36.0s | 741,696 | 664,567 | 155,989 | yes |
| spec-viewer | 10.1s | 367,960 | 298,635 | 140,711 | yes |
| specs-sidebar | 9.4s | 89,894 | 103,450 | 103,916 | yes |
| step-rail | 10.8s | 437,654 | 349,652 | 157,162 | yes |
| overview-engine | 16.5s | 341,122 | 313,225 | 118,325 | yes |
| overview-readme | 29.5s | 505,373 | 509,207 | 116,704 | yes |

Totals:

> **Superseded, 2026-08-29.** The numbers below were measured at 960 px wide,
> H.264 CRF 32 / VP9 CRF 46, to hold a 5 MB budget for the whole landing set.
> That budget assumed every clip loads on page load. It does not: the `<video>`
> elements carry `preload="none"` and a clip is fetched only when its tab is
> selected, so the critical path is the posters and at most one clip.
>
> The encode is now **1440 px, H.264 CRF 26, VP9 CRF 40** — which is what this
> document's own sweep recommended before the budget overruled it: "width beats
> quantizer... spending the budget on resolution is the right trade for footage
> that's mostly small UI text." The site paints these into 864 CSS px, or 1728
> device px on a 2x display, so the old 960 px encode was upscaled almost 2x in
> the browser on top of a 1.9x downscale in ffmpeg.
>
> Current settings live in `DEFAULTS` in `scripts/render-web-clips.mjs`, and the
> pipeline around them is documented in the `feature-clip` skill.

The measurements below are kept as the record of how the trade was evaluated.

| set | webm | mp4 | poster | all files |
| --- | --- | --- | --- | --- |
| eight landing clips | 2,278,219 | 2,007,309 | 931,052 | **5,216,580 (4.98 MB)** |
| all ten, plus the two README loops | 3,124,714 | 2,829,741 | 1,166,081 | 7,120,536 (6.79 MB) |

The eight landing clips are every composition except `overview-engine` and `overview-readme`, which exist only as sources for the two README GIF loops and have no reason to appear on a page.

**The eight-clip web set is 4.98 MB, under the 5 MB target.** A single visitor fetches less than that, because a browser downloads the posters plus exactly one video format: 3.06 MB on a VP9 browser, 2.80 MB on Safari.

The ten-clip set is 6.79 MB and does not fit under 5 MB at these settings. If a surface ever needs all ten, the tight profile below fits.

For scale: the same footage is 53.6 MB as rendered MP4, and the overlapping GIFs are 14.2 MB for seven clips.

## Poster identity

The requirement is that the poster shows exactly what the player paints on its first decoded frame, so there's no flash when playback starts.

The poster is extracted from the encoded WebM, not from the source MP4. Extracting from the source would leave the poster a near miss against every encode. Extracting from the output makes it exact.

The script verifies this on every run, including `--verify-only`. It decodes frame zero of the WebM and the whole poster PNG to raw `rgb24`, the same pixel domain a browser paints in, and compares MD5s. All ten pass. A mismatch prints `POSTER MISMATCH` and exits 1.

By hand, for one clip:

```
ffmpeg -v error -i media/web/run-in-flight.webm -frames:v 1 -f rawvideo -pix_fmt rgb24 - | md5
ffmpeg -v error -i media/web/run-in-flight-poster.png -f rawvideo -pix_fmt rgb24 - | md5
# both: bcffde01205ae4695b246a256b1d0846
```

One honest caveat. A poster can only be exact against one of the two encodes, and VP9 is the one the majority of browsers play. Safari decodes the H.264 file, whose own frame zero is a different lossy approximation of the same picture. Measured against the poster, the H.264 opening frame lands at 37.1 to 42.8 dB PSNR, with a worst single-channel difference of 49 to 76 out of 255 concentrated on hard text edges. That's a soft settle on sharp glyph edges rather than a visible flash, and the script prints the worst figure after every run rather than hiding it.

The comparison is ffmpeg's YUV to RGB conversion. A browser's conversion is its own, so the identity claim is about the encoded picture, not about a guarantee that two different decoders agree bit for bit.

## Why these CRFs

Quality was measured with VMAF on `run-in-flight`, the longest and busiest clip at 36 seconds. Each candidate was scaled back up to the 1836x1164 source and compared against it, which is the fair comparison here: every candidate gets displayed at the same size on the page, so what matters is how it looks after the browser scales it, not how it looks against a downscaled reference.

| encode | bytes | VMAF |
| --- | --- | --- |
| 960w VP9 crf 38 | 1,022,359 | 83.47 |
| 960w VP9 crf 42 | 873,000 | 82.72 |
| 960w VP9 crf 46 (shipped) | 741,696 | 81.71 |
| 960w H.264 crf 28 | 895,318 | 85.14 |
| 960w H.264 crf 32 (shipped) | 664,567 | 80.16 |
| 960w H.264 crf 34 | 582,785 | 76.07 |
| 800w VP9 crf 52 | 515,214 | 74.27 |
| 800w H.264 crf 32 | 526,989 | 72.80 |

Two things fall out of that table.

**Width beats quantizer.** Every 800-wide candidate scores worse than every 960-wide one while saving less than a third of the bytes. Spending the budget on resolution is the right trade for footage that's mostly small UI text, so 960 is the default and dropping width is a lever of last resort.

**VP9 doesn't win on this content.** libvpx-vp9 is usually the smaller of the two at equal quality, and on these screen recordings it isn't: H.264 at crf 28 is both smaller and better than VP9 at crf 38. VP9's curve is also flat, gaining about 1.8 VMAF for 38% more bytes between crf 46 and crf 38, because the downscale is doing most of the damage and no quantizer setting undoes it. The WebM ships for format coverage and because at the chosen operating point it's still competitive, not because it's the better encoder here.

crf 46 and crf 32 were picked to land the two formats at roughly the same quality, 81.7 and 80.2, so the page looks the same in Safari as everywhere else. An earlier pass ran H.264 at crf 28, which made the Safari file both larger and visibly better than the WebM, which is a strange thing to ship.

## Levers tried and rejected

These come from an earlier sweep that ran at 24 fps and scored against a 960-wide lossless reference rather than the 30 fps source, so the absolute sizes and VMAF figures below don't line up with the table above. Each bullet is still an internally fair comparison.

- **`-tune-content screen` on libvpx-vp9.** It's advertised for exactly this kind of footage. On `run-in-flight` it produced a byte-identical file, 831,794 either way. No effect, so it isn't in the settings.
- **Two-pass VP9 as a size lever.** It isn't one. Two-pass with `-auto-alt-ref 6 -lag-in-frames 25` at crf 42 came out at 831,794 bytes against 830,654 for a single pass at the same crf, so the whole configuration bought nothing on size. Those two runs also differ in `-cpu-used` and alt-ref, so this isn't a clean isolation of the pass count on its own, and no measurement here separates what `-auto-alt-ref` contributes. Two-pass is in the shipped settings because it's the standard libvpx recommendation and costs only encode time, not because anything here shows it winning.
- **`-tune animation` on libx264.** Gained 0.62 VMAF for 4.2% more bytes. Close enough to a wash that the plain settings are preferable for being predictable.
- **24 fps.** Saves about 13% on VP9 (1,197,700 bytes at 30 fps against 1,044,663 at 24, crf 38) but introduces judder from the 30 to 24 resample. Not worth it.
- **Lossy posters.** Any quantization breaks the frame-zero identity that the whole poster requirement rests on, so the PNGs stay lossless. They're the incompressible floor of the budget at 1.11 MB for ten, and `-compression_level 100 -pred mixed` is the only free saving available, worth about 4%.

## Tight profile

If the budget ever has to cover all ten clips:

```
node scripts/render-web-clips.mjs --width=800 --vp9-crf=52 --h264-crf=32
```

That measures 5,184,119 bytes (4.94 MB) for all ten, so it fits, and it verifies poster identity the same way. The cost is real: 74.3 VMAF instead of 81.7 on the busiest clip, which is soft enough that small UI text starts to smear. Prefer trimming the clip list over trimming the width.
