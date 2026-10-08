# Contracts

## Chip
`<button class="file-ref" data-filename="<path>" [data-line="<n>"] [title="<path>"]>` where `data-line` is present only for an integer 1..9999999. `path:N` and `path:N-M` set it to N.

## Message (webview to host)
`{ "type": "openFile", "filename": "<path>", "line": <n> }` with `line` optional.

## Host rules
- Folder path: resolve against project root, then spec folder; refuse when `path.relative(root, path.resolve(root, rel))` is `..`, starts with `..` + separator, or is absolute.
- Bare name: unchanged lookup.
- With `line`: reveal and put the cursor on it.

## Fence
`parseFenceInfo(info): FenceInfo`; `renderBlockFence(name, body, info): string | null`; names `calls`, `states`, `screen`.
