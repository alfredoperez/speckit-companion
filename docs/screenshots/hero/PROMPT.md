# Hero compositing prompt (image-edit)

The README hero is a **composite of three real screenshots**, assembled in the
brand art-direction style (`apps/presentations/ART-DIRECTION.md`). Capture the
three shots first, then feed them **plus the prompt below** into an image-edit
model that accepts input images (Gemini image edit / "nano banana", GPT image,
etc.).

## The three input screenshots

Capture all three in **Dark Modern** (per `../CAPTURE.md`) so there's no purple —
the art direction bans it, and the old hero's purple came from the old theme.

1. **`viewer.png`** — VS Code **sidebar + spec viewer together**, on a spec's
   **Plan** phase showing an architecture/diagram (the "something cool" product
   shot). Drive it from `specs/_01_demo-planned`.
2. **`comments.png`** — the **inline review-comment composer** mid-use (a comment
   being added on a spec line).
3. **`activity.png`** — the **Activity panel** (Phases timeline + Approach /
   Tasks / Review-comments cards). Drive it from `specs/_02_demo-tasked`.

## The prompt

> **Compose the THREE attached screenshots into one wide hero banner (2:1, ~2000×989) for a developer tool called SpecKit Companion.**
>
> Inputs: (1) a VS Code sidebar + spec-viewer workspace showing a spec's Plan phase with an architecture diagram; (2) an inline review-comment card being added on a spec line; (3) an Activity panel with a phases timeline and cards.
>
> **Layout & style:**
> - Near-black background **#0F0F13** with a faint blueprint grid of thin **#2A2A3A** lines.
> - Arrange the three screenshots as overlapping, slightly **isometric slabs** (gentle 2:1 tilt), exploded apart with depth: the **workspace** shot as the large slab center/back, the **comment card** floating in front lower-right, the **Activity panel** floating upper-right. Keep each screenshot **sharp, legible, and unaltered — do not redraw or invent UI text.**
> - Give each slab rounded corners (~14px), a 1px cool edge with a soft **blue glow (#60A5FA)**, and a subtle drop shadow so they read as floating layers.
> - Add thin **hairline connectors and small dimension ticks** around the slabs (architectural blueprint aesthetic). Place a single small **yellow #FACC15** highlight accent on one frontmost slab only.
> - Restrained palette: blues **#60A5FA** and **#3B82F6** plus the one yellow accent. **Absolutely no purple or violet anywhere.**
> - Cluster the slabs on the **RIGHT ~60%**, leaving generous empty **negative space on the LEFT for a title.**
> - Mood: editorial-technical, precise, calm, premium. No glossy 3D render, no photorealism, no neon overload, no extra invented text or logos.
>
> Output: wide 2:1 banner.

## Title

Image models often garble small text, so either reserve the left for the title
(the prompt already does) and overlay it afterward in any editor, or append this
to the prompt and verify it rendered cleanly:

> *On the left negative space, set the title "SpecKit Companion" in a clean
> geometric sans, with "Companion" in a sketchy hand-drawn marker highlighted in
> yellow #FACC15; a subtitle below it, and a row of pill chips Specify → Plan →
> Tasks → Done — off-white #E8E8F0, blue pills, the last pill yellow #FACC15.*

## Output

Save the final to `../hero.jpg` at ~2000×989. Optimize to ~300–400KB.
