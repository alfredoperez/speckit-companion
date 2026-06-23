# SpecKit Companion — Product

**Register**: product (design serves the tool — this is app UI inside VS Code, not a marketing surface).

## What it is

A VS Code extension that gives AI-assisted, spec-driven development a visual home: a webview that renders specs (spec / plan / tasks) and their artifacts (research, data-model, quickstart, contracts, checklists), tracks lifecycle state from `.spec-context.json`, and dispatches the spec-kit / SDD pipeline.

## Who uses it

Developers running spec-driven workflows with an AI CLI, inside VS Code, while they code. The audience is technical, lives in a terminal-and-editor world, and values speed, density, and trust over decoration.

## Where it lives — the key constraint

Everything renders inside a VS Code WebviewPanel and **must adapt to the user's editor theme** via VS Code CSS variables (`webview/styles/tokens.css`). The viewer should feel native to VS Code — never a foreign island. Any visual direction has to keep theme-adaptivity (light / dark / high-contrast) and not fight the host chrome.

## Design philosophy

- **Earned familiarity** — the tool disappears into the task. Density and consistency over surprise.
- **Trust** — the viewer must accurately reflect captured state; visual drift undermines it.
- **Theme-native first, personality second** — character lives in accents and interactions, not in repainting the whole surface.

## Current direction (exploring)

Giving the UI a more modern, **terminal-native / techy** character: squared corners, sharp borders, monospace accents on interactive elements, crisp hover motion (a color-flip), and optional viewfinder / corner-bracket framing on key affordances. Measured — bold on buttons and key moments, restrained everywhere theme-adaptivity matters. **Not** full neo-brutalism (no drenched single-color surfaces; the accent carries the energy, and the accent is the theme's, not a fixed yellow). See `DESIGN.md`.
