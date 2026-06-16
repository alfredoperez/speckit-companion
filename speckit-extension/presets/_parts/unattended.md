## Unattended — the "don't pause" signal

This run is **unattended**: a human is not watching it and cannot answer a prompt. The orchestrator records this by setting `unattended: true` in the dispatched prompt and in `.spec-context.json`, and every step you dispatch carries it forward.

What `unattended: true` means for hooks:

- **Checkpoint `prompt` hooks read it.** A project checkpoint hook ("Continue / Fix / Stop") is authored to check the flag: *if `unattended`, record the checkpoint and continue; otherwise ask the human to proceed.* The hook stays declarative — it does not need to know it is in auto, only that the run is unattended. A hook may still log one line such as `[hook] checkpoint recorded, continuing (unattended)`.
- **Background hooks still fire.** A `background: true` hook (tests, builds, notifications) runs exactly as it would in a manual run — unattended skips the *human pause*, not the side-effects.
- **Review / PR hooks still run.** Anything that produces an artifact or a review still happens; only the wait-for-a-person gate is bypassed.

If a project has no checkpoint hooks, `unattended: true` simply has nothing to act on — set it anyway so any hook added later inherits the contract.
