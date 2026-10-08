# Contract: Sizing and unverified guards

## 1. Sizing

A change is `simple` only when it is inside the small bar (5 files / 10 tasks) and is also easy to undo and easy to check. Inside the bar but hard to undo or hard to check, or unclear, it is `normal`.

The specify step prints one reason line, never two. A change inside the bar that is hard to undo or hard to check prints the new line, with its dash as written:

```text
[companion] Change is hard to undo or hard to check — running the full pipeline as <normal|oversized>.
```

A change over the bar prints the existing guardrail line, unchanged: `[companion] Change exceeds the small-change guardrail (5 files / 10 tasks) — running the full pipeline as <normal|oversized>.` A `simple` change prints neither.

The standalone classify command gets the same rule through the shared size definition, so its verdict can change. Its output does not: it still prints exactly one line and no reason line. The reason is never recorded.

```text
[companion] size=<simple|normal|oversized>
```

## 2. Completion

`mark_spec_complete(feature_dir, by)` adds one entry to the top-level `concerns` list when `verified` is not a non-empty list and `concerns` holds nothing. A `concerns` value that holds something, of any shape, counts as an explanation and is left exactly as it was.

```json
{"note": "finished, unverified", "step": "implement"}
```

It then prints one warning on stderr:

```text
[companion] Warning: <spec-context path> completed with nothing verified and no concern explaining why; recorded "finished, unverified".
```

Unchanged: the concern and the status go out in the function's single write, the return value is still the spec-context path (`None` only on the two existing refusals), and stdout still carries the success line `[companion] Marked <spec-context path> complete (status=completed, by=<by>)`.

Completion never refuses for lack of verification. A record with a verification (a failed check counts) or a top-level concern gets no new concern and no warning. A spec already completed or archived is untouched, so a second attempt adds nothing.

## 3. Sidebar

`resolveSpecBranch(ctx)` returns `string | undefined`: the first non-blank string of `workingBranch`, then `branch`, else `undefined`. The sidebar tooltip and both viewer reads call it.

When it returns a name, the spec row tooltip gains this line after the `Assistant: <assistant>` line and before the `A workflow step is running now` line. When it returns `undefined` there is no Branch line.

```text
Branch: <name>
```
