# Research

## Fence rule for the preprocessors
**Decision**: a line is a fence marker when its trimmed text starts with three backticks; the first toggles in, the next toggles out; an unclosed fence runs to the end.
**Rationale**: that is exactly the renderer's loop, so the two always agree. `preprocessLivingRequirements` also treats `~~~` as a fence, but the renderer does not, so widening would make the preprocessors skip text the renderer then renders as prose.
**Alternatives considered**: reuse the living-requirements loop (wider than the renderer); a shared change to both (out of scope, it would move living-mode output).

## How a pass skips fences
**Decision**: a helper splits the document into outside runs and fence runs, applies the pass to each outside run only, and rejoins with the original newlines. Fence lines are never passed in.
**Rationale**: the callout and comment passes are global multi-line regexes, so a per-line rewrite would change them. Running the same regex per outside run keeps behaviour for fence-free documents byte-identical, and `mapToSourceLines` still anchors on the untouched fence lines.
**Alternatives considered**: mask fence bodies with placeholders and restore (risks a placeholder colliding with text and shifts line counts).

## Which passes
**Decision**: wrap callouts, HTML comments, user stories and task phases, as asked. Requirements, entities, checklist, decisions and metadata are left alone.
**Rationale**: the request names the first four; widening changes living-mode and feature-spec output the request did not ask to move. Recorded as a follow-up gap.

## Info string parsing
**Decision**: `parseFenceInfo(info)` returns `{ language, title, options }`. Language is the first word, lowercased, through the existing strict name check. A quoted `title="..."` or `title=word` fills title. Other `key=value` and bare words fill options as a plain map and list.
**Rationale**: pure, no DOM, and the renderer keeps writing only the validated language into attributes.

## Registry and fallback
**Decision**: `BLOCK_FENCES` is a fixed set of names (`calls`, `states`, `screen`) with a `renderers` map that is empty. `renderBlockFence(name, body, info)` returns the HTML or `null` and catches throws, same shape as `safe()` in `livingComponents.ts`. A `null` falls through to the existing branches, so today's output is preserved. It runs before the tree check, beside mermaid.
**Rationale**: one place knows the names; the next steps only add a renderer.

## File at a line
**Decision**: the chip strips `:N` or `:N-M` before the extension test, keeps the clean path in `data-filename`, and sets `data-line` only for an integer from 1 to 9,999,999. The click handler adds `line` to the message when present.
**Decision**: on the host, a path with a directory is resolved against the project root, then the spec folder, each confined with `path.relative` and the exact rule `rel === '..' || startsWith('..' + sep) || isAbsolute`. A bare name keeps the `findFiles` lookup. The absolute-path branch gets the line too. `isPathWithinRoot` is not reused because it rejects `..config.yml`. After `showTextDocument` the editor selection and reveal are set when a line is given and the editor exists.
**Rationale**: matches `workspaceFolderOf`, which already has the correct rule.
**Alternatives considered**: keep `findFiles` and filter by suffix (can still pick a same-suffix file elsewhere, and does not confine).

## Gaps recorded
Spec documents opened through `speckit.viewSpecDocument` drop the line. The other passes still rewrite fenced text.
