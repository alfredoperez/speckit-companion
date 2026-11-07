# Bug Assessment: search is case sensitive

- **Slug**: search-ignores-case
- **Created**: 2026-10-04T09:12:30Z
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: medium

## Report (verbatim or summarized)

> Searching for "Milk" finds nothing when the todo is called "milk".

## Symptom

`matches` in `src/search.js` compares the query and the title as typed, so a different letter case never matches.

## Root Cause Hypothesis

The comparison uses `includes` on the raw strings. Lowercasing both sides before comparing would fix it.
