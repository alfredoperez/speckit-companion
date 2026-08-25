# make-it-yours

The customization asset: swap the workflow, shape your commands, pick your provider. Promoted to `docs/screenshots/generated/make-it-yours.gif`.

## Why it exists

Customization is one of the two capabilities the product is loved for, and it had no asset. The other clips all annotate captured product surfaces; customization lives in `settings.json`, so this one is typographic rather than a screen tour.

**Every key and value on screen is real** — taken from the contributed configuration in `package.json`, not invented:

- `speckit.defaultWorkflow` with its actual enum (`speckit`, `companion`).
- `speckit.customCommands` in both accepted forms: a bare string (`"review"`) and the object form (`{ name, title }`).
- `speckit.aiProvider` cycling real enum values (`claude`, `gemini`, `codex`, `copilot`).

If any of those settings change shape, this composition is stale and must be re-authored, the same rule the screenshots follow.

## Art direction

From `speckit-extension/assets/HERO-PROMPT.md`: near-black `#0F0F13`, faint blueprint grid, blue glow, and exactly **one** yellow accent — here the yellow is reserved for the value the viewer just changed, so the eye lands on the edit. No purple.

## Beats

24.0 s at 30 fps, 1836 x 1164.

| t | Beat |
|---|---|
| 0.0 | Card 1, "Swap the workflow", at the stock value |
| 2.6 | The default swaps to `"companion"` (yellow) |
| 6.6 | Card 1 dissolves to card 2, "Shape your commands" |
| 8.2 | First custom command appears |
| 9.1 | Second custom command appears |
| 13.2 | Card 2 dissolves to card 3, "Pick your provider" |
| 15.1 | The provider enum cycles: claude, gemini, codex |
| 17.2 | Settles on `"copilot"` (yellow) |
| 19.6 | Closing lockup |
| 22.9 | Lockup hands back to card 1 at rest, closing the loop |

## Render

```
npm run render                 # in this directory
```

Then the standard GIF recipe from `docs/visual-assets.md` (960 px, 14 fps, palettegen `stats_mode=diff` 128 colors, paletteuse `dither=none diff_mode=rectangle`, `gifsicle -O3 --lossy=30`): 941 KB. The flat dark ground and large type compress far better than a screen capture, so no step-down is needed.

- Loop verified: frame zero and the final frame are the same card-1 rest pose, PSNR 49.4 dB (quantization noise only), `loop forever` flag set.
- `hyperframes check`: 0 errors, 0 warnings, 48/48 text checks pass WCAG AA.
