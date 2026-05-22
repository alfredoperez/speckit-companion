# Plan: Demo — CSV Export

**Spec**: [spec.md](./spec.md)

## Approach

Serialize the already-materialized table view-model (post filter/sort) to CSV in
the browser and trigger a download via a Blob URL — no backend round-trip.

## Files

- `table/exportCsv.ts` — view-model → CSV string (escaping, header row).
- `table/TableToolbar.tsx` — add the "Export CSV" button wired to the download.
