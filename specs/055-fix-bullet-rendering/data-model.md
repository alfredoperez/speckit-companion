# Data Model: Fix Bullet Point Rendering

No new entities or data models required. This is a rendering bug fix affecting the markdown-to-HTML conversion pipeline.

## Affected State

### Renderer State Variables (`renderer.ts`)

| Variable | Type | Current | Change Needed |
|----------|------|---------|---------------|
| `inList` | boolean | Tracks if inside list | Must persist across code blocks |
| `listType` | `'ul' \| 'ol'` | Tracks list type | Must persist across code blocks |
| `listItemCount` | number | **Does not exist** | **NEW**: Track item count for `<ol start="N">` |
| `inCodeBlock` | boolean | Tracks code block state | No change |

### HTML Output Changes

**Current output** (broken):
```html
<ol>
  <li>Step 1</li>
</ol>
<pre class="code-block">...code...</pre>
<ol>
  <li>Step 2</li>  <!-- counter resets to 1 -->
</ol>
```

**Target output** (fixed):
```html
<ol>
  <li>Step 1</li>
</ol>
<pre class="code-block">...code...</pre>
<ol start="2">
  <li>Step 2</li>  <!-- continues from 2 -->
</ol>
```
