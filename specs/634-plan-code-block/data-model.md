# Data model

```ts
interface CodeInfo { kind: 'sketch' | 'cite'; file: string; from: number; to: number | null; hl: Set<number> }
interface CodePin { line: number; text: string; sourceLine: number }
interface CodeLine { number: number; text: string; sourceLine: number; highlighted: boolean; pins: CodePin[] }
```

`parseCodeInfo(rawTitle)` returns a `CodeInfo` or null. `parseCode(body, info, context)` returns the lines or an error string.

Rules:

- The first word after the language is `sketch` followed by a file, or `<file>:<from>-<to>` with `1 <= from <= to`.
- The only other word allowed is one `hl=` holding numbers and `a-b` ranges split by commas.
- The file is a path inside the repo: not absolute, no `..`.
- A sketch has `from = 1`. A citation's body is exactly `to - from + 1` lines.
- Every `hl` number and every pin line is one of the shown numbers.
- A pin has text.
- The body is not empty.
