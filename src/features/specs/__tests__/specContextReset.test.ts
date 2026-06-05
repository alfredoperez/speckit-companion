/**
 * Tests for malformed-context recovery: a broken `.spec-context.json` is moved
 * to a timestamped backup and replaced with a fresh, parseable skeleton — and
 * the original bytes survive in the backup so lifecycle history can be salvaged
 * by hand.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { SPEC_CONTEXT_FILENAME } from '../specContextReader';
import { resetMalformedContext } from '../specContextReset';

function makeTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'speckit-reset-'));
}

const BROKEN = '<<<<<<< HEAD\n{ "currentStep": "plan"\n=======\n{ broken';

describe('resetMalformedContext', () => {
    it('backs up the original broken bytes and writes a valid skeleton', async () => {
        const dir = makeTmpDir();
        try {
            const target = path.join(dir, SPEC_CONTEXT_FILENAME);
            fs.writeFileSync(target, BROKEN);

            const backupPath = await resetMalformedContext(dir, {
                workflow: 'sdd',
                specName: '128-malformed-context-recovery',
                branch: '128-malformed-context-recovery',
            });

            // Backup holds the original (broken) bytes verbatim.
            expect(path.basename(backupPath)).toMatch(/^\.spec-context\.json\.bak-/);
            expect(fs.readFileSync(backupPath, 'utf-8')).toBe(BROKEN);

            // Original path now holds a fresh, parseable skeleton.
            const skeleton = JSON.parse(fs.readFileSync(target, 'utf-8'));
            expect(skeleton.workflow).toBe('sdd');
            expect(skeleton.specName).toBe('128-malformed-context-recovery');
            expect(skeleton.currentStep).toBe('specify');
            expect(skeleton.status).toBe('draft');
            expect(skeleton.history).toEqual([]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('does not clobber an existing backup of the same timestamp', async () => {
        const dir = makeTmpDir();
        try {
            const target = path.join(dir, SPEC_CONTEXT_FILENAME);
            fs.writeFileSync(target, BROKEN);

            // Pre-seed every timestamp-shaped backup name so the first choice collides.
            const realToISOString = Date.prototype.toISOString;
            const fixed = '2026-06-05T22:30:00.000Z';
            jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(fixed);
            const stamp = fixed.replace(/[:.]/g, '-');
            const firstChoice = path.join(dir, `${SPEC_CONTEXT_FILENAME}.bak-${stamp}`);
            fs.writeFileSync(firstChoice, 'PRIOR BACKUP — must not be overwritten');

            const backupPath = await resetMalformedContext(dir, {
                workflow: 'sdd',
                specName: 'x',
                branch: 'x',
            });

            // The prior backup is untouched and a distinct name was chosen.
            expect(backupPath).not.toBe(firstChoice);
            expect(fs.readFileSync(firstChoice, 'utf-8')).toBe(
                'PRIOR BACKUP — must not be overwritten',
            );
            expect(fs.readFileSync(backupPath, 'utf-8')).toBe(BROKEN);

            (Date.prototype.toISOString as jest.Mock).mockRestore?.();
            Date.prototype.toISOString = realToISOString;
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('is a no-op error when there is no file to reset (fabricates no backup)', async () => {
        const dir = makeTmpDir();
        try {
            await expect(
                resetMalformedContext(dir, { workflow: 'sdd', specName: 'x', branch: 'x' }),
            ).rejects.toThrow();

            // No skeleton, no backup left behind.
            const entries = fs.readdirSync(dir);
            expect(entries).toHaveLength(0);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
