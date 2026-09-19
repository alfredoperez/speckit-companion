# Hero image — generation reference

`hero.jpg` was generated end-to-end (text and all) with **Higgsfield GPT Image 2**
(`higgsfield generate create gpt_image_2 --aspect_ratio 16:9 --resolution 2k`),
then resized to 1600px wide and saved as JPG (~260KB). To regenerate, reuse the
prompt below and re-compress (`sips --resampleWidth 1600 … && sips -s format jpeg -s formatOptions 86 …`).

Brand art direction it follows: dark `#0F0F13`, blueprint grid, blue glow
`#60A5FA`/`#3B82F6`, one yellow accent `#FACC15`, **no purple** — and the
`SpecKit` / `Companion` (yellow marker) wordmark + `Specify → Plan → Tasks → Done`
pills, mirroring the VS Code hero (`docs/screenshots/hero/PROMPT.md`).

## Prompt

> Wide developer-tool README hero banner, near-black #0F0F13 background with a faint blueprint grid of thin #2A2A3A lines. LEFT HALF (title area): a small clean green seedling sprout icon (two leaves on a stem in a little soil mound, no purple), then a large bold geometric sans-serif title on two lines reading exactly 'SpecKit' on the first line in off-white #E8E8F0 and 'Companion' on the second line in dark text sitting on a hand-drawn yellow #FACC15 marker highlight rectangle. Below the title, a single row of four small pill-shaped buttons reading exactly, left to right: 'Specify', 'Plan', 'Tasks', 'Done' — the first three are blue outlined pills with off-white text, the last 'Done' pill is a solid yellow #FACC15 pill with dark text; small arrow separators between the pills. RIGHT HALF: an isometric arrangement of four small rounded slab-nodes connected left to right by a glowing blue #60A5FA pipeline line, the last node flowing down into a horizontal ledger strip of stacked rows that connects to a small dashboard panel showing tiny abstract bar and line charts; rounded corners, soft blue glow, subtle drop shadows, thin hairline connectors and dimension ticks (blueprint aesthetic), one small yellow accent. Restrained palette: blues #60A5FA and #3B82F6 plus yellow #FACC15. ABSOLUTELY NO PURPLE OR VIOLET. All text must be crisp, legible, correctly spelled, clean modern sans-serif. Editorial-technical, precise, premium, high contrast.
