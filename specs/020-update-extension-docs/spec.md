# Spec: Update Extension Docs & Marketplace Images

**Branch**: 020-update-extension-docs | **Date**: 2026-03-20

## Summary

Overhaul the README and marketplace listing to match the content and structure from the blog article "What is SpecKit Companion?" and adopt patterns from Microsoft's AI Toolkit extension. The current README is outdated (references `includeRelatedDocs`, old screenshots, missing new features like configurable spec directories and `actionOnly` steps). The goal is a polished, scannable README that works both on GitHub and in the VS Code marketplace Features tab.

## Requirements

- **R001** (MUST): Restructure README to lead with a visual hook + 2-3 sentence value prop, followed by a Features section with screenshots, then Getting Started, then detailed configuration
- **R002** (MUST): Update all screenshots to reflect the current UI (sidebar, workflow editor phases, create spec dialog, inline comments)
- **R003** (MUST): Add a "Features" section using the VS Code marketplace `Features` pattern — each feature gets a heading, 1-2 sentence description, and a screenshot/GIF
- **R004** (MUST): Update Custom Workflows section to reflect current API (`actionOnly` replaces `includeRelatedDocs`, new `specDirectories` setting, current step properties)
- **R005** (SHOULD): Add content from blog article: origin story (Kiro inspiration), sidebar overview (Specs, Steering, Agents, Skills, Hooks), workflow editor phases with screenshots
- **R006** (SHOULD): Adopt AI Toolkit patterns — progressive disclosure (quick 3-step getting started before deep docs), feature comparison table for AI providers, dual-path presentation
- **R007** (SHOULD): Structure content so it renders well in VS Code marketplace Features tab (which renders README markdown with images)
- **R008** (SHOULD): Remove or update stale content — old `includeRelatedDocs` references, outdated command list, obsolete workspace structure examples

## Scenarios

### First-time visitor on GitHub/Marketplace

**When** a developer finds SpecKit Companion on the marketplace or GitHub
**Then** they see a hero screenshot, understand the value prop in <10 seconds, and can scan features visually before deciding to install

### Existing user checking custom workflows

**When** a user looks up custom workflow configuration in the README
**Then** they find accurate, up-to-date examples using `actionOnly`, `specDirectories`, and current step properties (no stale `includeRelatedDocs` references)

### VS Code marketplace Features tab

**When** a user views the extension in VS Code's Extensions panel
**Then** the Features section renders cleanly with images inline, not as a wall of text

## Out of Scope

- Blog article content management (that lives in the Obsidian vault)
- Video/animated GIF creation (screenshots only for now, GIFs can be added later)
- Changelog updates (handled separately at release time)
- Translations or i18n
