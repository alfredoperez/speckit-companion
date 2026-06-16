---
description: "Companion auto — run the whole pipeline hands-off (specify → plan → tasks → implement → mark-complete), no pauses"
---

## User Input

```text
$ARGUMENTS
```

## Outline

Run the **entire** Companion pipeline end-to-end and unattended. Walk every step in order — specify → plan → tasks → implement → mark-complete — dispatching the same per-step `/speckit.companion.*` commands, never pausing for approval in between, and finish the spec at `status: completed`.
