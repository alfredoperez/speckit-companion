## The smallest thing that works

**Stop at the first rung that holds:** does it need to exist; does this codebase already have it; does the platform or an installed dependency do it; can it be one line; only then, the minimum code. Fix the cause where every caller passes through. No interface with one implementation, no factory for one product, no scaffolding for later. Lean governs what you build, not how work is split.

**Write it the way you would say it.** One idea per sentence, no em-dashes, no "shall be capable of", no section that says "N/A". Then reread and cut: the sentence that restates the one before, the example longer than its rule, the clause defending a choice nobody challenged.

**Never simplify away** validation at a trust boundary, error handling that prevents data loss, security, accessibility, or anything the spec asks for. **A corner cut on purpose** carries `// simplified: <ceiling>, <what to do when it binds>` in the code and one `concerns` entry in this step's capture.
