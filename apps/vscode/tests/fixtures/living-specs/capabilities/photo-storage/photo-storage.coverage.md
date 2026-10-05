# Photo Storage coverage

| Requirement | Test |
| --- | --- |
| A replacement photo never leaves the member without an avatar | `tests/photo-storage/replace.test.ts` |
| Oversized uploads are rejected before the body is read | `tests/photo-storage/size-limit.test.ts` |
| Variants are derived on the server, never in the browser | `tests/photo-storage/variants.test.ts` |
| Removing a photo removes every derived variant | `tests/photo-storage/remove.test.ts` |
| Storage failures degrade to the previous avatar | `tests/photo-storage/failure.test.ts` |
| Uploads are quarantined until validated | `tests/photo-storage/quarantine.test.ts` |
| Every stored object is owned by exactly one member | `tests/photo-storage/ownership.test.ts` |
