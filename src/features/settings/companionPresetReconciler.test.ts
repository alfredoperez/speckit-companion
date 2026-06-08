import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    decidePresetOps,
    presetCommandFor,
    readTemplateProfile,
    writeTemplateProfile,
    reconcileCompanionPreset,
    PresetOp,
} from './companionPresetReconciler';

const NONE = { 'companion-standard': false, 'companion-lean': false };

describe('companionPresetReconciler', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-'));
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    const configPath = (): string => path.join(root, '.specify', 'companion.yml');
    const install = (id: string): void => {
        fs.mkdirSync(path.join(root, '.specify', 'presets', id), { recursive: true });
    };
    const ids = (ops: PresetOp[]): string[] => ops.map(o => `${o.action} ${o.id}`);

    describe('decidePresetOps', () => {
        it('adds the target when nothing is installed', () => {
            expect(ids(decidePresetOps('standard', NONE))).toEqual(['add companion-standard']);
            expect(ids(decidePresetOps('lean', NONE))).toEqual(['add companion-lean']);
        });

        it('enables the target when it is already installed (idempotent-ish)', () => {
            expect(ids(decidePresetOps('standard', { ...NONE, 'companion-standard': true })))
                .toEqual(['enable companion-standard']);
        });

        it('removes the other preset BEFORE adding the target when switching', () => {
            expect(ids(decidePresetOps('standard', { 'companion-standard': false, 'companion-lean': true })))
                .toEqual(['remove companion-lean', 'add companion-standard']);
            expect(ids(decidePresetOps('lean', { 'companion-standard': true, 'companion-lean': false })))
                .toEqual(['remove companion-standard', 'add companion-lean']);
        });

        it('off removes both installed presets and adds nothing', () => {
            expect(ids(decidePresetOps('off', { 'companion-standard': true, 'companion-lean': true })))
                .toEqual(['remove companion-standard', 'remove companion-lean']);
        });

        it('off with nothing installed is a no-op', () => {
            expect(decidePresetOps('off', NONE)).toEqual([]);
        });

        it('cleans up a stale legacy sdd-lean preset', () => {
            const ops = ids(decidePresetOps('standard', { ...NONE, 'sdd-lean': true }));
            expect(ops).toContain('remove sdd-lean');
            expect(ops).toContain('add companion-standard');
            // the legacy remove comes before the add
            expect(ops.indexOf('remove sdd-lean')).toBeLessThan(ops.indexOf('add companion-standard'));
        });
    });

    describe('presetCommandFor', () => {
        it('formats a preset CLI command', () => {
            expect(presetCommandFor({ id: 'companion-lean', action: 'remove' }))
                .toBe('specify preset remove companion-lean');
        });
    });

    describe('config read-merge-write', () => {
        it('round-trips the profile', () => {
            writeTemplateProfile(root, 'lean');
            expect(readTemplateProfile(root)).toBe('lean');
            writeTemplateProfile(root, 'off');
            expect(readTemplateProfile(root)).toBe('off');
        });

        it('returns undefined when the config file is absent', () => {
            expect(readTemplateProfile(root)).toBeUndefined();
        });

        it('returns undefined for a value that is not a known profile', () => {
            fs.mkdirSync(path.dirname(configPath()), { recursive: true });
            fs.writeFileSync(configPath(), 'templateProfile: foo\n', 'utf8');
            expect(readTemplateProfile(root)).toBeUndefined();
        });

        it('preserves sibling keys already in the file', () => {
            fs.mkdirSync(path.dirname(configPath()), { recursive: true });
            fs.writeFileSync(configPath(), 'somethingElse: keep-me\nnested:\n  a: 1\n', 'utf8');
            writeTemplateProfile(root, 'lean');
            const text = fs.readFileSync(configPath(), 'utf8');
            expect(text).toContain('somethingElse: keep-me');
            expect(text).toContain('a: 1');
            expect(readTemplateProfile(root)).toBe('lean');
        });
    });

    describe('reconcileCompanionPreset', () => {
        it('persists the profile and runs add when enabling a fresh project', async () => {
            const calls: string[] = [];
            const ops = await reconcileCompanionPreset(root, 'standard', { run: async c => { calls.push(c); } });
            expect(calls).toEqual(['specify preset add companion-standard']);
            expect(readTemplateProfile(root)).toBe('standard');
            expect(ops).toHaveLength(1);
        });

        it('removes the other then adds the target when switching profiles', async () => {
            install('companion-lean');
            const calls: string[] = [];
            await reconcileCompanionPreset(root, 'standard', { run: async c => { calls.push(c); } });
            expect(calls).toEqual([
                'specify preset remove companion-lean',
                'specify preset add companion-standard',
            ]);
            expect(readTemplateProfile(root)).toBe('standard');
        });

        it('removes both on off', async () => {
            install('companion-standard');
            install('companion-lean');
            const calls: string[] = [];
            await reconcileCompanionPreset(root, 'off', { run: async c => { calls.push(c); } });
            expect(calls).toEqual([
                'specify preset remove companion-standard',
                'specify preset remove companion-lean',
            ]);
        });

        it('runs no command when already reconciled (off + nothing installed)', async () => {
            const calls: string[] = [];
            await reconcileCompanionPreset(root, 'off', { run: async c => { calls.push(c); } });
            expect(calls).toEqual([]);
        });

        it('does not throw when a CLI command fails', async () => {
            await expect(
                reconcileCompanionPreset(root, 'standard', { run: async () => { throw new Error('specify not found'); } })
            ).resolves.toHaveLength(1);
            expect(readTemplateProfile(root)).toBe('standard');
        });

        it('skips the add when a preceding remove fails (never registers both presets)', async () => {
            install('companion-lean');
            const calls: string[] = [];
            await reconcileCompanionPreset(root, 'standard', {
                run: async c => {
                    calls.push(c);
                    if (c.includes('remove')) {
                        throw new Error('remove failed');
                    }
                },
            });
            // the remove was attempted and failed; the add must NOT run
            expect(calls).toEqual(['specify preset remove companion-lean']);
        });

        it('skips ENABLE of the target when a preceding remove fails (target already installed)', async () => {
            install('companion-standard'); // target installed → would be enabled
            install('companion-lean');     // non-target installed → removed first
            const calls: string[] = [];
            await reconcileCompanionPreset(root, 'standard', {
                run: async c => {
                    calls.push(c);
                    if (c.includes('remove')) {
                        throw new Error('remove failed');
                    }
                },
            });
            // remove failed → the enable is skipped, so we don't leave both active
            expect(calls).toEqual(['specify preset remove companion-lean']);
        });
    });
});
