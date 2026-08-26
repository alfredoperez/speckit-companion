# Contract: `doctor` command-line interface

Backed by `speckit-extension/scripts/doctor.py`, dispatched by the `/speckit.companion.doctor` command body.

## Invocation

```
python3 .specify/extensions/companion/scripts/doctor.py [--feature-dir <path>] [--chat] [--json] [--all]
```

| Flag | Meaning |
|---|---|
| `--feature-dir <path>` | The spec to examine. Defaults to the active spec, resolved with the same precedence `write-context.py` uses (explicit flag → `SPECIFY_FEATURE_DIRECTORY` → `SPECIFY_FEATURE` → `.specify/feature.json` → git branch prefix). |
| `--chat` | Additionally run the transcript deep audit. Off by default. |
| `--json` | Emit the machine-readable report instead of the human one. |
| `--all` | Examine every spec directory under `specs/` and emit one section per spec. |

## Guarantees

- **Read-only.** The command creates, modifies, and deletes nothing under the spec directory, the repository, or the user's home directory.
- **Always exits `0`.** A finding is a report, never a gate. A crash inside any single check is caught, recorded as that check being skipped with the exception's message as the reason, and the remaining checks still run.
- **Never fails the host.** Missing `python3`, an unreadable record, an absent trace, no git repository — each degrades to a skipped check with a reason.

## Human output

```
SpecKit Companion doctor — specs/599-pipeline-doctor

  RECORD      2 problems
    ✗ Step `plan` started at 00:51:12 and never finished
    ✗ 4 tasks are checked in tasks.md with no journal entry: T012, T013, T014, T015

  TRIAGE      1 problem
    ✗ Records disagree with each other — status says `specified` but history[] has no
      step-level complete for `specify`, so the stepper cannot advance. Capture path.

  DRIFT       1 warning, 1 note
    ⚠ capture-runtime — suspect baseline: spec.md last committed at a9c4e11, which is
      not an ancestor of HEAD (branch rebased). 6 files, 3 commits.
    · companion-commands — self-inflicted: the only changes are .spec-context.json writes.

  COMPLETION  clean
  TEMPLATE    clean
  TRACE       skipped — no .trace.jsonl (spec predates run tracing)
  CHAT        not run (pass --chat)

  4 problems, 1 warning across 5 checks; 1 skipped, 1 not run.
```

**Rules the renderer must hold**

- The summary counts checks, not just findings, and always names how many were skipped or not run.
- A check with no findings prints `clean` only if it actually ran.
- A skipped check always prints its reason on the same line.

## `--json` output

```json
{
  "spec": "specs/599-pipeline-doctor",
  "generated_at": "2026-08-26T00:58:03Z",
  "checks": [
    {"check": "record", "state": "ran", "reason": null, "findings": 2},
    {"check": "trace", "state": "skipped", "reason": "no .trace.jsonl (spec predates run tracing)", "findings": 0}
  ],
  "findings": [
    {
      "check": "record",
      "severity": "problem",
      "title": "Step `plan` started and never finished",
      "detail": "start at 2026-08-26T00:51:12Z, no matching complete in history[]",
      "evidence": {"step": "plan", "start_at": "2026-08-26T00:51:12Z"}
    }
  ],
  "drift": [
    {
      "capability": "capture-runtime",
      "class": "suspect-baseline",
      "baseline": "a9c4e11",
      "files": ["speckit-extension/scripts/write-context.py"],
      "commits": [{"sha": "3f10c2a", "subject": "…", "files": ["…"]}],
      "reason": "baseline commit is not an ancestor of HEAD",
      "claim": null
    }
  ],
  "completion": {"attempted": false, "outcome": "not-attempted", "reason": null},
  "chat": null
}
```

The top-level keys are stable. `chat` is `null` unless `--chat` was passed, and is `{"available": false, "reason": "…"}` when the audit could not run.
