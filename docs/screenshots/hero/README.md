# README hero

The README hero (`../hero.jpg`) is **AI-generated** from three real screenshots,
composed in the brand art-direction style (`apps/presentations/ART-DIRECTION.md`
in the alfredo-perez.dev repo). See **`PROMPT.md`** for the image-edit prompt.

## Inputs (the three key screenshots)

These are the same shots used in the README body — capture once, use for both.
Capture in **Dark Modern** (per `../CAPTURE.md`) so there's no purple. They live
in `../` (the `docs/screenshots/` folder):

1. `../viewer.png` — VS Code sidebar + spec viewer, **Plan** phase with a diagram
   (`_01_demo-planned`).
2. `../comments.png` — the inline review-comment composer mid-use.
3. `../activity.png` — the Activity panel (Phases timeline + cards)
   (`_02_demo-tasked`).

## Build

Feed the three screenshots + `PROMPT.md` to an image-edit model (Gemini image
edit / "nano banana", GPT image, etc.). Save the result to `../hero.jpg` at
~2000×989, optimized to ~300–400KB. The video (`../demo.gif` / `../demo.mp4`) is
then seeded from this hero — see `../VIDEO-PROMPT.md`.

## Tokens (from ART-DIRECTION.md — no purple)

| Role | Hex |
|------|-----|
| Background | `#0F0F13` |
| Grid / hairlines | `#2A2A3A` |
| Accent (blue) | `#60A5FA` |
| Deep blue | `#3B82F6` |
| Highlight (yellow) | `#FACC15` |
| Ink | `#E8E8F0` |
