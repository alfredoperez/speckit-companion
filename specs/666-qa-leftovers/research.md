# Research: Release QA leftovers

## Index copy for the check snapshot

**Decision**: copy the index with `shutil.copy2`.
**Rationale**: git treats an index entry as racy, and re-hashes the file, only when the entry's mtime is not older than the index file's own mtime. `copyfile` gives the copy a fresh mtime, so a same-size rewrite in the same second as the commit looks clean. Reproduced: the receipt test failed 3 of 25 runs on main.
**Alternatives considered**: running `git update-index --really-refresh` on the scratch index (a second git call and slower on big repos); hashing files ourselves (reimplements git).

## Board time for a record with no activity

**Decision**: fall back to file time only when the spec has no run record, on the card and in the sort.
**Rationale**: file times on a fresh checkout are the checkout time, and the sort's own comment already says they only mean something without a record.
**Alternatives considered**: dropping `updatedAt` from the row (the server's idle check reads it).

## Site preview

**Decision**: `python3 -m http.server 4321 --directory dist/client`.
**Rationale**: `astro preview` exits with the Vercel adapter. Python's server maps folders to `index.html`, knows the media types, and adds no dependency. Old URLs still resolve through the static forward pages the build writes.
**Alternatives considered**: a Node static server script (more code for the same result); adding `serve` as a dependency.

## Linked node_modules in QA staging

**Decision**: fail early in `qa-stage.sh` when `node_modules` is a symlink, naming `npm ci`, and recommend an own worktree in the guide.
**Rationale**: `vsce package` runs `npm list`, which reports every package as extraneous through the link (reproduced in this worktree: exit 1 with ELSPROBLEMS; the main checkout exits 0).
**Alternatives considered**: auto-running `npm ci` (slow and surprising inside a stage script).
