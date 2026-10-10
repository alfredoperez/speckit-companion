import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    decideLeftoverRemovals,
    presetCommandFor,
    removeLeftoverPresets,
    isCompanionInstalled,
    PresetOp,
} from '../companionPresetReconciler';

const LEFTOVERS = ['companion-standard', 'companion-turbo', 'companion-lean', 'sdd-lean'];
const NONE: Record<string, boolean> = Object.fromEntries(LEFTOVERS.map(id => [id, false]));

const permutations = (): Record<string, boolean>[] =>
    Array.from({ length: 2 ** LEFTOVERS.length }, (_, bits) =>
        Object.fromEntries(LEFTOVERS.map((id, i) => [id, Boolean(bits & (1 << i))])));

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
    const recorder = (): { calls: string[]; run: (c: string) => Promise<void> } => {
        const calls: string[] = [];
        return { calls, run: async (c: string) => { calls.push(c); } };
    };

    describe('decideLeftoverRemovals', () => {
        it('removes companion-standard when it is installed', () => {
            expect(ids(decideLeftoverRemovals({ ...NONE, 'companion-standard': true })))
                .toEqual(['remove companion-standard']);
        });

        it('decides nothing when no leftover is installed', () => {
            expect(decideLeftoverRemovals(NONE)).toEqual([]);
        });

        it('removes all four when all are installed', () => {
            const all = Object.fromEntries(LEFTOVERS.map(id => [id, true]));
            expect(ids(decideLeftoverRemovals(all))).toEqual(LEFTOVERS.map(id => `remove ${id}`));
        });

        it('only ever decides removals, for any installed-state permutation', () => {
            for (const installed of permutations()) {
                const ops = decideLeftoverRemovals(installed);
                expect(ops.every(op => op.action === 'remove')).toBe(true);
                expect(ops.map(op => op.id)).toEqual(LEFTOVERS.filter(id => installed[id]));
            }
        });
    });

    describe('presetCommandFor', () => {
        it('formats a removal as an id-form CLI command', () => {
            expect(presetCommandFor({ id: 'companion-standard', action: 'remove' }))
                .toBe('specify preset remove companion-standard');
        });
    });

    const installHookedExtension = (r: string = root): void => {
        const commands = path.join(r, '.specify', 'extensions', 'companion', 'commands');
        fs.mkdirSync(commands, { recursive: true });
        fs.writeFileSync(path.join(commands, 'speckit.companion.before-step.md'), '');
    };

    describe('removeLeftoverPresets, before the project has the start hook', () => {
        it('keeps companion-standard, which still records the start', async () => {
            fs.mkdirSync(path.join(root, '.specify', 'extensions', 'companion'), { recursive: true });
            install('companion-standard');
            install('companion-turbo');
            const { calls, run } = recorder();
            await removeLeftoverPresets(root, { run });
            expect(calls).toEqual(['specify preset remove companion-turbo']);
        });
    });

    describe('removeLeftoverPresets', () => {
        beforeEach(() => installHookedExtension());

        it('runs one pass when a second call arrives while the first is still removing', async () => {
            install('companion-standard');
            const { calls, run } = recorder();
            const [first, second] = await Promise.all([
                removeLeftoverPresets(root, { run }),
                removeLeftoverPresets(root, { run }),
            ]);
            expect(calls).toEqual(['specify preset remove companion-standard']);
            expect(second).toBe(first);
        });

        it('removes companion-standard once when it is installed', async () => {
            install('companion-standard');
            const { calls, run } = recorder();
            const ops = await removeLeftoverPresets(root, { run });
            expect(calls).toEqual(['specify preset remove companion-standard']);
            expect(ops).toEqual([{ id: 'companion-standard', action: 'remove' }]);
        });

        it('runs nothing when no leftover is installed', async () => {
            const { calls, run } = recorder();
            const ops = await removeLeftoverPresets(root, { run });
            expect(calls).toEqual([]);
            expect(ops).toEqual([]);
        });

        it('runs nothing when the Companion extension is installed but no leftover is', async () => {
            fs.mkdirSync(path.join(root, '.specify', 'extensions', 'companion'), { recursive: true });
            const { calls, run } = recorder();
            await removeLeftoverPresets(root, { run });
            expect(calls).toEqual([]);
        });

        it('removes all four when all are present', async () => {
            LEFTOVERS.forEach(install);
            const { calls, run } = recorder();
            await removeLeftoverPresets(root, { run });
            expect(calls).toEqual(LEFTOVERS.map(id => `specify preset remove ${id}`));
        });

        it('never issues a preset add or enable in any installed-state permutation', async () => {
            for (const installed of permutations()) {
                const present = LEFTOVERS.filter(id => installed[id]);
                const r = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-perm-'));
                installHookedExtension(r);
                for (const id of present) {
                    fs.mkdirSync(path.join(r, '.specify', 'presets', id), { recursive: true });
                }
                const { calls, run } = recorder();
                await removeLeftoverPresets(r, { run });
                fs.rmSync(r, { recursive: true, force: true });
                expect(calls).toEqual(present.map(id => `specify preset remove ${id}`));
            }
        });

        it('runs nothing on a second run once the folder is gone', async () => {
            install('companion-standard');
            const { calls, run } = recorder();
            await removeLeftoverPresets(root, {
                run: async (c: string) => {
                    await run(c);
                    fs.rmSync(path.join(root, '.specify', 'presets', 'companion-standard'), { recursive: true });
                },
            });
            await removeLeftoverPresets(root, { run });
            expect(calls).toEqual(['specify preset remove companion-standard']);
        });

        it('does not throw when a CLI command fails, and logs each failure', async () => {
            LEFTOVERS.forEach(install);
            const logs: string[] = [];
            await expect(
                removeLeftoverPresets(root, {
                    run: async () => { throw new Error('specify not found'); },
                    log: msg => logs.push(msg),
                })
            ).resolves.toHaveLength(4);
            expect(logs.filter(l => l.includes('removal failed') && l.includes('specify not found'))).toHaveLength(4);
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

        it('is false when only a leftover standard preset is installed (no extension dir)', () => {
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
