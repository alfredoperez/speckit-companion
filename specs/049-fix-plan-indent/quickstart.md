# Quickstart: Fix Plan Sub-files Indentation

## Single file change

**File**: `src/features/specs/specExplorerProvider.ts`
**Method**: `getStepSubFiles()` (lines 376-411)

## The fix

Change the early-return `if/if` pattern to an accumulator pattern:

```typescript
private getStepSubFiles(specFullPath: string, step: WorkflowStepConfig): string[] {
    const results: string[] = [];

    // Collect explicit subFiles that exist
    if (step.subFiles && step.subFiles.length > 0) {
        for (const f of step.subFiles) {
            try {
                if (fs.existsSync(path.join(specFullPath, f))) {
                    results.push(f);
                }
            } catch { /* skip */ }
        }
    }

    // Collect subDir contents
    if (step.subDir) {
        const dirPath = path.join(specFullPath, step.subDir);
        const stepFile = getStepFile(step);
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const e of entries) {
                if (e.isFile() && e.name.endsWith('.md')) {
                    results.push(`${step.subDir}/${e.name}`);
                } else if (e.isDirectory()) {
                    const subFilePath = path.join(dirPath, e.name, stepFile);
                    if (fs.existsSync(subFilePath)) {
                        results.push(`${step.subDir}/${e.name}/${stepFile}`);
                    }
                }
            }
        } catch { /* skip */ }
    }

    return results.sort();
}
```

## Verify

1. `npm run compile` — no type errors
2. `npm test` — existing tests pass
3. Manual: expand a spec with Plan sub-files in sidebar → children indented under Plan
