# make-it-yours

The customization asset, and the landing page's Customize tab. It carries one message: you can define your own pipeline and run it. Promoted to `docs/screenshots/generated/make-it-yours.gif`.

## Why it exists

Customization is one of the two capabilities the product is loved for, and it had no asset. The other clips all annotate captured product surfaces; a workflow is defined in `settings.json`, so this one is typographic rather than a screen tour.

**Every key and value on screen is real**, taken from the contributed configuration in `package.json`, the built-in workflows in `src/features/workflows/workflowManager.ts`, and the run-record schema in `src/core/types/spec-context.schema.json`. Nothing here is invented:

- `speckit.customWorkflows` with its real shape: `name`, `displayName`, and a `steps` array of `{ name, command }`.
- `speckit.specify` and `speckit.implement`, the actual stock step commands. A leading slash is added at dispatch, which is why card 3 shows `/speckit.specify`.
- `"workflow"` as a top-level field of `.spec-context.json`, which is how the choice is recorded on the spec.
- SpecKit and SpecKit Companion as the two shipped workflows.

If any of those settings change shape, this composition is stale and must be re-authored, the same rule the screenshots follow.

## What it is careful not to say

The claim ledger governs every word here. No template claim, no suggestion of a visual workflow builder, and no wording that implies the extension executes anything: the honest verbs are "offers", "records", "resolves" and "dispatches", and the clip uses those. The built-in Companion description is not quoted, because it carries a blocked number.

## Art direction

From `speckit-extension/assets/HERO-PROMPT.md`: near-black ground, blue chrome, and exactly **one** yellow accent. Yellow means one thing here and only one thing: this value is yours, not shipped. So the workflow's own name, its own step, and its own command are yellow, and every stock value stays green.

The ground is plain, a single vertical lift into the near-black. The earlier version carried a blueprint grid and a radial blue glow behind the card; both were decoration standing in for hierarchy and both are gone. Type does the work now: eyebrow 22, title 62, code 30, caption 27.

## Beats

14.0 s at 30 fps, 1836 x 1164. Three states plus a lockup, tracked by a three-segment strip under the card.

| t | Beat |
|---|---|
| 0.0 | State 1, "Write your own pipeline": the `speckit.customWorkflows` entry, at rest |
| 3.2 | Push left to state 2, "Create Spec offers it"; the pip advances |
| 3.9 | The two shipped workflows list, then yours |
| 4.6 | The choice lands on the spec as `"workflow": "research-first"` |
| 6.7 | Push left to state 3, "Every step dispatches yours" |
| 7.3 | The rail resolves left to right, each step under the command it dispatches |
| 10.1 | Push out to the closing lockup |
| 12.6 | The lockup hands back to state 1 at rest, closing the loop |

A state change is a push, not a dissolve. The outgoing card keeps travelling 420 px after its alpha is already gone, and the incoming one is still moving when it lands, so only about two frames show both. Card backgrounds are opaque for the same reason.

## Render

```
npm run render                 # in this directory
```

Then the standard GIF recipe from `docs/visual-assets.md` (960 px, 14 fps, palettegen `stats_mode=diff` 128 colors, paletteuse `dither=none diff_mode=rectangle`, `gifsicle -O3 --lossy=30`): 807 KB, 189 frames. The flat dark ground and large type compress far better than a screen capture, so no step-down is needed.

- Loop verified: frame zero and the final frame are the same state-1 rest pose, PSNR 48.1 dB (quantization noise only), `loop forever` flag set.
- `hyperframes check`: 0 errors, 0 warnings, 110/110 text checks pass WCAG AA.
- The composition writes its timeline as explicit calls at literal times rather than a `BEATS` array, so `scripts/clip-storyboard.mjs` reports it as skipped and this table is read by people, not by the script.

## History

It used to run 24.0 s across three settings keys: `speckit.defaultWorkflow`, `speckit.customCommands` and `speckit.aiProvider`. That was a settings tour, it read as a list of switches rather than a capability, and it drifted for six seconds between each idea. This version is 14.0 s and tells one story instead: write the pipeline, it gets offered and recorded, every step then dispatches your command.
