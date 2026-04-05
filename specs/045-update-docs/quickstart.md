# Quickstart: Update Architecture & Documentation

## Implementation Order

1. **Update `docs/architecture.md`** — largest delta, full rewrite of structure and components
2. **Update `docs/how-it-works.md`** — targeted fixes to providers, views, structure, capabilities
3. **Verify `CLAUDE.md`** — confirm no changes needed (already accurate)

## Key Verification Steps

After each file update:
- Every directory path listed must exist on disk
- Every class/provider name must exist in codebase
- Provider count = 5, tree view count = 3
- Config keys match package.json `contributes.configuration`

## Files to Modify

| File | Scope | Effort |
|------|-------|--------|
| `docs/architecture.md` | Full rewrite of structure + components | Medium |
| `docs/how-it-works.md` | Update providers, views, structure, capabilities matrix, config keys, mermaid diagrams | Medium |
| `CLAUDE.md` | No changes expected | None |
