# Plan: Update Extension Docs & Marketplace Images

**Spec**: [spec.md](./spec.md) | **Date**: 2026-03-20

## Approach

Rewrite `README.md` top-to-bottom following the AI Toolkit pattern: hero image → value prop → visual Features section → quick Getting Started → detailed Configuration. Content is sourced from the blog article and updated to reflect current features (`actionOnly`, `specDirectories`). New screenshots need to be captured manually and placed in `docs/screenshots/` — the plan assumes placeholder paths that get filled in during implementation.

## Files

### Create

| File | Purpose |
|------|---------|
| `docs/screenshots/hero.png` | Hero screenshot — sidebar + workflow editor side by side (manual capture) |
| `docs/screenshots/create-spec.png` | Create New Spec dialog with description + image attachment (manual capture) |
| `docs/screenshots/inline-comments.png` | Spec viewer with inline review comments (manual capture) |
| `docs/screenshots/sidebar-overview.png` | Full sidebar showing Specs, Steering, Agents, Skills, Hooks sections (manual capture) |

### Modify

| File | Change |
|------|--------|
| `README.md` | Full rewrite — new structure: badges → hero image → value prop → Features (with screenshots per feature) → Getting Started (3 steps) → AI Provider table → Custom Workflows (updated API) → Custom Commands → Configuration → Development. Remove stale `includeRelatedDocs` refs, update step properties table, add `specDirectories` setting, add `actionOnly` flag. |
| `docs/screenshots/specify-spec.png` | Replace with current UI screenshot (manual capture) |
| `docs/screenshots/specify-plan.png` | Replace with current UI screenshot (manual capture) |
| `docs/screenshots/specify-tasks.png` | Replace with current UI screenshot (manual capture) |
| `docs/screenshots/other-views.png` | Replace with current UI screenshot showing all sidebar sections (manual capture) |

## README Structure (target)

```
# SpecKit Companion
[badges]

[2-3 sentence value prop from blog article]

![hero](docs/screenshots/hero.png)

## Features

### Visual Workflow Editor
[1-2 sentences + screenshot]

### Inline Review Comments
[1-2 sentences + screenshot]

### Spec-Driven Phases
[Specify → Plan → Tasks → Done with screenshots]

### Sidebar at a Glance
[Specs, Steering, Agents, Skills, Hooks + screenshot]

### Custom Workflows & Commands
[Teaser + link to configuration section below]

## Getting Started
[3 steps: install → open sidebar → create spec]

## Supported AI Providers
[Feature comparison table — keep existing but update]

## Configuration

### Custom Workflows
[Updated examples with actionOnly, specDirectories, current step properties]

### Custom Commands
[Keep existing, minor updates]

### Settings
[specDirectories, aiProvider, etc.]

## Development
[Keep existing setup/build instructions]

## Acknowledgments + License
```

## Risks

- **Screenshots require manual capture**: Can't automate VS Code extension screenshots. Mitigation: write README with image placeholders first, capture screenshots as a separate task, then update paths.
