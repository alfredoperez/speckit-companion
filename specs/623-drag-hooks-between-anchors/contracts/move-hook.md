# Contract: Move a hook

The spec has no Verbatim Constraints section. Identifiers below are taken from `plan.md` and `research.md`, and from the existing `addHook` / `removeHook` / `writeHook` contracts they sit beside. A move has four surfaces: the config writer CLI, the panel message, the drag payload, and the board/form UI.

## 1. Config writer CLI (`apps/speckit-extension/scripts/config_write.py`)

```text
python3 config_write.py --project ROOT --command STEP \
  --move-from WHEN ANCHOR INDEX \
  --when WHEN --anchor ANCHOR \
  [--to-index N] \
  [--boundary node|phase] \
  [--hook TYPE --ref REF --run RUN --text TEXT]
```

| Argument | Meaning |
|---|---|
| `--move-from WHEN ANCHOR INDEX` | The hook's current address: `before`/`after`, the node or phase it attaches to, its index among that anchor's entries. `nargs=3`. |
| `--when`, `--anchor` | The target side and anchor (existing arguments, reused). |
| `--to-index N` | The final index at the target, counted after the entry is removed from its old place. Absent means the end. |
| `--boundary node\|phase` | What the drop was on. The target must resolve to this boundary through `hook_render.resolve_anchor`. |
| `--hook` and its fields | Optional. When present, the moved entry is re-rendered with this content in the same write; when absent, the entry's lines move verbatim. |

Python entry point: `move_hook(text, command, from_when, from_anchor, from_index, when, anchor, to_index=None, hook=None) -> str`, returning the new text. Target validation runs in `main()` against the plan loaded via `build.load_config` / `build.plan_build` before `move_hook` is called.

Guarantees:

- One `save_config` per move. On any refusal nothing is written and the file stays byte-identical.
- Without `--hook`, the entry's line and its continuation lines move unchanged, re-indented only by the difference between the two lists' item indents.
- An anchor key the move empties is removed with its entries only, stopping at `_content_end`, so trailing comments and blank lines stay.
- Every other line of the file is unchanged.

Outcome, following the existing `runConfigWrite` convention: exit 0 with a `[config] …` line on success; non-zero exit with the reason on stdout/stderr on refusal. Refusals:

| Case | Reason (sense) |
|---|---|
| `INDEX` not present at the source address | `there is no hook N` (verbatim from the spec) |
| Target anchor not in the step | the step has no such node or phase |
| Target resolves to a boundary other than `--boundary` (a phase and node share a name) | the name resolves to the other boundary |
| Plan cannot be read | that reason, move refused |
| Shipped workflow in force | the writer's existing reason |

## 2. Panel message (`apps/vscode/src/protocol/pipeline.ts`)

New member of `BuilderToExtensionMessage`:

```ts
| {
    type: 'moveHook';
    command: string;
    from: { when: HookWhen; anchor: string; index: number };
    to: {
        when: HookWhen;
        anchor: string;
        /** Final index after removal; omitted means the end. */
        index?: number;
        boundary: 'node' | 'phase';
    };
    /** Carried when the form also edited the content (FR-009). */
    hook?: { hookType: HookType; value: string; note?: string };
}
```

`addHook` loses `movedFrom`. A form save at a different anchor or side sends `moveHook` instead of `addHook`.

The reply is the one every write gets: a `graph` message first, so the board redraws from disk, then `{ type: 'status' }` with `tone: 'done'` and the outcome text on success, or `{ type: 'notice' }` with the writer's reason on refusal.

Extension-side helper (`apps/vscode/src/features/specs/pipelineGraph.ts`):

```ts
export function moveHook(
    script: string,
    workspaceRoot: string,
    command: string,
    move: {
        from: { when: string; anchor: string; index: number };
        to: { when: string; anchor: string; index?: number; boundary: 'node' | 'phase' };
        hook?: HookDraft;
    },
): Promise<string | null>; // null on success, the reason on refusal
```

Handler: `moveHook` in `apps/vscode/src/features/pipeline-builder/builderPanel.ts`.

## 3. Drag payload (`apps/vscode/webview/src/pipeline-builder/hookMoves.ts`)

| Identifier | Value |
|---|---|
| MIME type | `application/x-pb-hook` |
| Payload | JSON `{ command: string; when: HookWhen; anchor: string; index: number }` |

Node drag handlers keep reading `text/plain` and ignore a drag that carries `application/x-pb-hook`; hook drop handlers ignore a drag without it.

The module is pure (no DOM, no messaging) and owns:

- encoding and decoding the payload;
- the final target index after removal, given the source address and a drop on a hook row's half, a card's half, a seam, a hook block or a phase heading;
- the no-op test: a drop that lands the hook where it already is (including on itself) produces no move and no write.

Drop mapping:

| Drop on | Target |
|---|---|
| Upper / lower half of a project hook row | that hook's anchor and side, directly above / below it |
| Upper / lower half of a node card | `before` / `after` that node, end of its list, `boundary: 'node'` |
| A seam or a hook block | that anchor and side, end of its list |
| A phase heading | `before` that phase, end of its list, `boundary: 'phase'` |

## 4. UI contract

Board (`Canvas.tsx`):

- A project hook row is `draggable` and carries the payload above.
- Extension-registered and parked hook rows are not drag sources and not drop targets. Starting a drag on one sets the status line to the reason (for the git extension: registered by the git extension and not moved here) and does not drag.
- A drop whose payload `command` differs from the lane's step is refused before any message is sent, with a status line saying a hook moves within its own step.
- Drop targets show an over state while a hook is held over them; no feedback depends on a transition (reduced motion). The narrow stacked layout accepts drops the same way.

Hook form (`AttachForm.tsx`), for an existing project hook:

- An Order row with two buttons, Move up and Move down. At the first index Move up is disabled and says the hook is already first; at the last index Move down is disabled and says it is already last.
- Each press sends one `moveHook` (same anchor and side, index ∓ 1). The form stays open on the same hook; its index updates optimistically and is put back on refusal.
- Changing the Runs fields to another anchor or side and saving sends one `moveHook`, carrying `hook` when the content also changed.
- A polite live region in the form reads the status line's text once the write answers: the outcome on success, the reason on refusal. Nothing is announced before the answer.
