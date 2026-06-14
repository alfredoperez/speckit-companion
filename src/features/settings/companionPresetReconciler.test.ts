import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    decideEnsureStandardOps,
    presetCommandFor,
    ensureStandardFamily,
    isCompanionInstalled,
    PresetOp,
} from './companionPresetReconciler';

const NONE = { 'companion-standard': false, 'companion-turbo': false };

describe('companionPresetReconciler', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-'));
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    const install = (id: string): void => {
        fs.mkdirSync(path.join(root, '.specify', 'presets', id), { recursive: true });
    };
    const ids = (ops: PresetOp[]): string[] => ops.map(o => `${o.action} ${o.id}`);

    describe('decideEnsureStandardOps', () => {
        it('adds companion-standard from the bundled path when nothing is installed', () => {
            expect(ids(decideEnsureStandardOps(NONE))).toEqual(['add companion-standard']);
        });

        it('is a no-op when companion-standard is already present (idempotent)', () => {
            expect(decideEnsureStandardOps({ ...NONE, 'companion-standard': true })).toEqual([]);
        });

        it('migrates a leftover companion-turbo: removes it, then adds standard when absent', () => {
            expect(ids(decideEnsureStandardOps({ 'companion-standard': false, 'companion-turbo': true })))
                .toEqual(['remove companion-turbo', 'add companion-standard']);
        });

        it('re-enables standard after removing a leftover turbo that shared the command files', () => {
            expect(ids(decideEnsureStandardOps({ 'companion-standard': true, 'companion-turbo': true })))
                .toEqual(['remove companion-turbo', 'enable companion-standard']);
        });

        it('cleans up stale legacy presets (companion-lean, sdd-lean) alongside the ensure', () => {
            const ops = ids(decideEnsureStandardOps({ ...NONE, 'companion-lean': true, 'sdd-lean': true }));
            expect(ops).toContain('remove companion-lean');
            expect(ops).toContain('remove sdd-lean');
            expect(ops).toContain('add companion-standard');
            expect(ops.indexOf('remove companion-lean')).toBeLessThan(ops.indexOf('add companion-standard'));
            expect(ops.indexOf('remove sdd-lean')).toBeLessThan(ops.indexOf('add companion-standard'));
        });

        // The decision is add-only for the standard family — it never emits a
        // remove of companion-standard for ANY installed state.
        it('never removes companion-standard for any installed-state permutation', () => {
            for (const standard of [true, false]) {
                for (const turbo of [true, false]) {
                    for (const legacy of [true, false]) {
                        const ops = ids(decideEnsureStandardOps({
                            'companion-standard': standard,
                            'companion-turbo': turbo,
                            'companion-lean': legacy,
                            'sdd-lean': legacy,
                        }));
                        expect(ops).not.toContain('remove companion-standard');
                    }
                }
            }
        });

        // A project stranded by a prior swap (no companion presets, no stock
        // files) recovers via the bundled-path add.
        it('recovers a stranded project with the bundled-path add', () => {
            const ops = decideEnsureStandardOps(NONE);
            expect(ops).toEqual([{ id: 'companion-standard', action: 'add' }]);
            expect(presetCommandFor(ops[0]))
                .toBe('specify preset add --dev .specify/extensions/companion/presets/companion-standard');
        });
    });

    describe('presetCommandFor', () => {
        it('formats enable/remove as id-form CLI commands', () => {
            expect(presetCommandFor({ id: 'companion-turbo', action: 'remove' }))
                .toBe('specify preset remove companion-turbo');
            expect(presetCommandFor({ id: 'companion-standard', action: 'enable' }))
                .toBe('specify preset enable companion-standard');
        });

        it('installs add from the bundled path with --dev (catalog-form add no-ops)', () => {
            expect(presetCommandFor({ id: 'companion-standard', action: 'add' }))
                .toBe('specify preset add --dev .specify/extensions/companion/presets/companion-standard');
        });
    });

    describe('ensureStandardFamily', () => {
        it('runs the bundled-path add on a fresh/stranded project', async () => {
            const calls: string[] = [];
            const ops = await ensureStandardFamily(root, { run: async (c: string) => { calls.push(c); } });
            expect(calls).toEqual(['specify preset add --dev .specify/extensions/companion/presets/companion-standard']);
            expect(ops).toHaveLength(1);
        });

        it('is a no-op when the standard family is already present (idempotent)', async () => {
            install('companion-standard');
            const calls: string[] = [];
            const ops = await ensureStandardFamily(root, { run: async (c: string) => { calls.push(c); } });
            expect(calls).toEqual([]);
            expect(ops).toEqual([]);
        });

        it('migrates a leftover turbo install without ever removing the standard family', async () => {
            install('companion-turbo');
            const calls: string[] = [];
            await ensureStandardFamily(root, { run: async (c: string) => { calls.push(c); } });
            expect(calls).toEqual([
                'specify preset remove companion-turbo',
                'specify preset add --dev .specify/extensions/companion/presets/companion-standard',
            ]);
            expect(calls).not.toContain('specify preset remove companion-standard');
        });

        it('removes a stranded legacy companion-lean install (pre-rename leftover)', async () => {
            install('companion-lean');
            const calls: string[] = [];
            await ensureStandardFamily(root, { run: async (c: string) => { calls.push(c); } });
            expect(calls).toEqual([
                'specify preset remove companion-lean',
                'specify preset add --dev .specify/extensions/companion/presets/companion-standard',
            ]);
        });

        // Cleaning up a leftover turbo install is non-destructive — no command set
        // is removed by the preset path beyond the leftover itself.
        it('never issues a remove of the standard family in any installed state', async () => {
            for (const standard of [true, false]) {
                for (const turbo of [true, false]) {
                    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-perm-'));
                    if (standard) fs.mkdirSync(path.join(r, '.specify', 'presets', 'companion-standard'), { recursive: true });
                    if (turbo) fs.mkdirSync(path.join(r, '.specify', 'presets', 'companion-turbo'), { recursive: true });
                    const calls: string[] = [];
                    await ensureStandardFamily(r, { run: async (c: string) => { calls.push(c); } });
                    expect(calls).not.toContain('specify preset remove companion-standard');
                    fs.rmSync(r, { recursive: true, force: true });
                }
            }
        });

        it('does not throw when a CLI command fails', async () => {
            await expect(
                ensureStandardFamily(root, { run: async () => { throw new Error('specify not found'); } })
            ).resolves.toHaveLength(1);
        });
    });

    describe('isCompanionInstalled', () => {
        it('is false in a bare project (no extension dir, no presets)', () => {
            expect(isCompanionInstalled(root)).toBe(false);
        });

        it('is true when the bundled Companion extension dir is present', () => {
            fs.mkdirSync(path.join(root, '.specify', 'extensions', 'companion'), { recursive: true });
            expect(isCompanionInstalled(root)).toBe(true);
        });

        // Tightened gate: a preset only swaps the stock /speckit.* bodies, it does
        // not register the namespaced /speckit.companion.* family the Companion
        // workflow dispatches. Preset-only-without-extension-dir must therefore read
        // as NOT installed, or the workflow would surface and fail with an unknown
        // /speckit.companion.specify command.
        it('is false when only the standard preset is installed (no extension dir)', () => {
            install('companion-standard');
            expect(isCompanionInstalled(root)).toBe(false);
        });

        it('is false when only the turbo preset is installed (no extension dir)', () => {
            install('companion-turbo');
            expect(isCompanionInstalled(root)).toBe(false);
        });

        it('is true when the extension dir is present alongside a preset', () => {
            install('companion-standard');
            fs.mkdirSync(path.join(root, '.specify', 'extensions', 'companion'), { recursive: true });
            expect(isCompanionInstalled(root)).toBe(true);
        });
    });
});
