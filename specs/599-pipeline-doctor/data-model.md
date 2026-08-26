# Data Model: Pipeline Doctor

Three new shapes and two reshaped ones. Everything is stdlib-serializable; nothing here introduces a database, a schema migration, or a change to the existing `.spec-context.json` schema.

## TraceEvent

One line of `specs/<NNN>/.trace.jsonl`. Written by `trace.py`, appended once per handled call, never edited afterwards.

| Field | Type | Rules |
|---|---|---|
| `at` | string | ISO-8601 UTC, stamped by the tracer at write time. Never supplied by a caller. |
| `tool` | string | Which script handled the call — `write-context` or `drift`. |
| `op` | string | The operation the invocation resolved to: `lifecycle`, `capture`, `task-append`, `materialize`, `mark-complete`, `set`, `drift-compute`, or `unknown`. |
| `ok` | boolean | Whether the call did what it was asked. An early return that declined to write is `false`. |
| `reason` | string \| null | Why it did not, verbatim from the message the script already prints to stderr. `null` when `ok`. |
| `spec` | string \| null | The spec directory the call resolved to, repo-relative. `null` when resolution itself failed. |
| `files` | array of string | Files this call wrote, repo-relative. Empty for a read-only or declined call. |
| `bytes` | integer | Total bytes written by this call. `0` for a declined call. |
| `in_bytes` | integer | Size of the input the call carried — the payload measure the report uses for loaded-context accounting. |
| `ms` | integer | Wall time the call took, rounded to whole milliseconds. |

**Rules**

- Append-only. A crash mid-line leaves an unparseable tail; readers skip it and report the skip.
- Size-capped by bytes. On overflow the file is rewritten keeping the newest entries, with one `{"truncated": <n>}` marker line at the top recording how many were dropped.
- Never read by anything except the doctor. No other module may branch on its contents.

## Finding

One item in the doctor's report. The report is a list of these plus a summary.

| Field | Type | Rules |
|---|---|---|
| `check` | string | Which check produced it: `record`, `triage`, `drift`, `completion`, `template`, `trace`, `chat`. |
| `severity` | string | `problem`, `warning`, or `note`. Never an error — the doctor always exits successfully. |
| `title` | string | One line a developer can read without expanding anything. |
| `detail` | string | The evidence: the step, the task ids, the file paths, the commits. |
| `evidence` | object | Machine-readable backing for `detail`, shape varying by `check`. Present in `--json` output only. |

**Rules**

- A check that could not run produces no findings and instead appears in `CheckStatus` as `skipped` with a reason. A skipped check is never reported as clean.
- Findings are ordered by severity, then by check, then by first appearance in the record.

## CheckStatus

The honesty ledger. Every check the doctor knows about appears here whether or not it ran.

| Field | Type | Rules |
|---|---|---|
| `check` | string | Same vocabulary as `Finding.check`. |
| `state` | string | `ran`, `skipped`, or `not-applicable`. |
| `reason` | string \| null | Required when `skipped`. `null` otherwise. |
| `findings` | integer | How many findings this check produced. |

**Rules**

- The summary line is computed from this ledger, never from the findings list alone, so "0 findings" and "did not run" can never print the same way.

## DriftFlag (reshaped)

The doctor's per-capability drift verdict. Built from `drift.py`'s result object plus classification; the underlying result object is unchanged.

| Field | Type | Rules |
|---|---|---|
| `capability` | string | Capability name from the registry. |
| `class` | string | `real`, `self-inflicted`, `suspect-baseline`, or `unknown`. |
| `baseline` | string \| null | The commit the comparison used. `null` when unknown. |
| `files` | array of string | The changed files behind the flag, repo-relative. |
| `commits` | array of object | `{sha, subject, files}` for each commit that touched those files since the baseline. |
| `reason` | string \| null | Required when `class` is `unknown` or `suspect-baseline`. |
| `claim` | object \| null | A contradicting recorded claim, as `{source, text, at}`, when one exists. |

**State transitions**: none — a flag is computed fresh on every run and never stored.

## CompletionVerdict

| Field | Type | Rules |
|---|---|---|
| `attempted` | boolean | Whether any completion attempt appears in the record or the trace. |
| `outcome` | string | `completed`, `never-arrived`, `refused`, `display-disagrees`, or `not-attempted`. |
| `reason` | string \| null | Required for `refused`; the refusal message the writer emitted. |

**Rules**

- `not-attempted` and `never-arrived` are distinct and must never be collapsed: one is a run that did not try, the other is a run that tried and left no trace of the write.

## DebugFlag

| Field | Type | Rules |
|---|---|---|
| `debug` | boolean | Top-level key of `.specify/companion.yml`. Absent, unreadable, or non-boolean means `false`. |

**Rules**

- Read through the existing `companion_config` loader, so a malformed file degrades to defaults with a warning exactly as it does today.
- Consumed only at render time. No runtime code branches on it.
