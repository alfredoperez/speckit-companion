---
id: persist-size
kind: control
command: specify
reads: [classify-size]
---
6. **Persist the size verdict** so the later steps (`plan`, `tasks`) can right-size their output without re-deciding it. Right after classifying, record the verdict on the spec's context from the repository root:
   ```bash
   python3 .specify/extensions/companion/scripts/write-context.py --set size=<simple|normal|oversized>
   ```
   Write `simple` when the change is the small, fast-trackable size; `oversized` when it crossed the guardrail; otherwise `normal`. This only writes a plain `size` field — it never touches the lifecycle log. Best-effort: if `python3` is unavailable, skip without failing the command.
