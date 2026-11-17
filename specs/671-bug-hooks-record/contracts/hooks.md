# Contract: bug hooks and the writer flag

## extension.yml

| Hook | Command |
|---|---|
| `before_bug_assess`, `before_bug_fix`, `before_bug_test` | `speckit.companion.before-bug` |
| `after_bug_assess`, `after_bug_fix`, `after_bug_test` | `speckit.companion.after-bug` |

All `optional: false`.

## Writer

```
python3 .specify/extensions/companion/scripts/write-context.py --hook start  --bug <slug> --step <assess|fix|test>
python3 .specify/extensions/companion/scripts/write-context.py --hook finish --bug <slug> --step <assess|fix|test>
```

- `<slug>` must match `^[a-z0-9][a-z0-9._-]*$`; anything else records nothing and exits 0 with one line saying why.
- `--bug` and `--feature-dir` are exclusive.
- A step other than `assess`, `fix` or `test` with `--bug` is refused.
- Exit 0 always for hook calls, like the other hooks.
