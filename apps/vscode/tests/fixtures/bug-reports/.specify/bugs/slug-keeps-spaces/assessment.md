# Bug Assessment: toSlug only replaces the first space

- **Slug**: slug-keeps-spaces
- **Created**: 2026-10-01
- **Source**: pasted text
- **Verdict**: valid
- **Severity**: medium

## Report (verbatim or summarized)

> toSlug in src/slug.js only replaces the first space: toSlug("Hello Big World") returns "hello-big world" instead of "hello-big-world".

## Symptom

`toSlug` lowercases the title but converts only the first space to a hyphen. Titles with two or more spaces produce slugs that still contain spaces.

## Reproduction

1. `node -e 'console.log(require("./src/slug.js").toSlug("Hello Big World"))'`
2. Observed: `hello-big world`
3. Expected: `hello-big-world`

Reproduced locally on 2026-10-01.

## Suspected Code Paths

- `src/slug.js:2` — `title.toLowerCase().replace(' ', '-')`. `String.prototype.replace` with a string pattern replaces only the first match.

No other callers of `toSlug` exist in `src/`.

## Root Cause Hypothesis

`replace` receives a string literal `' '` as its pattern, so JavaScript replaces only the first occurrence. Every later space survives. Confidence: high (confirmed by reproduction).

## Proposed Remediation

**Preferred**: Change the call to replace every space: `title.toLowerCase().replace(/ /g, '-')` (or `.replaceAll(' ', '-')`). This is the minimal fix and keeps current behavior for single-space titles.

**Alternatives**:
- `.replace(/\s+/g, '-')`: also collapses runs of spaces, tabs and newlines into one hyphen. Better slugs, but changes output for inputs like `"a  b"` (`a--b` becomes `a-b`). Out of scope unless the owner wants it.
- Full slugify (strip punctuation, trim leading/trailing hyphens): larger behavior change; not justified by this report.

**Files likely to change**:
- `src/slug.js`
- `src/slug.test.js` (new)

**Tests to add or update**:
- `toSlug("Hello Big World") === "hello-big-world"` (multiple spaces).
- `toSlug("Hello") === "hello"` (no spaces).
- `toSlug("Hello World") === "hello-world"` (single space, regression guard).
- Wire the new test into `npm test`. Today `package.json` runs only `src/cart.test.js`.

## Risks & Considerations

- Existing stored slugs created with the bug contain spaces. If slugs are persisted or used in URLs anywhere outside this repo, regenerated slugs will not match. No such usage found in this repo.
- `replaceAll` needs Node 15+. The regex form works on all versions.

## Open Questions

- [NEEDS CLARIFICATION: Should whitespace runs collapse to one hyphen, or should each space map to one hyphen?]
