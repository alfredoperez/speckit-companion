# Quickstart: Fix Bullet Point Rendering

## Files to Modify

1. **`webview/src/spec-viewer/markdown/renderer.ts`** — Main changes
   - Track `listItemCount` to preserve ordered list numbering across interruptions
   - When code block/table/empty line closes a list, remember the count and list type
   - When reopening the same list type, use `<ol start="N">` to continue numbering
   - Handle the case where code blocks appear between list items

2. **`webview/styles/spec-viewer/_typography.css`** — Minor CSS cleanup (if needed)
   - Verify list spacing after renderer fix reduces fragment count

## Implementation Strategy

### Approach: Track and Resume List Counter

Add state tracking so that when a list is interrupted by a code block, the renderer remembers:
- The list type (`ul` or `ol`)
- The item count so far

When the next list item of the same type appears after an interruption, use `<ol start="N">` to continue numbering.

### Key Code Changes in `renderer.ts`

1. Add `listItemCount` variable (initialized to 0)
2. Add `lastListType` variable to remember type after list close
3. Increment `listItemCount` on each `<li>` within an ordered list
4. On list close: save `listItemCount` and `listType` to `lastListType`/`lastListCount`
5. On list open: if same type as `lastListType` and code block just closed, use `start` attribute
6. Reset saved state on heading, horizontal rule, or other block-level content

### Testing

```bash
npm run compile && npm test
```

Open a spec with numbered steps containing code blocks. Verify:
- Numbers continue (1, 2, 3) across code blocks
- Code blocks render with syntax highlighting
- List spacing is compact
