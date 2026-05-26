import * as vscode from 'vscode';
import { buildPrompt, buildLifecyclePrompt, buildSpecifyCreationPreamble } from '../promptBuilder';

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
                expect(out).toContain(`currentStep = "${step}"`);
                expect(out.endsWith('/speckit.' + step + ' specs/001-demo')).toBe(true);
            }
        });

        it('instructs the model not to write stepHistory and to use real timestamps', () => {
            const out = buildPrompt({ command: 'x', step: 'plan', specDir: 'specs/001-demo' });
            expect(out).toContain('stepHistory is READ-ONLY');
            expect(out).toContain('date -u +"%Y-%m-%dT%H:%M:%SZ"');
        });

        it('lists canonical substeps for the given step', () => {
            const out = buildPrompt({ command: '/speckit.plan x', step: 'plan', specDir: 'specs/001-demo' });
            expect(out).toContain('Canonical substeps for plan: research, design');
        });

        it('documents the task_summaries field shapes (spec 095)', () => {
            const out = buildPrompt({
                command: '/speckit.implement x',
                step: 'implement',
                specDir: 'specs/001-demo',
            });
            // status vocabulary is explicit
            expect(out).toContain('"DONE" or "DONE_WITH_CONCERNS"');
            // concerns + files must be string[]
            expect(out).toContain('concerns is string[]');
            expect(out).toContain('files is string[]');
            // empty concerns must be omitted, never a sentinel string
            expect(out).toContain('Omit concerns when empty');
            expect(out).toContain('never write "None"/"N/A"');
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

    it('preamble stays under ~2600 chars per step', () => {
        mockConfig(true);
        for (const step of ['specify', 'plan', 'tasks', 'implement'] as const) {
            const out = buildPrompt({ command: 'x', step, specDir: 'specs/001-demo' });
            expect(out.length).toBeLessThan(2600);
        }
    });

    it('preamble includes canonical status lifecycle', () => {
        mockConfig(true);
        const out = buildPrompt({ command: 'x', step: 'specify', specDir: 'specs/001-demo' });
        expect(out).toContain('Canonical statuses:');
        expect(out).toContain('ready-to-implement');
    });

    it('instructs the model to advance currentStep to the next step on completion', () => {
        mockConfig(true);
        const cases: Array<{ step: 'specify' | 'plan' | 'tasks'; next: string }> = [
            { step: 'specify', next: 'plan' },
            { step: 'plan', next: 'tasks' },
            { step: 'tasks', next: 'implement' },
        ];
        for (const { step, next } of cases) {
            const out = buildPrompt({ command: 'x', step, specDir: 'specs/001-demo' });
            expect(out).toContain(`Set currentStep to "${next}"`);
            expect(out).toContain('specify → plan → tasks → implement');
        }
    });

    it('instructs the model NOT to advance currentStep after the implement step', () => {
        mockConfig(true);
        const out = buildPrompt({ command: 'x', step: 'implement', specDir: 'specs/001-demo' });
        expect(out).toContain('Leave currentStep on "implement"');
        expect(out).toContain('terminal step');
        expect(out).not.toContain('Set currentStep to "');
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

    it('instructs the model to advance currentStep across the canonical sequence', () => {
        mockConfig(true);
        const out = buildLifecyclePrompt('/sdd:auto "specs/001"', 'specs/001');
        expect(out).toContain('set currentStep to the next step in the canonical sequence specify → plan → tasks → implement');
        expect(out).toContain('After implement, leave currentStep on "implement"');
    });
});

describe('buildSpecifyCreationPreamble', () => {
    const originalGetConfig = vscode.workspace.getConfiguration;

    function mockConfig(enabled: boolean): void {
        (vscode.workspace as unknown as { getConfiguration: unknown }).getConfiguration = jest
            .fn()
            .mockReturnValue({ get: jest.fn().mockReturnValue(enabled) });
    }

    afterEach(() => {
        (vscode.workspace as unknown as { getConfiguration: unknown }).getConfiguration = originalGetConfig;
    });

    it('emits the marker block when enabled', () => {
        mockConfig(true);
        const out = buildSpecifyCreationPreamble('speckit', null);
        expect(out).toContain('<!-- speckit-companion:context-update -->');
        expect(out).toContain('<!-- /speckit-companion:context-update -->');
    });

    it('includes the workflow name passed in', () => {
        mockConfig(true);
        const out = buildSpecifyCreationPreamble('sdd', null);
        expect(out).toContain('"workflow": "sdd"');
    });

    it('seeds a transition attributed to "extension"', () => {
        mockConfig(true);
        const out = buildSpecifyCreationPreamble('speckit', null);
        expect(out).toContain('"step": "specify"');
        expect(out).toContain('"by": "extension"');
        expect(out).toContain('"from": { "step": null, "substep": null }');
    });

    it('includes lifecycle framing so chat history carries rules forward', () => {
        mockConfig(true);
        const out = buildSpecifyCreationPreamble('speckit', null);
        expect(out).toContain('For EACH step you work on');
        expect(out).toContain('specify, plan, tasks, implement');
    });

    it('carries the advance-currentStep rule into the seeded creation preamble', () => {
        mockConfig(true);
        const out = buildSpecifyCreationPreamble('speckit', null);
        expect(out).toContain('set currentStep to the next step in the canonical sequence specify → plan → tasks → implement');
        expect(out).toContain('After implement, leave currentStep on "implement"');
    });

    it('includes the date -u timestamp rule from SHARED_RULES', () => {
        mockConfig(true);
        const out = buildSpecifyCreationPreamble('speckit', null);
        expect(out).toContain('date -u +"%Y-%m-%dT%H:%M:%SZ"');
    });

    it('reminds that stepHistory is read-only', () => {
        mockConfig(true);
        const out = buildSpecifyCreationPreamble('speckit', null);
        expect(out).toContain('stepHistory is READ-ONLY');
        expect(out).toContain('"stepHistory": {},');
    });

    it('uses <specDir> placeholder when dir is unknown', () => {
        mockConfig(true);
        const out = buildSpecifyCreationPreamble('speckit', null);
        expect(out).toContain('<specDir>/.spec-context.json');
    });

    it('substitutes the real spec dir when provided', () => {
        mockConfig(true);
        const out = buildSpecifyCreationPreamble('speckit', 'specs/108-demo');
        expect(out).toContain('specs/108-demo/.spec-context.json');
        expect(out).not.toContain('<specDir>/.spec-context.json');
    });

    it('returns empty string when disabled', () => {
        mockConfig(false);
        expect(buildSpecifyCreationPreamble('speckit', null)).toBe('');
    });
});
