- **small**: the change plausibly touches **≤ 5 files** and decomposes into **≤ 10 tasks**, and is easy to undo and easy to check. A change that is hard to reverse (a migration, deleted stored data, a published contract) or hard to verify is never small, whatever its file count.
- **oversized**: the change clearly exceeds the small bar by a wide margin (broad multi-subsystem
  work, many new files, or a long task list).
- **normal**: anything in between (the default).
