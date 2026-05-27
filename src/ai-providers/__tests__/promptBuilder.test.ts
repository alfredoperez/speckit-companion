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

        it('warns against writing the deprecated stepHistory/transitions fields, and requires real timestamps', () => {
            const out = buildPrompt({ command: 'x', step: 'plan', specDir: 'specs/001-demo' });
            expect(out).toContain('Do NOT write `stepHistory` or `transitions`');
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

    it('preamble stays under ~5500 chars per step (schema-inclusive budget)', () => {
        // After embedding the JSON Schema contract, preambles run ~4.5k chars.
        // Bound kept generous-but-finite to catch unintentional bloat.
        mockConfig(true);
        for (const step of ['specify', 'plan', 'tasks', 'implement'] as const) {
            const out = buildPrompt({ command: 'x', step, specDir: 'specs/001-demo' });
            expect(out.length).toBeLessThan(5500);
        }
    });

    it('embeds a JSON Schema for .spec-context.json', () => {
        mockConfig(true);
        const out = buildPrompt({ command: 'x', step: 'plan', specDir: 'specs/001-demo' });
        expect(out).toContain('```jsonschema');
        expect(out).toContain('"required": ["workflow", "specName", "currentStep", "status", "history"]');
        expect(out).toContain('`history` is APPEND-ONLY');
        expect(out).toContain('last `history[]` entry');
    });

    it('preamble includes canonical status lifecycle', () => {
        mockConfig(true);
        const out = buildPrompt({ command: 'x', step: 'specify', specDir: 'specs/001-demo' });
        expect(out).toContain('Canonical statuses:');
        expect(out).toContain('ready-to-implement');
    });

    it('instructs the model to LEAVE currentStep on the current step (per-step commands do not advance)', () => {
        // Per-step preambles (one call to /speckit.<step>) finish when the
        // step is done. The AI must NOT preemptively advance currentStep or
        // append a start-entry for the next step — that's the user's click
        // (or the extension's startStep) to make. Doing so creates the
        // phantom "Generating <next>…" state the schema cleanup exists to
        // prevent.
        mockConfig(true);
        for (const step of ['specify', 'plan', 'tasks', 'implement'] as const) {
            const out = buildPrompt({ command: 'x', step, specDir: 'specs/001-demo' });
            expect(out).toContain(`Leave currentStep on "${step}"`);
            expect(out).not.toContain('ATOMICALLY (in the same write');
            expect(out).not.toContain('append a start history entry');
        }
    });

    // F8 regression: the implement step finishes at status="implemented",
    // NOT "completed". The user owns the final closure click. The preamble
    // must not instruct Copilot to write "completed" (the previous
    // misconfiguration that bypassed the Mark-Completed gate).
    it('instructs the implement step to finish at status="implemented", not "completed"', () => {
        mockConfig(true);
        const out = buildPrompt({ command: 'x', step: 'implement', specDir: 'specs/001-demo' });
        expect(out).toContain('Flip status to "implemented"');
        expect(out).not.toContain('Flip status to "completed"');
        // And the prose explicitly explains why.
        expect(out).toContain('the implement step completes at "implemented"');
        expect(out).toContain("user's final approval gate");
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

    it('does NOT instruct preemptive advance — start-entry coincides with the AI actually starting that step', () => {
        // The old (item 4) rule told the AI to atomically append the next
        // step's start-entry at the *completion* of the previous step. That
        // produces a phantom "Generating <next>…" state when the AI doesn't
        // actually continue (e.g. spec-editor "Create" dispatch is one-shot).
        // The new rule: the start-entry must coincide with the AI actually
        // beginning that step (item 1), not with finishing the previous one.
        mockConfig(true);
        const out = buildLifecyclePrompt('/sdd:auto "specs/001"', 'specs/001');
        expect(out).not.toContain('ATOMICALLY (same write as the completion entry)');
        expect(out).not.toContain('set currentStep to the next step in the canonical sequence');
        // And it explicitly warns against the phantom state.
        expect(out).toContain('Do NOT preemptively write a start-entry for the next step');
        expect(out).toContain('phantom "Generating <next>…" state');
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

    it('seeds a history entry attributed to "extension"', () => {
        mockConfig(true);
        const out = buildSpecifyCreationPreamble('speckit', null);
        expect(out).toContain('"step": "specify"');
        expect(out).toContain('"by": "extension"');
        expect(out).toContain('"from": { "step": null, "substep": null }');
        // The seed must go into `history`, not the deprecated `transitions` field.
        expect(out).toContain('"history": [');
        expect(out).not.toContain('"transitions": [');
    });

    it('includes lifecycle framing so chat history carries rules forward', () => {
        mockConfig(true);
        const out = buildSpecifyCreationPreamble('speckit', null);
        expect(out).toContain('For EACH step you work on');
        expect(out).toContain('specify, plan, tasks, implement');
    });

    it('does NOT carry an atomic-advance rule (start-entry coincides with the AI starting the next step)', () => {
        // Regression: previously this preamble told the AI to atomically
        // append the next step's start-entry on completion of the current
        // step. For the spec-editor's "Create" dispatch — which is
        // single-step — that produced a phantom plan-start entry the
        // moment specify finished. The lifecycle body must instead tie
        // start-entries to actually-starting the next step.
        mockConfig(true);
        const out = buildSpecifyCreationPreamble('speckit', null);
        expect(out).not.toContain('ATOMICALLY (same write as the completion entry)');
        expect(out).not.toContain('set currentStep to the next step in the canonical sequence');
        expect(out).toContain('Do NOT preemptively write a start-entry for the next step');
    });

    it('includes the date -u timestamp rule from SHARED_RULES', () => {
        mockConfig(true);
        const out = buildSpecifyCreationPreamble('speckit', null);
        expect(out).toContain('date -u +"%Y-%m-%dT%H:%M:%SZ"');
    });

    it('warns against writing deprecated stepHistory/transitions and seeds only history', () => {
        mockConfig(true);
        const out = buildSpecifyCreationPreamble('speckit', null);
        expect(out).toContain('Do NOT write `stepHistory` or `transitions`');
        expect(out).not.toContain('"stepHistory": {}');
        expect(out).not.toContain('"transitions": [');
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
