- **small** when all three hold:
  1. **Understood**: the outcome is stated, you know what and where to change, and no product or design decision is open.
  2. **Contained risk**: it touches none of these, where a mistake is hard to see or hard to undo: changing or deleting existing stored data or a stored format (a migration; saving new records is fine); security (auth, permissions, secrets); a contract others already consume (a public API, CLI flag, config format or export, changed or removed; adding one is fine); concurrency (locks, races, ordering); delivery (installers, release, CI, dependencies); or behavior no test would catch if it broke.
  3. **Resumable from the diff**: if the session stopped now, someone could finish from the request and `git diff` alone.

  A change of up to about 5 files and 10 tasks that touches none of the items in 2 is small: several files of one understood change do not make it normal. Counts alone never make a change large.
- **oversized**: the change clearly spans several subsystems, or is roughly double the size one session handles comfortably (more than about 10 files or 20 tasks).
- **normal**: anything in between (the default).
