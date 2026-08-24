# Feature Specification: Profile photo upload

**Feature Branch**: `041-profile-photo-upload`
**Created**: 2026-05-19
**Status**: Specified

## Why this exists

Teamboard shows a grey placeholder where every face should be.

Members want to put their own photo there, without filing a ticket.

## User Scenarios

### User Story 1 - A member sets their own photo (Priority: P1)

A member opens their profile page, picks a photo, and sees it in place.

**Acceptance Scenarios**

1. **Given** a member on their own profile, **When** they pick a 2 MB JPEG, **Then** the photo replaces the previous one.
2. **Given** a member on their own profile, **When** they pick a 9 MB file, **Then** the upload is rejected and the reason is shown.
3. **Given** a member on someone else's profile, **When** they look for the upload control, **Then** there is none.

## Requirements

### Functional Requirements

- **FR-001** A member can upload a profile photo from their own profile page.
- **FR-002** The service rejects any file over 5 MB, or any file that is not a JPEG or a PNG, and returns the reason.
- **FR-003** An uploaded photo is stored as a 256 by 256 pixel square and replaces the member's previous photo.
- **FR-004** The upload experience should feel fast and reassuring on mobile.

## Key Entities

- **Member** — one person in the directory. Owns exactly one avatar.
- **Avatar** — the stored 256 by 256 image, plus the URL the directory reads.

## Success Criteria

### Measurable Outcomes

- **SC-001** A member replaces their photo in four clicks or fewer.
- **SC-002** Every rejected upload names its reason: too large, or wrong type.
- **SC-003** No member can change another member's photo.

## Out of Scope

- Cropping, filters, and rotation.
- Admin bulk upload.
- Any third-party avatar source.
