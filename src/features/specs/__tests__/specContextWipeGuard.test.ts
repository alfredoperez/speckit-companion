/**
 * Regression tests for the spec-context wipe bug.
 *
 * Before the fix, a transient read failure (concurrent writer → partial
 * JSON → JSON.parse throws) was silently treated as "file missing." The
 * spec viewer's ensureSpecContext would then write a fresh minimal context,
 * destroying the real lifecycle history. These tests pin the three new
 * contracts that prevent the regression:
 *
 *   1. readSpecContext distinguishes ENOENT (returns null) from any other
 *      read/parse failure (throws).
 *   2. writeSpecContext refuses to clobber an existing-but-unreadable file
 *      (throws rather than blind-merging the new ctx over a "null" prior).
 *   3. saveFeatureWorkflow only emits a minimal context on ENOENT — every
 *      other read failure aborts the write.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
    SPEC_CONTEXT_FILENAME,
    readSpecContext,
    readSpecContextSync,
} from '../specContextReader';
import { writeSpecContext } from '../specContextWriter';
import { saveFeatureWorkflow } from '../../workflows/workflowManager';
import { FEATURE_CONTEXT_FILE } from '../../workflows/types';
import type { SpecContext } from '../../../core/types/specContext';

function makeTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'speckit-wipeguard-'));
}

function makeCtx(overrides: Partial<SpecContext> = {}): SpecContext {
    return {
        workflow: 'speckit',
        specName: 'Real Spec',
        branch: '999-real-spec',
        currentStep: 'implement',
        status: 'implemented',
        history: [
            {
                step: 'specify',
                substep: null,
                kind: 'start',
                from: { step: null, substep: null },
                by: 'extension',
                at: '2026-05-27T22:11:29Z',
            },
            {
                step: 'specify',
                substep: null,
                kind: 'complete',
                by: 'ai',
                at: '2026-05-27T22:13:06Z',
            },
        ],
        ...overrides,
    };
}

describe('readSpecContext — ENOENT vs. other failures', () => {
    it('returns null when the file genuinely does not exist (ENOENT)', async () => {
        const dir = makeTmpDir();
        try {
            await expect(readSpecContext(dir)).resolves.toBeNull();
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('throws when the file exists but contains invalid JSON', async () => {
        const dir = makeTmpDir();
        try {
            fs.writeFileSync(path.join(dir, SPEC_CONTEXT_FILENAME), '{ this is not json');
            await expect(readSpecContext(dir)).rejects.toThrow(/invalid JSON/);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('sync variant: returns null for ENOENT, throws for invalid JSON', () => {
        const dir = makeTmpDir();
        try {
            expect(readSpecContextSync(dir)).toBeNull();
            fs.writeFileSync(path.join(dir, SPEC_CONTEXT_FILENAME), 'oops');
            expect(() => readSpecContextSync(dir)).toThrow(/invalid JSON/);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('writeSpecContext — refuses to clobber unreadable existing file', () => {
    it('writes happily when the target file does not exist', async () => {
        const dir = makeTmpDir();
        try {
            const ctx = makeCtx();
            await writeSpecContext(dir, ctx);
            const onDisk = JSON.parse(
                fs.readFileSync(path.join(dir, SPEC_CONTEXT_FILENAME), 'utf-8'),
            );
            expect(onDisk.specName).toBe('Real Spec');
            expect(onDisk.history).toHaveLength(2);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('refuses to write (throws) when the existing file is not valid JSON', async () => {
        const dir = makeTmpDir();
        try {
            const target = path.join(dir, SPEC_CONTEXT_FILENAME);
            // Simulate a mid-write partial file.
            fs.writeFileSync(target, '{ partia');
            const original = fs.readFileSync(target, 'utf-8');

            const freshCtx = makeCtx({
                specName: '999-real-spec', // fallback-shape specName (raw basename)
                history: [],
                status: 'draft',
                currentStep: 'specify',
            });

            await expect(writeSpecContext(dir, freshCtx)).rejects.toThrow(
                /not valid JSON|unreadable/,
            );
            // Critical: on-disk content must be unchanged after the refusal.
            expect(fs.readFileSync(target, 'utf-8')).toBe(original);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('saveFeatureWorkflow — ENOENT vs. other failures', () => {
    it('creates a minimal context when the file is missing (ENOENT)', async () => {
        const dir = makeTmpDir();
        try {
            await saveFeatureWorkflow(dir, 'sdd');
            const onDisk = JSON.parse(
                fs.readFileSync(path.join(dir, FEATURE_CONTEXT_FILE), 'utf-8'),
            );
            expect(onDisk.workflow).toBe('sdd');
            expect(typeof onDisk.selectedAt).toBe('string');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('preserves all other fields when merging into an existing valid file', async () => {
        const dir = makeTmpDir();
        try {
            const target = path.join(dir, FEATURE_CONTEXT_FILE);
            const before = makeCtx();
            fs.writeFileSync(target, JSON.stringify(before, null, 2), 'utf-8');

            await saveFeatureWorkflow(dir, 'sdd');

            const after = JSON.parse(fs.readFileSync(target, 'utf-8'));
            expect(after.workflow).toBe('sdd');
            expect(after.specName).toBe('Real Spec');
            expect(after.history).toHaveLength(2);
            expect(after.currentStep).toBe('implement');
            expect(after.status).toBe('implemented');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('refuses to write (throws) when the existing file is unparseable', async () => {
        const dir = makeTmpDir();
        try {
            const target = path.join(dir, FEATURE_CONTEXT_FILE);
            fs.writeFileSync(target, '{ partia');
            const original = fs.readFileSync(target, 'utf-8');

            await expect(saveFeatureWorkflow(dir, 'sdd')).rejects.toThrow(
                /not valid JSON|unreadable/,
            );
            expect(fs.readFileSync(target, 'utf-8')).toBe(original);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
