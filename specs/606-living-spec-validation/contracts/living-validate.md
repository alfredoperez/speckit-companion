# Contract: `living-validate`

## The command

`/speckit.companion.living-validate` — a read-only shape check over every registered living spec and over the delta sections of active feature specs. Reports and exits; never writes, never gates.

## The script

```
python3 .specify/extensions/companion/scripts/living_validate.py [--root PATH] [--json]
```

| Flag | Meaning |
|---|---|
| `--root` | Repository root. Defaults to the working directory. |
| `--json` | Emit the machine-readable object instead of the human list. |

**Exit code is always 0.** Whatever is found, whatever state the project is in, whatever fails while reading. This matches `drift.py`, which the human output is also modelled on.

### The machine-readable object

```json
{
  "enabled": true,
  "checked": 14,
  "findings": [
    {
      "severity": "error",
      "code": "delta-heading-not-found",
      "path": "specs/606-living-spec-validation/spec.md",
      "line": 214,
      "message": "MODIFIED names \"A rule that moved\", which capability-name's spec does not have.",
      "fix": "Rename the delta entry to the heading as it appears in the spec, or use ADDED.",
      "capability": "capability-name"
    }
  ],
  "skipped": [{ "path": "…", "reason": "…" }]
}
```

Findings are ordered by `path`, then `line`, then `code`. `enabled` is false only when living specs are off for the project; the run still exits 0 with `checked: 0`.

### The human output

One line per finding, severity first, then the location, then the sentence, then the fix indented under it. A clean run says so in one line. Skipped files are listed with their reasons, verbatim, exactly as `drift.py` does — a clean report must never be readable as a verdict on files that were never examined.

## What the fold consumes

`living_spec_fold.py` imports `living_validate` and calls it in-process before writing anything.

- A capability whose deltas produce an **error-level** finding is refused. The refusal names the finding's message and its code.
- **Warning-level** findings never refuse anything.
- A refusal is per capability. Other capabilities in the same fold still apply.
- A fold that would leave a capability's spec with no requirements is refused unless that capability's registry entry carries `retire: true`, and the refusal names the capability.

## The registry key

```yaml
capabilities:
  - name: some-capability
    match: ["src/some-area/**"]
    spec: src/some-area/some-capability.spec.md
    retire: true
```

`retire` is optional. Absent is false. No other key changes, and the most-specific-first glob ordering is untouched.

## What the editor publishes

On save of a file matching `*.spec.md`, the extension runs the same checks over the saved text and publishes the findings as diagnostics against that file at their lines. Error severity maps to an error diagnostic, warning to a warning. The findings clear when the problem is fixed and the file is saved again. Nothing is published for a file that is not a spec file, or for a project where living specs are off.

The delta checks that need the registry or a target spec — `unknown-capability` and `delta-heading-not-found` — run in the editor too, because both are resolvable from the workspace without running anything.

## The shared examples

`speckit-extension/tests/fixtures/spec-shape/` holds one example spec per case, plus `expected.json` naming the findings each should produce. Both `test_living_validate.py` and `src/features/specs/__tests__/specShapeCheck.test.ts` read that directory. A guard asserts `expected.json` names every example on disk, and each suite iterates the manifest — so an example only one runtime reads fails the build.
