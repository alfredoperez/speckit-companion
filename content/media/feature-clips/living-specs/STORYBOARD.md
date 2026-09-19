# living-specs

The demo clip for **Living Specs**: a work tree of durable, per-capability specs, and what happens when you click one.

## Why it exists

Every other composition in the set films a single feature run: the rail, the timing, the review pass. This one films the layer above a run, the specs that outlive it. It has to do two things a still cannot. First, show enough of the tree that it reads as somebody's repository rather than a two-row demo, because the mechanic underneath it only becomes visible with depth: a capability's spec has two legitimate homes, `capabilities/<name>/spec.md` when you name no path, and a path of your own when you want the spec sitting in the code. That is the resolver's `_location()` (`speckit-extension/scripts/resolve-spec-paths.py`), and `buildCapabilityTree` (`src/features/specs/livingSpecsModel.ts`) is what turns it into the directory tree the sidebar draws. Second, finish the gesture: click a row and land in the spec. The previous cut ended on a run overview, which left the viewer, the thing the click is for, as an implied next step. This one ends there.

## Source captures

Three real Storybook renders of the Living Specs stories, never an invented panel. All three are the full editor surface in one capture space (1564 x 992 CSS px at DPR 2), which is exactly the frame aspect, so rest is identity and one camera solves every beat. The tree is pixel-identical across all three except for the one row the list is acting on, which is what lets the pane beside it change under a dissolve without the tree appearing to move.

| Shot | File | State on screen |
|---|---|---|
| sh0 | `ls-tree.png` | The Living Specs work tree at rest, beside the feature run that just finished. Eight capabilities: three under a `capabilities` root, five colocated under `src` in `features`, `jobs` and `services`, plus an Orphans group. Coverage counts, drift flags, and one registered capability whose spec is not created yet. |
| sh1 | `ls-click.png` | The same frame with the pointer resting on the `photo-storage` row, drawn with the list's own hover wash. |
| sh2 | `ls-capability.png` | The photo-storage capability open in the viewer's living mode. LIVING badge, 9 requirements, 9 scenarios, 7/9 covered, drift, an Update action, the source globs it COVERS, and its resolved path `capabilities/photo-storage/spec.md`. The row it came from stays selected in the tree. |

## What is real in the sidebar

The Specs view is a native VS Code TreeView with no webview, so the sidebar in every capture is the documented recreation (`webview/src/spec-viewer/__stories__/sidebarTree.tsx`), measured against the DevTools snapshots in `docs/reference/sidebar-snapshots/`. This clip needed a deeper fixture and two row states, and each addition is a thing `livingSpecsExplorerProvider.ts` really renders:

- **Nested directory groups.** `buildCapabilityTree` groups a capability under the parent of the folder its spec lives in, then sorts groups and leaves together by name. `src` > `services` > `avatar-rendering` is what that function returns for a spec at `src/services/avatar-rendering/avatar-rendering.spec.md`; it is not a layout choice.
- **A registered capability with no spec yet.** `circle-outline` and a "not created" suffix, from `capabilityItem` when `cap.exists` is false.
- **The Orphans group.** `question` icon, appended after the tree, holding the `*.spec.md` files no capability claims.
- **Hover and selection.** `monaco-list-row:hover` takes list.hoverBackground; the clicked row keeps `monaco-list-row.selected`, and because opening the document moves focus to the editor it washes with list.inactiveSelectionBackground rather than the active blue. Both rules come off the snapshots and both variables are published by the capture theme.

A capability row is a leaf here because `capabilityItem` only gives it a twistie when a tier sibling exists, and nothing in the product generates `.arch.md` or `.coverage.md`.

## Beats

26.0 s at 30 fps, 1836 x 1164.

| t | Region | Label |
|---|---|---|
| 3 | Living Specs pane header and every row | What your assistant reads before it drafts |
| 6.2 | `capabilities` group, three rows | Where a spec lands when you don't name a path |
| 9.4 | `src` group, three nested folders, five rows | Name a path and it lives beside the code instead |
| 12.6 | the `photo-storage` row, pointer on it | A click opens it in the reader, not the raw file |
| 16 | the resolved path in the spec header | A stable address the next run will find again |
| 19.2 | the COVERS row of globs | Touch one of these files and this capability is in scope |
| 22.4 | the drift flag and the Update action | Hands the changed files to your assistant |
| 25.6 | rest | — |

Beats 2 and 3 are the pair that carries the first half: the same tree, the centralized root and the colocated one, filmed as one vertical camera move so the contrast is a move rather than a claim. Beats 4 and 5 are the gesture: the pointer lands, the pane changes, and the camera is already on the path that tells you what you opened.

The four sidebar beats sit hard against the left edge of the capture, so the clamp pins their camera at x = 0 instead of centring the tree. That is deliberate. The viewer pane stays half in frame while the tree is being read, so the click reads as a click inside the editor rather than a cutaway to a widget.

All three transitions dissolve. sh0 to sh1 at 10.55 s (0.30 s) lands as the camera arrives on the row, so the hover wash reads as the pointer settling rather than as a cut. sh1 to sh2 at 13.95 s (0.45 s) rides the move from the row into the spec header. sh2 back to sh0 at 23.55 s (0.90 s) runs under the pull back to rest, so the loop closes without a flash.

## Label accuracy

Every label was checked against the claim ledger's Living Specs rows before it was written, and against the rule that a label has to say something the pixels do not.

- Beat 1 does not say the specs stay current on their own. What is sourced is that a script resolves the changed files to capabilities and the assistant reads those specs while drafting, so the label is about reading, not about self-updating.
- Beats 2 and 3 are the resolver's two homes stated as the choice the registry actually offers: leave `spec:` out and you get `capabilities/<name>/spec.md`, name one and the spec sits where you put it.
- Beat 4 is what the provider's open command does: a `.md` tier opens through `speckit.viewSpecDocument` in living mode, which is the rendered reader, not the raw file.
- Beat 6 is the resolver's membership rule, which is what `--changed` reports: a file matching a capability's globs puts that capability in scope.
- Beat 7 is what the Update action does and no more. It reads the drifted files and hands your assistant a prompt naming the capability, its spec path and those files. Nothing rewrites the spec on its own, and no label says it does.
- No label makes a coverage-tier claim. The `7/9 covered` and `drift` text is on screen and left to speak for itself; the ledger's caveat is that a coverage count needs a `.coverage.md` sibling and is not a default.

## Not filmed

- **The fold back.** The previous cut ended on the finished run's Overview naming the capabilities it folded into. That is a real and ledger-safe beat, but it put a run summary after the payoff and made the spec look like a waypoint. It belongs in an Overview clip, not this one.
- **A colocated capability's own spec page.** The colocated case is filmed from the tree, where five capabilities sit under `src`. There is no capture of one of them open, so the clip never shows a resolved `src/...spec.md` in the header the way beat 5 shows the centralized path. Filming it needs one more story and one more living-spec fixture.
- **The Architecture and Coverage tiers.** The resolver recognizes `.arch.md` and `.coverage.md` siblings but nothing generates them, and this repo's own registered capabilities have none.

## Render

```
npm run render                 # in this directory
```

This clip is not promoted to a README GIF; its outputs are the web trio the site plays, produced by `node scripts/render-web-clips.mjs` and copied to the site by `node website/scripts/sync-media.mjs`.

- Frame zero is the full editor at rest with the work tree expanded, which is the pose a reader sees before the clip starts and the poster the site serves.
- Loop verified: frame zero and the final frame are the same rest pose on the same capture.
