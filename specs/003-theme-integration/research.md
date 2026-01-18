# Research: VS Code Theme Integration

**Feature**: VS Code Theme Integration and Readability Improvements
**Date**: 2026-01-01
**Status**: Complete

## Overview

This research document consolidates findings on VS Code webview CSS theming to support the implementation of theme-aware styling in the workflow editor.

---

## Decision 1: CSS Variable Naming Convention

**Decision**: Use VS Code CSS custom properties with `--vscode-` prefix

**Rationale**: VS Code injects theme color variables into webview HTML elements automatically. The naming convention transforms API names (e.g., `editor.foreground`) to CSS variables (e.g., `--vscode-editor-foreground`). This is the standard, documented approach.

**Alternatives Considered**:
- Custom theme selector within extension → Rejected: Violates constitution principle of using VS Code's native systems
- JavaScript-based color injection → Rejected: Unnecessary complexity; CSS variables update automatically on theme change

---

## Decision 2: Theme Detection Strategy

**Decision**: Use body class selectors (`vscode-light`, `vscode-dark`, `vscode-high-contrast`) for theme-specific overrides only when necessary

**Rationale**: VS Code adds these classes to the webview body element automatically:
- `body.vscode-light` — Light themes
- `body.vscode-dark` — Dark themes
- `body.vscode-high-contrast` — High contrast accessibility themes

Most styling can use theme-agnostic variables. Theme-specific classes are only needed for cases where light/dark behavior must differ beyond what variables provide.

**Alternatives Considered**:
- `data-vscode-theme-id` attribute for specific theme targeting → Rejected: Too granular; would require maintenance for popular themes
- JavaScript theme change observers → Rejected: CSS variables update automatically

---

## Decision 3: Core Theme Variables to Use

**Decision**: Map current hardcoded colors to these VS Code theme variables

### Background Colors
| Current Hardcoded | VS Code Variable | Purpose |
|-------------------|------------------|---------|
| `#0a0a0a` (--bg-primary) | `--vscode-editor-background` | Main content background |
| `#141414` (--bg-secondary) | `--vscode-sideBar-background` | Secondary panels, tabs |
| `#1a1a1a` (--bg-elevated) | `--vscode-editorWidget-background` | Popovers, modals |
| `#1f1f1f` (--bg-hover) | `--vscode-list-hoverBackground` | Interactive hover states |

### Text Colors
| Current Hardcoded | VS Code Variable | Purpose |
|-------------------|------------------|---------|
| `#fafafa` (--text-primary) | `--vscode-editor-foreground` | Primary text |
| `#a1a1a1` (--text-secondary) | `--vscode-descriptionForeground` | Secondary text |
| `#666666` (--text-muted) | `--vscode-disabledForeground` | Muted/disabled text |

### Accent Colors
| Current Hardcoded | VS Code Variable | Purpose |
|-------------------|------------------|---------|
| `#3b82f6` (--accent) | `--vscode-focusBorder` or `--vscode-button-background` | Primary accent |
| `#60a5fa` (--accent-hover) | `--vscode-button-hoverBackground` | Accent hover |
| `#22c55e` (--success) | `--vscode-testing-iconPassed` | Success states |
| `#f59e0b` (--warning) | `--vscode-editorWarning-foreground` | Warning states |
| `#ef4444` (--error) | `--vscode-editorError-foreground` | Error states |

### Border Colors
| Current Hardcoded | VS Code Variable | Purpose |
|-------------------|------------------|---------|
| `#262626` (--border) | `--vscode-panel-border` | Standard borders |
| `#404040` (--border-hover) | `--vscode-contrastBorder` | Emphasized borders |

### Typography
| Current Hardcoded | VS Code Variable | Purpose |
|-------------------|------------------|---------|
| System font stack | `--vscode-font-family` | UI font family |
| Monospace stack | `--vscode-editor-font-family` | Code/monospace font |
| `14px` | `--vscode-editor-font-size` | Base font size |

---

## Decision 4: Fallback Strategy

**Decision**: Always provide fallback values for undefined theme variables

**Rationale**: Not all themes define all color tokens. Fallbacks ensure the UI remains functional with minimal themes.

**Implementation Pattern**:
```css
:root {
    --bg-primary: var(--vscode-editor-background, #1e1e1e);
    --text-primary: var(--vscode-editor-foreground, #d4d4d4);
}
```

The fallback values should be sensible defaults that work for both light and dark contexts, or theme-specific fallbacks can be provided:

```css
body.vscode-light {
    --bg-primary: var(--vscode-editor-background, #ffffff);
}
body.vscode-dark {
    --bg-primary: var(--vscode-editor-background, #1e1e1e);
}
```

---

## Decision 5: Header Semantic Colors

**Decision**: Use theme-aware accent colors for semantic header hierarchy

**Rationale**: Current implementation uses hardcoded colors:
- Document title: `#22D3EE` (cyan)
- Section headers: `#A78BFA` (purple)

These should map to VS Code semantic colors:
- Document title: `--vscode-textLink-foreground` (typically blue in most themes)
- Section headers: `--vscode-symbolIcon-classForeground` or `--vscode-editorInfo-foreground`
- User story headers: `--vscode-textLink-activeForeground`

**Alternatives Considered**:
- Keep distinct colors per header type → Need to find theme variables that maintain distinction
- Use single accent color → Rejected: Loses visual hierarchy

---

## Decision 6: Empty Line Handling

**Decision**: Empty lines should have no hover effects or backgrounds

**Rationale**: FR-010 requires "Empty/blank lines MUST NOT have hover effects, background highlights, or interactive styling."

**Implementation**:
```css
.line.empty {
    pointer-events: none;
}
.line.empty:hover {
    background: transparent;
}
```

---

## Decision 7: Header Margin Reduction

**Decision**: Reduce header margins by ~40% to improve content density

**Rationale**: SC-006 requires "Header spacing reduced so that a typical spec document fits in 30% less vertical space while maintaining readability."

**Current vs Proposed**:
| Element | Current Margin | Proposed Margin |
|---------|---------------|-----------------|
| `.doc-title` | `0 0 24px 0` | `0 0 16px 0` |
| `.section-header` | `32px 0 16px 0` | `20px 0 10px 0` |
| `.subsection-header` | inherited | `16px 0 8px 0` |

---

## Implementation Notes

### Files to Modify
- `webview/styles/workflow.css` - Primary file (~970 lines)

### Files for Reference
- `webview/styles/spec-markdown.css` - Already uses VS Code variables correctly

### Testing Approach
1. Test with VS Code default themes: Dark+, Light+, High Contrast
2. Test with popular themes: One Dark Pro, Dracula, Monokai, Solarized
3. Verify theme switching works without refresh
4. Verify accessibility with high contrast themes

---

## Sources

- [VS Code Webview API - Theming](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code Theme Color Reference](https://code.visualstudio.com/api/references/theme-color)
- [Code-driven approach to theme VS Code webviews](https://www.eliostruyf.com/code-driven-approach-theme-vscode-webview/)
- [VS Code Docs GitHub Issue #2060](https://github.com/microsoft/vscode-docs/issues/2060)
