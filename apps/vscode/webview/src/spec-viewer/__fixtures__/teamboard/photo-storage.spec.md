# Photo Storage

> Adopted from existing code on 2026-04-28. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

Teamboard keeps one original photo per member and serves every size the directory needs from it. This capability owns where originals live, how the avatar variants are derived and cached, and what happens to stored objects when a member replaces or removes their photo. Without it, every upload feature would invent its own storage layout; with it drifting from the code, the directory would render avatars that no longer exist.

## Requirements

### A replacement photo never leaves the member without an avatar

Replacing a photo MUST be write-first: the new original SHALL be stored and verified before the previous object is deleted, and the member's avatar URL SHALL swap only after the new object is readable.

#### Scenario: a member uploads a replacement photo

- **WHEN** the upload of the new original completes
- **THEN** the avatar URL swaps to the new object first
- **AND** the old object is deleted second, never the other way around

### Oversized uploads are rejected before the body is read

The upload endpoint MUST enforce the size limit from the request's declared length and SHALL reject an oversized upload without reading the body, so a bad upload costs a header exchange rather than a transfer.

#### Scenario: a photo over the size limit is submitted

- **WHEN** the declared content length exceeds the configured limit
- **THEN** the request is rejected with a size error before any bytes of the body are read

### Variants are derived on the server, never in the browser

Every avatar size SHALL be resized on the server from the stored original.

#### Scenario: a new original lands

- **WHEN** the original is stored
- **THEN** the variant set is derived server-side and cached

### Removing a photo removes every derived variant

Deleting a member's photo MUST delete the original and all cached variants together.

#### Scenario: a member removes their photo

- **WHEN** the removal is confirmed
- **THEN** no object for that member remains in storage

### The placeholder is a fallback, not a stored object

A member without a photo SHALL be rendered from the generated placeholder; nothing is written to storage for them.

#### Scenario: a member has never uploaded a photo

- **WHEN** the directory renders that member
- **THEN** the placeholder is generated client-side from the member's initials

### Storage failures degrade to the previous avatar

A failed write MUST leave the previous original and URL untouched.

#### Scenario: the write fails mid-upload

- **WHEN** storing the new original errors
- **THEN** the member's existing avatar keeps serving unchanged

### Uploads are quarantined until validated

An uploaded object SHALL NOT become the avatar source until its type and dimensions validate.

#### Scenario: a file with a spoofed extension is uploaded

- **WHEN** validation reads the actual content type
- **THEN** the object is discarded and the upload is rejected

### Every stored object is owned by exactly one member

Object keys MUST encode the owning member, and a member SHALL never be able to address another member's objects.

#### Scenario: a variant URL for another member is requested

- **WHEN** the requester does not own the object
- **THEN** the request is refused without disclosing whether the object exists

### Cache headers let replaced avatars propagate

Variant responses MUST carry cache headers that let a replaced avatar propagate within minutes without breaking immutable-object caching.

#### Scenario: an avatar was just replaced

- **WHEN** a client re-requests the avatar URL
- **THEN** the new variant is served once the short cache window lapses
