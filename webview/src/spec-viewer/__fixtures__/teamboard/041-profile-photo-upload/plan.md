# Implementation Plan: Profile photo upload

**Input**: [spec.md](./spec.md) · **Output**: [tasks.md](./tasks.md)

## Technical Context

**Language**: TypeScript 5.6
**Runtime**: Node 22, Express 5
**Storage**: S3-compatible blob store, bucket `teamboard-avatars`
**Image**: sharp 0.33
**Testing**: Vitest, plus one Playwright pass on the profile page
**Scale**: 900 members, a handful of uploads a day

## Shape of the change

One endpoint, one storage write, one column swap, one control on the page.

- `POST /api/members/:id/avatar` accepts one multipart file.
- Validation runs before anything touches storage.
- `sharp` centre-crops to a 256 by 256 square and writes a JPEG.
- The member row's `avatar_url` is swapped, then the old object is deleted.

## Constraints

- The caller must be the member. No admin path in this feature.
- Reject before reading the whole body, so a 500 MB file costs nothing.
- The delete runs after the swap, so a failed delete never loses a photo.

## Risks

- **Orphaned objects** if the swap succeeds and the delete fails. Accepted: the weekly sweep on the export bucket can be pointed here.
- **Storage cost** if a member re-uploads repeatedly. One object per member caps it.
