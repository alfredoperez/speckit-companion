# Contract: status output

Two consumers code against this: `/speckit.companion.resume`, which parses the final machine line, and the extension's Python test suite. Both are unchanged by this feature except that decisions which used to be missing now appear.

## Human summary block

```text
Spec: <name>   (source: state|derived)
Step: <currentStep>   Status: <status>
Decisions:
  - <decision text>
  - <decision text>
Next: <action>  →  <command|—>
```

- One line per decision, prefixed by two spaces and `- `, in recorded order.
- A decision's text is the string form's own value, or the entry form's `decision` value.
- When no decision has usable text, the section collapses to the single line `Decisions: (none recorded)`.
- `why` and `rejected` are not printed by this report.

## Machine line

```text
RESOLUTION: {"source": …, "empty": …, "specName": …, "currentStep": …, "status": …, "decisions": [...], "nextStep": …, "nextCommand": …, "nextActionLabel": …, "nextTask": …, "complete": …}
```

- `decisions` is an array of strings — the same display strings the human block lists, in the same order. The element type is a string in every case; an entry object is never emitted here.
- Every other key keeps its current type and meaning.

## Exit behavior

Unchanged: the script prints its warning to stderr and exits 0 on any failure, including a `decisions` field of an unexpected type. No shape of recorded data makes it raise or exit non-zero.
