# Research: Edit Input Auto-Sizing with Original Value Display

**Feature**: 002-edit-input-sizing
**Date**: 2025-12-30
**Status**: Complete

## Research Questions

### RQ-1: How to implement auto-sizing text inputs in web/webview?

**Decision**: Use the "hidden span" technique with `contenteditable` fallback

**Rationale**:
- The hidden span technique is the most reliable cross-browser method for auto-sizing
- Create a hidden `<span>` element with identical styling, measure its width, apply to input
- Alternative: use `<span contenteditable="true">` for true content-driven sizing
- CSS `field-sizing: content` is emerging but has limited browser support (Chrome 123+)
- For VS Code webview, we have Chromium guarantees, so `field-sizing: content` could work

**Alternatives Considered**:
| Approach | Pros | Cons |
|----------|------|------|
| Hidden span measurement | Universal browser support, precise control | Requires DOM manipulation, slight complexity |
| `contenteditable` span | Native auto-sizing, simple HTML | Loses input semantics, accessibility concerns |
| CSS `field-sizing: content` | Zero JS, cleanest solution | Only Chrome 123+, may not work in older VS Code |
| Character count estimation | Simple calculation | Inaccurate with variable-width fonts |
| `<textarea>` with auto-grow | Works for multi-line | Overkill for single-line inputs |

**Final Recommendation**: Use CSS `field-sizing: content` as primary (VS Code uses Chromium), with hidden span fallback for robustness.

---

### RQ-2: How to display original value alongside editable input?

**Decision**: Display original value above the input with distinct "reference" styling

**Rationale**:
- Positioning original above input maintains vertical reading flow
- Original value should be visually distinct: muted color, smaller font, optional label
- Consider using a "diff-like" indicator for changed content
- Original value is read-only reference, not interactive

**Layout Options Evaluated**:
| Layout | Pros | Cons |
|--------|------|------|
| Above input (stacked) | Clear hierarchy, natural reading order | Takes vertical space |
| Below input | Input prominent | Original hidden below fold on small screens |
| Side by side | Compact, easy comparison | Horizontal space limited in popovers |
| Tooltip on hover | Minimal UI impact | Requires hover, not always visible |

**Final Recommendation**: Stacked layout with original above input. Use semantic HTML structure and clear visual hierarchy.

---

### RQ-3: Best practices for performant input resizing during typing?

**Decision**: Use CSS-based solution primarily, with debounced JS fallback if needed

**Rationale**:
- CSS `field-sizing: content` requires no JS and is inherently performant
- If JS is needed, resize on `input` event (fires synchronously with each keystroke)
- Avoid layout thrashing by reading dimensions once, writing once
- Use `requestAnimationFrame` only if visual jitter occurs
- 50ms target (SC-004) is easily achievable with either approach

**Performance Techniques**:
1. **CSS-only**: `field-sizing: content` eliminates JS entirely
2. **Hidden span**: Cache span element, only update `textContent` and read `offsetWidth`
3. **Debouncing**: NOT recommended for input sizing (causes lag); use throttling if needed
4. **RAF batching**: Only if multiple inputs resize simultaneously

---

### RQ-4: Accessibility considerations for original value display?

**Decision**: Use `aria-describedby` to associate original value with input

**Rationale**:
- Screen readers need to announce the original value for context
- Use `aria-describedby` pointing to the original value element
- Original value element should have appropriate `role` or semantic markup
- Ensure color contrast meets WCAG 2.1 AA (4.5:1 for text)

**Accessibility Requirements**:
- Original value must be programmatically associated with input
- Visual distinction must not rely solely on color
- Focus management when popover opens/closes
- Escape key to cancel (already implemented)

---

### RQ-5: Existing patterns in the codebase to follow?

**Decision**: Extend the existing `refinePopover.ts` pattern

**Rationale**:
- Current popover implementation provides a working foundation
- Uses functional approach with module-level state (`activeRefinePopover`)
- CSS variables for theming already established
- Event delegation pattern for button actions

**Existing Patterns to Maintain**:
1. **Popover structure**: Header, input, actions (Cancel/Submit)
2. **State management**: Module-level variable for active instance
3. **Event handling**: Keyboard (Enter/Escape) + click events
4. **Positioning**: Fixed position relative to trigger button
5. **Cleanup**: Remove on outside click, Escape, or submit

---

## Summary of Decisions

| Area | Decision |
|------|----------|
| Auto-sizing technique | CSS `field-sizing: content` with hidden span fallback |
| Original value position | Above input, stacked layout |
| Visual distinction | Muted color (--text-muted), smaller font, italic optional |
| Performance approach | CSS-first, no debouncing |
| Accessibility | `aria-describedby` for original value association |
| Code pattern | Extend existing `refinePopover.ts` structure |

## Implementation Implications

### CSS Changes (`workflow.css`)
- Add `field-sizing: content` to input styles
- Add `.original-value-reference` styles (muted, small, italic)
- Add `.edit-input-container` for layout structure
- Set min/max width constraints for input

### TypeScript Changes (`refinePopover.ts` or new file)
- Update popover HTML template to include original value display
- Pass `lineContent` through to display as original reference
- Hidden span fallback implementation if needed

### No Backend/Extension Changes Required
- This is purely a webview UI enhancement
- No new message types needed
- No changes to action handlers
