# Bug Fix: search is case sensitive

- **Slug**: search-ignores-case
- **Fixed**: 2026-10-04
- **Assessment**: ./assessment.md (created 2026-10-04T09:12:30Z)
- **Status**: applied

## Summary

`matches` now lowercases the query and the title before comparing them.

## Changes

| File | Change | Notes |
|------|--------|-------|
| `src/search.js` | modified | Lowercase both sides |
