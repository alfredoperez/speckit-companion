# Tasks: Profile photo upload

**Input**: [plan.md](./plan.md) — six tasks, dependency ordered

## Phase 1: Service (P1)

- [ ] **T001** Add `POST /api/members/:id/avatar`
- [ ] **T002** Reject over 5 MB and non JPEG/PNG, return the reason
- [ ] **T003** Resize to 256 by 256 and write to blob storage
- [ ] **T004** Swap `avatar_url` and delete the previous object

## Phase 2: Page and proof (P2)

- [ ] **T005** Wire the upload control on the profile page
- [ ] **T006** Tests for size, type, and replacement
