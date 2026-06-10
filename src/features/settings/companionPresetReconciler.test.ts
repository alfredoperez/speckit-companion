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
    writeComplexityFastPath,
    resolveComplexityFastPath,
    isCompanionInstalled,
    PresetOp,
} from './companionPresetReconciler';
import * as yaml from 'js-yaml';

const NONE = { 'companion-standard': false, 'companion-turbo': false };

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

    describe('config read-merge-write', () => {
        it('round-trips the profile', () => {
            writeTemplateProfile(root, 'turbo');
            expect(readTemplateProfile(root)).toBe('turbo');
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

        // The pre-release `lean` name was dropped without an alias — it must
        // read as unset, not silently map to turbo (FR-007 / SC-004).
        it('treats the retired lean value as unset (no alias to turbo)', () => {
            fs.mkdirSync(path.dirname(configPath()), { recursive: true });
            fs.writeFileSync(configPath(), 'templateProfile: lean\n', 'utf8');
            expect(readTemplateProfile(root)).toBeUndefined();
        });

        it('preserves sibling keys already in the file', () => {
            fs.mkdirSync(path.dirname(configPath()), { recursive: true });
            fs.writeFileSync(configPath(), 'somethingElse: keep-me\nnested:\n  a: 1\n', 'utf8');
            writeTemplateProfile(root, 'turbo');
            const text = fs.readFileSync(configPath(), 'utf8');
            expect(text).toContain('somethingElse: keep-me');
            expect(text).toContain('a: 1');
            expect(readTemplateProfile(root)).toBe('turbo');
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

        // A standard↔turbo mode change is non-destructive — no command set is
        // removed by the preset path.
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

    describe('resolveComplexityFastPath', () => {
        const writeYml = (body: string): void => {
            fs.mkdirSync(path.dirname(configPath()), { recursive: true });
            fs.writeFileSync(configPath(), body, 'utf8');
        };
        const mirrored = (): unknown =>
            (yaml.load(fs.readFileSync(configPath(), 'utf8')) as { complexityFastPath?: unknown })
                .complexityFastPath;

        // The VS Code setting is the source of truth; companion.yml is a derived
        // mirror with no project-level override (it is gitignored/machine-local).
        it('overwrites companion.yml with a true setting', () => {
            writeYml('complexityFastPath: false\n');
            expect(resolveComplexityFastPath(root, true)).toBe(true);
            expect(mirrored()).toBe(true);
        });

        it('overwrites companion.yml with a false setting', () => {
            writeYml('complexityFastPath: true\n');
            expect(resolveComplexityFastPath(root, false)).toBe(false);
            expect(mirrored()).toBe(false);
        });

        it('mirrors the setting when companion.yml has no value', () => {
            expect(resolveComplexityFastPath(root, false)).toBe(false);
            expect(mirrored()).toBe(false);
        });

        it('defaults to false (opt-in) when both companion.yml and the setting are absent', () => {
            expect(resolveComplexityFastPath(root, undefined)).toBe(false);
            expect(mirrored()).toBe(false);
        });

        it('mirrors the resolved value into companion.yml without clobbering siblings', () => {
            writeYml("templateProfile: 'turbo'\n");
            resolveComplexityFastPath(root, false);
            const doc = yaml.load(fs.readFileSync(configPath(), 'utf8')) as Record<string, unknown>;
            expect(doc.templateProfile).toBe('turbo');
            expect(doc.complexityFastPath).toBe(false);
        });

        it('ignores a non-boolean companion.yml value (setting still resolves)', () => {
            writeYml('complexityFastPath: maybe\n');
            expect(resolveComplexityFastPath(root, false)).toBe(false);
            expect(mirrored()).toBe(false);
        });

        it('round-trips the mirror via the writer', () => {
            writeComplexityFastPath(root, false);
            expect(mirrored()).toBe(false);
            writeComplexityFastPath(root, true);
            expect(mirrored()).toBe(true);
        });
    });

    describe('shouldEnsureStandard', () => {
        it('opts out only for the off escape hatch', () => {
            expect(shouldEnsureStandard('off')).toBe(false);
        });

        it('ensures the standard family for standard, turbo, and an absent default', () => {
            expect(shouldEnsureStandard('standard')).toBe(true);
            expect(shouldEnsureStandard('turbo')).toBe(true);
            expect(shouldEnsureStandard(undefined)).toBe(true);
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
        // not register the namespaced /speckit.companion.* family the turbo picker
        // dispatches. Preset-only-without-extension-dir must therefore read as NOT
        // installed, or the picker would surface turbo and fail with an unknown
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
