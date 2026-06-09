import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    decideEnsureStandardOps,
    presetCommandFor,
    readTemplateProfile,
    writeTemplateProfile,
    ensureStandardFamily,
    shouldEnsureStandard,
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

    describe('decideEnsureStandardOps', () => {
        it('adds companion-standard from the bundled path when nothing is installed', () => {
            expect(ids(decideEnsureStandardOps(NONE))).toEqual(['add companion-standard']);
        });

        it('is a no-op when companion-standard is already present (idempotent)', () => {
            expect(decideEnsureStandardOps({ ...NONE, 'companion-standard': true })).toEqual([]);
        });

        it('migrates a leftover companion-lean: removes it, then adds standard when absent', () => {
            expect(ids(decideEnsureStandardOps({ 'companion-standard': false, 'companion-lean': true })))
                .toEqual(['remove companion-lean', 'add companion-standard']);
        });

        it('re-enables standard after removing a leftover lean that shared the command files', () => {
            expect(ids(decideEnsureStandardOps({ 'companion-standard': true, 'companion-lean': true })))
                .toEqual(['remove companion-lean', 'enable companion-standard']);
        });

        it('cleans up a stale legacy preset alongside the ensure', () => {
            const ops = ids(decideEnsureStandardOps({ ...NONE, 'sdd-lean': true }));
            expect(ops).toContain('remove sdd-lean');
            expect(ops).toContain('add companion-standard');
            expect(ops.indexOf('remove sdd-lean')).toBeLessThan(ops.indexOf('add companion-standard'));
        });

        // The decision is add-only for the standard family — it never emits a
        // remove of companion-standard for ANY installed state.
        it('never removes companion-standard for any installed-state permutation', () => {
            for (const standard of [true, false]) {
                for (const lean of [true, false]) {
                    for (const legacy of [true, false]) {
                        const ops = ids(decideEnsureStandardOps({
                            'companion-standard': standard,
                            'companion-lean': lean,
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
            expect(presetCommandFor({ id: 'companion-lean', action: 'remove' }))
                .toBe('specify preset remove companion-lean');
            expect(presetCommandFor({ id: 'companion-standard', action: 'enable' }))
                .toBe('specify preset enable companion-standard');
        });

        it('installs add from the bundled path with --dev (catalog-form add no-ops)', () => {
            expect(presetCommandFor({ id: 'companion-standard', action: 'add' }))
                .toBe('specify preset add --dev .specify/extensions/companion/presets/companion-standard');
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

        it('migrates a leftover lean install without ever removing the standard family', async () => {
            install('companion-lean');
            const calls: string[] = [];
            await ensureStandardFamily(root, { run: async (c: string) => { calls.push(c); } });
            expect(calls).toEqual([
                'specify preset remove companion-lean',
                'specify preset add --dev .specify/extensions/companion/presets/companion-standard',
            ]);
            expect(calls).not.toContain('specify preset remove companion-standard');
        });

        // A standard↔lean mode change is non-destructive — no command set is
        // removed by the preset path.
        it('never issues a remove of the standard family in any installed state', async () => {
            for (const standard of [true, false]) {
                for (const lean of [true, false]) {
                    const r = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-perm-'));
                    if (standard) fs.mkdirSync(path.join(r, '.specify', 'presets', 'companion-standard'), { recursive: true });
                    if (lean) fs.mkdirSync(path.join(r, '.specify', 'presets', 'companion-lean'), { recursive: true });
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

    describe('shouldEnsureStandard', () => {
        it('opts out only for the off escape hatch', () => {
            expect(shouldEnsureStandard('off')).toBe(false);
        });

        it('ensures the standard family for standard, lean, and an absent default', () => {
            expect(shouldEnsureStandard('standard')).toBe(true);
            expect(shouldEnsureStandard('lean')).toBe(true);
            expect(shouldEnsureStandard(undefined)).toBe(true);
        });
    });
});
