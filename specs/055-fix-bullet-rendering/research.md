# Research: Fix Bullet Point Rendering

## Decision 1: Root Cause of Counter Reset

**Decision**: The ordered list counter resets because the renderer closes `<ol>` when it encounters a fenced code block fence line (`` ` `` `` ` `` `` ` ``), then opens a new `<ol>` for subsequent items. Each new `<ol>` starts counting from 1.

**Rationale**: In `renderer.ts`, code block detection (line 138) runs before list closure (line 184). When the renderer hits a `` ` `` `` ` `` `` ` `` line while inside a list:
1. Code block toggle fires → `continue` (skips list-close check)
2. Code content lines are accumulated → `continue`
3. Closing `` ` `` `` ` `` `` ` `` fires → code block HTML emitted → `continue`
4. Next line (empty or list item) → list-close check fires → `</ol>` emitted
5. Next numbered item → new `<ol>` opened → counter starts at 1

**Fix approach**: When inside a list and a code block is encountered, keep the list open. Emit the code block HTML inside the `<li>` or track the list counter to use `<ol start="N">` when reopening.

**Alternatives considered**:
- CSS `counter-reset`/`counter-increment` to override browser default: fragile, doesn't fix the semantic issue of multiple `<ol>` elements
- Using `start` attribute on new `<ol>`: simpler but still produces broken HTML structure
- Keep list open across code blocks: best approach — renders code inside the list context

## Decision 2: Root Cause of Code Blocks Not Rendering as Code

**Decision**: Code blocks between list items are rendered as separate block elements outside the list. The HTML structure becomes `<ol>..items..</ol><pre>code</pre><ol>..items..</ol>` instead of keeping code within list flow.

**Rationale**: The code block rendering (lines 138-162) always appends to the top-level `html` variable with no awareness of list context. The emitted `<pre>` block appears between two separate `<ol>` elements.

**Fix approach**: Track list context during code block rendering. When a code block starts while `inList` is true, close the current `<li>`, emit the code block, and reopen for the next item while preserving the list counter with `<ol start="N">`.

**Alternatives considered**:
- Render code blocks inside `<li>`: valid HTML but may complicate the line-action wrapping
- Best approach: close and reopen the list with `start` attribute to maintain counter

## Decision 3: Root Cause of Excessive List Spacing

**Decision**: The CSS applies `margin: 0 0 var(--space-4) 0` to all `ul`/`ol` elements. When lists are repeatedly opened/closed (due to code blocks), each list fragment gets its own bottom margin, creating excessive spacing.

**Rationale**: `--space-4` is typically 16-24px. Multiple list fragments each contribute this margin, compounding the visual gap. Additionally, `padding-left: 28px` is slightly generous.

**Fix approach**: Fixing the counter reset (keeping lists open or using `start`) will naturally reduce spacing since fewer list elements are created. Minor CSS adjustments may help for remaining spacing.

**Alternatives considered**:
- Just reduce CSS margins: treats symptom not cause
- Remove margins entirely: would break spacing for normal single-list cases
