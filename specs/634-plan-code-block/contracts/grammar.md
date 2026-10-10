# Grammar contract

````markdown
```ts sketch src/new-file.ts hl=2
export function add(a: number, b: number) {
    return a + b;
}
```
pin 2: text

```ts src/old-file.ts:40-42 hl=41
...three lines...
```
pin 41: text
````

- Info line: `<lang> sketch <file>` or `<lang> <file>:<from>-<to>`, with optional `hl=3,6-7`.
- Pin line: `pin N: text`.
- Part: `presets/_parts/code-pins.md`, mirrored to `.specify/companion/nodes/`.
- Check: `check_plan.py`, recorded with `write-context.py --verify-run`.
- Budget: 12 lines and 3 pins for a sketch. 3 pins for a citation.

Check rules: `missing-file`, `line-out-of-range`, `range-mismatch` and `malformed` are errors. `sketch-too-long`, `too-many-pins` and `text-differs` are warnings.
