# CLI Contract: check_quality.py

## Invocation

```bash
python3 .claude/skills/eval-speckit-extension/check_quality.py --feature-dir specs/<NNN>-<slug>
python3 .claude/skills/eval-speckit-extension/check_quality.py --commands-dir speckit-extension/commands
python3 .claude/skills/eval-speckit-extension/check_quality.py --feature-dir specs/<NNN>-<slug> --commands-dir speckit-extension/commands --json --strict
```

## Flags

| flag | required | behavior |
|---|---|---|
| `--feature-dir <dir>` | at least one of the two | runs the verbosity + timing dimensions on that spec directory |
| `--commands-dir <dir>` | at least one of the two | runs the prompting dimension over the command-body sources in that directory (the `MUST_ASK` carrier resolves as a sibling: `<dir>/../presets/companion-standard/commands/`) |
| `--json` | no | machine-readable report `{checks, failed, warned}` instead of the text table |
| `--strict` | no | exit 1 when any FAIL row exists; WARN never affects the exit code |

Passing neither `--feature-dir` nor `--commands-dir` is a usage error (exit 2 from argparse).

## Exit codes

| code | meaning |
|---|---|
| 0 | ran; no FAIL, or FAILs present without `--strict` |
| 1 | `--strict` and at least one FAIL row |
| 2 | usage error |

## Dependencies

Python 3 standard library only. Never writes any file.

## CI usage (capture-suite job)

```yaml
- name: Command-quality eval (fixture specs + command sources)
  run: |
    python3 .claude/skills/eval-speckit-extension/check_quality.py --strict --feature-dir specs/509-timing-capture
    python3 .claude/skills/eval-speckit-extension/check_quality.py --strict --feature-dir specs/510-living-sync
    python3 .claude/skills/eval-speckit-extension/check_quality.py --strict --commands-dir speckit-extension/commands
```
