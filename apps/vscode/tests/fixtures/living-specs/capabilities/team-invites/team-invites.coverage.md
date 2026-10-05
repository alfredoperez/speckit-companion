# Team Invites coverage

| Requirement | Test |
| --- | --- |
| Only admins issue invites | `tests/invites/permissions.test.ts` |
| An invite expires after seven days | `tests/invites/expiry.test.ts` |
| An invite is accepted once | `tests/invites/accept.test.ts` |
| Revoking an invite takes effect at once | `tests/invites/revoke.test.ts` |
