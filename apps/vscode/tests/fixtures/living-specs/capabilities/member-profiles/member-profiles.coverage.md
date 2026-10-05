# Member Profiles coverage

| Requirement | Test |
| --- | --- |
| A member edits only their own profile | `tests/profile/ownership.test.ts` |
| Display names are required and trimmed | `tests/profile/display-name.test.ts` |
| A profile always belongs to exactly one team | `tests/profile/team.test.ts` |
| Role changes take effect on the next request | `tests/profile/roles.test.ts` |
| Bios are plain text with a length limit | `tests/profile/bio.test.ts` |
| Deactivated members stay readable | `tests/profile/deactivated.test.ts` |
| Profile reads never expose the email to other workspaces | `tests/profile/email-visibility.test.ts` |
| Concurrent edits do not overwrite each other | `tests/profile/versioning.test.ts` |
| Every profile change is recorded | `tests/profile/audit.test.ts` |
