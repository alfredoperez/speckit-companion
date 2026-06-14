import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveDispatchWithFallback, resolveDispatchForRoot } from './profileDispatch';

const installExtension = (wsRoot: string): void => {
    fs.mkdirSync(path.join(wsRoot, '.specify', 'extensions', 'companion'), { recursive: true });
};

describe('resolveDispatchWithFallback — missing-extension safety (FR-006/FR-007)', () => {
    let wsRoot: string;
    let specDir: string;

    beforeEach(() => {
        wsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-fallback-'));
        fs.mkdirSync(path.join(wsRoot, '.specify'), { recursive: true });
        specDir = path.join(wsRoot, 'specs', 'demo');
        fs.mkdirSync(specDir, { recursive: true });
    });
    afterEach(() => {
        fs.rmSync(wsRoot, { recursive: true, force: true });
    });

    it('downgrades a companion command to its stock twin and flags fellBack when the extension is missing', () => {
        const r = resolveDispatchWithFallback('speckit.companion.plan', specDir);
        expect(r.command).toBe('speckit.plan');
        expect(r.fellBack).toBe(true);
    });

    it('maps all four companion pipeline commands to their stock twins when the extension is missing', () => {
        expect(resolveDispatchWithFallback('speckit.companion.specify', specDir).command).toBe('speckit.specify');
        expect(resolveDispatchWithFallback('speckit.companion.plan', specDir).command).toBe('speckit.plan');
        expect(resolveDispatchWithFallback('speckit.companion.tasks', specDir).command).toBe('speckit.tasks');
        expect(resolveDispatchWithFallback('speckit.companion.implement', specDir).command).toBe('speckit.implement');
    });

    it('keeps the companion command (no fallback) when the extension IS installed', () => {
        installExtension(wsRoot);
        const r = resolveDispatchWithFallback('speckit.companion.plan', specDir);
        expect(r.command).toBe('speckit.companion.plan');
        expect(r.fellBack).toBe(false);
    });

    it('never flags fellBack for a stock command (no companion command involved), installed or not', () => {
        const r = resolveDispatchWithFallback('speckit.plan', specDir);
        expect(r.command).toBe('speckit.plan');
        expect(r.fellBack).toBe(false);
    });

    it('passes through a non-pipeline command unchanged (no stock twin to fall back to)', () => {
        const r = resolveDispatchWithFallback('speckit.clarify', specDir);
        expect(r.command).toBe('speckit.clarify');
        expect(r.fellBack).toBe(false);
    });
});

describe('resolveDispatchForRoot — root-based variant (new-spec dispatch)', () => {
    let wsRoot: string;

    beforeEach(() => {
        wsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-root-'));
        fs.mkdirSync(path.join(wsRoot, '.specify'), { recursive: true });
    });
    afterEach(() => {
        fs.rmSync(wsRoot, { recursive: true, force: true });
    });

    it('downgrades a companion specify to stock + fellBack when the extension is missing', () => {
        const r = resolveDispatchForRoot('speckit.companion.specify', wsRoot);
        expect(r.command).toBe('speckit.specify');
        expect(r.fellBack).toBe(true);
    });

    it('keeps the companion specify when the extension is installed', () => {
        installExtension(wsRoot);
        const r = resolveDispatchForRoot('speckit.companion.specify', wsRoot);
        expect(r.command).toBe('speckit.companion.specify');
        expect(r.fellBack).toBe(false);
    });

    it('no fallback for a stock command (no companion command in play)', () => {
        const r = resolveDispatchForRoot('speckit.specify', wsRoot);
        expect(r.command).toBe('speckit.specify');
        expect(r.fellBack).toBe(false);
    });

    it('downgrades when no workspace root is known', () => {
        const r = resolveDispatchForRoot('speckit.companion.specify', undefined);
        expect(r.command).toBe('speckit.specify');
        expect(r.fellBack).toBe(true);
    });
});
