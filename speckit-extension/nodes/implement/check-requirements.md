---
id: check-requirements
name: Check the requirements against the code
kind: gate
command: implement
reads: [implement-exec]
---
**Hand the requirements and the diff to one worker that knows nothing about how you built this.** Re-reading your own work confirms your own reasoning, which is how a run ships a broken feature with every test green — so this check is only worth anything done by someone else.

Dispatch one worker with three things and nothing else: the **Functional Requirements** from `spec.md` verbatim, the diff of what this run changed, and the project's conventions. No plan, no task list, no summary of your approach. Those are what you want checked; handing them over is what breaks the check, because a worker told why the code is right will agree that it is right.

Ask for one line per requirement, one of three verdicts, judging each requirement **as written** rather than as the implementation narrows it:

- **`met`** — name the code that satisfies it, not a restatement of it.
- **`missing`** — nothing in the diff does this.
- **`at risk`** — something does this and something else can undo it. Name both. This is the verdict that earns the node: a requirement can be satisfied in one place and defeated a few lines later by code that was already there, and both readings look reasonable alone. Tell it to say, too, whether a test covers the real screen the requirement describes or a component built inside the test file, because the second proves nothing about the app.

Fix what comes back, say in one sentence why for anything you disagree with, and never record this step done with an unanswered `missing`.
