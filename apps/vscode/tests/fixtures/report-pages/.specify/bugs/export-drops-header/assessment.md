# Bug Assessment: CSV export has no header row

- **Slug**: export-drops-header
- **Created**: 2026-10-02
- **Source**: pasted text
- **Verdict**: invalid
- **Severity**: low

## Report (verbatim or summarized)

> The orders CSV I downloaded from the admin page starts straight with the first order. The header row with the column names is missing, so my spreadsheet labels the columns A, B, C.

## Symptom

A file produced by the "Append to existing file" export has no header row. The first line is an order, not `id,customer,total,placed_at`.

## Reproduction

1. `node -e 'const {toCsv}=require("./src/export.js");console.log(toCsv([{id:1,customer:"Ana",total:72,placed_at:"2026-10-01"}],{append:true}))'`
2. Observed: `1,Ana,72,2026-10-01` with no header line.
3. The same call without `append`, `toCsv(rows)`, prints the header line first.

Reproduced locally on 2026-10-02. The header is missing only when `append` is on.

## Suspected Code Paths

- `src/export.js:9`: `if (!options.append) lines.push(HEADER)`. The header is skipped on purpose in append mode.
- `src/export.test.js`: `append mode omits the header` asserts this behaviour.
- `docs/export.md`: "Append mode writes rows only, so the file you are adding to keeps a single header."

## Root Cause Hypothesis

This is expected behaviour, not a defect. Append mode exists to add rows to a file that already has a header, and a second header in the middle of that file would be read as an order by every importer. The reporter ticked "Append to existing file" and then opened the download on its own. Confidence: **high** (the code, the test and the docs all agree).

## Proposed Remediation

**Preferred**: No code change. Close as working as designed and point the reporter to the plain export, which includes the header.

**Alternatives**:
- Rename the checkbox to "Rows only (no header), for appending to an existing file" so the outcome is clear before the download. This is a copy change, tracked separately if wanted.

**Files likely to change**:
- None.

**Tests to add or update**:
- None. `append mode omits the header` already pins the behaviour.

## Risks & Considerations

- Adding the header in append mode would break anyone who appends exports to a running file, which is the documented use.
- The checkbox label is easy to misread. The report is a usability signal even though it is not a bug.

## Open Questions

- [NEEDS CLARIFICATION: Is the checkbox ticked by default for this reporter, or was it remembered from an earlier export?]
