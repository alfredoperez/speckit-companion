import * as vscode from 'vscode';
import { buildPrompt, buildLifecyclePrompt } from '../promptBuilder';

describe('buildPrompt', () => {
    const originalGetConfig = vscode.workspace.getConfiguration;

    function mockConfig(enabled: boolean): void {
        (vscode.workspace as unknown as { getConfiguration: unknown }).getConfiguration = jest
            .fn()
            .mockReturnValue({ get: jest.fn().mockReturnValue(enabled) });
    }

    afterEach(() => {
        (vscode.workspace as unknown as { getConfiguration: unknown }).getConfiguration = originalGetConfig;
    });

    describe('when aiContextInstructions is enabled (default)', () => {
        beforeEach(() => mockConfig(true));

        it('wraps command with preamble for each known step', () => {
            for (const step of ['specify', 'plan', 'tasks', 'implement'] as const) {
                const out = buildPrompt({
                    command: '/speckit.' + step + ' specs/001-demo',
                    step,
                    specDir: 'specs/001-demo',
                });
                expect(out).toContain('<!-- speckit-companion:context-update -->');
                expect(out).toContain('<!-- /speckit-companion:context-update -->');
                expect(out).toContain(`stepHistory.${step}.startedAt`);
                expect(out.endsWith('/speckit.' + step + ' specs/001-demo')).toBe(true);
            }
        });

        it('lists canonical substeps for the given step', () => {
            const out = buildPrompt({ command: '/speckit.plan x', step: 'plan', specDir: 'specs/001-demo' });
            expect(out).toContain('Canonical substeps for plan: research, design');
        });

        it('returns raw command when step is unknown', () => {
            const out = buildPrompt({
                command: '/speckit.unknown',
                step: 'unknown',
                specDir: 'specs/001-demo',
            });
            expect(out).toBe('/speckit.unknown');
        });

        it('returns raw command when step is omitted', () => {
            const out = buildPrompt({ command: '/speckit.constitution' });
            expect(out).toBe('/speckit.constitution');
        });

        it('only embeds the workspace-relative specDir, not absolute paths', () => {
            const out = buildPrompt({
                command: '/speckit.plan specs/001-demo',
                step: 'plan',
                specDir: 'specs/001-demo',
            });
            expect(out).not.toMatch(/\/Users\//);
            expect(out).not.toMatch(/\/home\//);
            expect(out).toContain('specs/001-demo/.spec-context.json');
        });
    });

    describe('when aiContextInstructions is disabled', () => {
        beforeEach(() => mockConfig(false));

        it('returns raw command byte-identical to input', () => {
            const cmd = '/speckit.plan specs/001-demo';
            const out = buildPrompt({ command: cmd, step: 'plan', specDir: 'specs/001-demo' });
            expect(out).toBe(cmd);
        });
    });

    it('preamble stays under ~1500 chars per step', () => {
        mockConfig(true);
        for (const step of ['specify', 'plan', 'tasks', 'implement'] as const) {
            const out = buildPrompt({ command: 'x', step, specDir: 'specs/001-demo' });
            expect(out.length).toBeLessThan(1500);
        }
    });

    it('preamble includes canonical status lifecycle', () => {
        mockConfig(true);
        const out = buildPrompt({ command: 'x', step: 'specify', specDir: 'specs/001-demo' });
        expect(out).toContain('Canonical statuses:');
        expect(out).toContain('ready-to-implement');
    });
});

describe('buildLifecyclePrompt', () => {
    const originalGetConfig = vscode.workspace.getConfiguration;

    function mockConfig(enabled: boolean): void {
        (vscode.workspace as unknown as { getConfiguration: unknown }).getConfiguration = jest
            .fn()
            .mockReturnValue({ get: jest.fn().mockReturnValue(enabled) });
    }

    afterEach(() => {
        (vscode.workspace as unknown as { getConfiguration: unknown }).getConfiguration = originalGetConfig;
    });

    it('wraps command with lifecycle preamble', () => {
        mockConfig(true);
        const out = buildLifecyclePrompt('/sdd:auto "specs/001"', 'specs/001');
        expect(out).toContain('<!-- speckit-companion:context-update -->');
        expect(out).toContain('keep');
        expect(out).toContain('specs/001/.spec-context.json');
        expect(out).toContain('Canonical statuses:');
        expect(out).toContain('/sdd:auto "specs/001"');
    });

    it('returns raw command when disabled', () => {
        mockConfig(false);
        const cmd = '/sdd:auto "specs/001"';
        expect(buildLifecyclePrompt(cmd, 'specs/001')).toBe(cmd);
    });
});
