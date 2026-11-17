---
id: persist-size
name: Record the size verdict
kind: control
command: specify
reads: [classify-size]
---
**Carry the size verdict into the wrap-up call**, so `plan` and `tasks` can right-size their output without re-deciding it. Do not record it on its own: the finalize step's single `--batch` takes it, with the classification's **inputs** so a later resume can judge whether the call was borderline or clear-cut. Add both to that call:
   ```json
   "set": {"size": "<simple|normal|oversized>", …},
   "classification": {"projectedFiles": <n>, "projectedTasks": <n>, "scopeSignal": "<larger|smaller|none>", "verdict": "<simple|normal|oversized>"}
   ```
   Write `simple` when the change is the small, fast-trackable size; `oversized` when it crossed the guardrail; otherwise `normal`. Neither field touches the lifecycle log.
