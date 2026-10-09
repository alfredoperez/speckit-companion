# Data model

```ts
interface CallRow { mark: '+' | '~' | '-' | ' '; depth: number; name: string; path: string; line: number | null; isNew: boolean; sourceLine: number }
interface CallsBlock { rows: CallRow[]; note: string | null }
```

`parseCalls(body, firstLine)` returns a `CallsBlock` or an error string. Rules: one entry point (depth 0) and it comes first; depth rises by at most one per row; no tab; column 1 a space; `**new**` only with `+` and no line. Tree guides come from depth plus whether a later sibling exists at each ancestor depth.
