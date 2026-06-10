import * as vscode from 'vscode';
import {
    buildPrompt,
    buildLifecyclePrompt,
    buildSpecifyCreationPreamble,
    rewriteImageRefsToStaged,
} from '../promptBuilder';

describe('rewriteImageRefsToStaged (#208)', () => {
    it('swaps each markdown image target from its source path to the staged path', () => {
        const src = '/gs/spec-editor/t1/images/a.png';
        const staged = '/Users/x/project/.speckit-companion/spec-editor/s1/images/a.png';
        const body = `intro\n\n![alt](${src})\n\nmore`;

        expect(rewriteImageRefsToStaged(body, { [src]: staged }))
            .toBe(`intro\n\n![alt](${staged})\n\nmore`);
    });

    it('rewrites every occurrence of a repeated source path', () => {
        const src = '/gs/i.png';
        const staged = '/ws/.speckit-companion/i.png';
        const body = `![a](${src}) and ![b](${src})`;

        expect(rewriteImageRefsToStaged(body, { [src]: staged }))
            .toBe(`![a](${staged}) and ![b](${staged})`);
    });

    it('leaves a body without the source link untouched', () => {
        const body = 'no images here';
        expect(rewriteImageRefsToStaged(body, { '/gs/x.png': '/ws/x.png' })).toBe(body);
    });

    it('is a no-op for an empty mapping', () => {
        const body = '![a](/gs/x.png)';
        expect(rewriteImageRefsToStaged(body, {})).toBe(body);
    });

    it('does not rewrite a bare path occurrence outside a markdown link target', () => {
        const src = '/gs/x.png';
        const staged = '/ws/x.png';
        // The path appears in prose, not as `](path)`. Left alone.
        const body = `the file at ${src} is attached`;
        expect(rewriteImageRefsToStaged(body, { [src]: staged })).toBe(body);
    });
});

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
            for (const step of ['specify', 'clarify', 'plan', 'tasks', 'analyze', 'implement'] as const) {
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

        it('emits analyze preamble that finishes at ready-to-implement (sub-phase of tasks, must not regress)', () => {
            const out = buildPrompt({
                command: '/speckit.analyze specs/001-demo',
                step: 'analyze',
                specDir: 'specs/001-demo',
            });
            expect(out).toContain('Flip status to "ready-to-implement"');
            expect(out).toContain('Done analyzing');
        });

        it('emits clarify preamble that finishes at specified (sub-phase of specify)', () => {
            const out = buildPrompt({
                command: '/speckit.clarify specs/001-demo',
                step: 'clarify',
                specDir: 'specs/001-demo',
            });
            expect(out).toContain('Flip status to "specified"');
            expect(out).toContain('Done clarifying');
        });

        it('renders an empty-substep line for single-pass steps (analyze, clarify)', () => {
            for (const step of ['analyze', 'clarify'] as const) {
                const out = buildPrompt({ command: 'x', step, specDir: 'specs/001-demo' });
                expect(out).toContain(`Canonical substeps for ${step}: none — single-pass step.`);
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

        it('tells implement to journal each task finish via a script (finish-only)', () => {
            const out = buildPrompt({
                command: '/speckit.implement x',
                step: 'implement',
                specDir: 'specs/001-demo',
            });
            // Finish-only: one script-stamped finish per task (reliable + honest deltas),
            // no per-task start, no hand-authored JSON.
            expect(out).toContain('finish-only');
            expect(out).toContain('--task <TaskID> --kind complete --by ai');
            expect(out).toContain('--feature-dir specs/001-demo');
            expect(out).toContain('task_summaries');
            // implement still does not self-close the STEP — the hook closes it.
            expect(out).not.toContain('Flip status to "implemented"');
            expect(out).toContain('do NOT append a step-level "complete" entry for implement');
        });

        it('records each substep as a single finish (no start, no shared timestamp)', () => {
            const out = buildPrompt({ command: 'x', step: 'plan', specDir: 'specs/001-demo' });
            expect(out).toContain('SINGLE finish entry');
            expect(out).toContain('never two sharing a timestamp');
        });

        it('the multi-step lifecycle prompt journals per-task finishes via the script', () => {
            const out = buildLifecyclePrompt('/sdd:auto x', 'specs/001-demo');
            expect(out).toContain('--task <TaskID> --kind complete --by ai');
            expect(out).toContain('--feature-dir specs/001-demo');
        });

        it('specify does not self-close in the preamble — its command records completion', () => {
            const out = buildPrompt({ command: 'x', step: 'specify', specDir: 'specs/001-demo' });
            expect(out).not.toContain('Flip status to "specified"');
            expect(out).toContain('do NOT append a step-level "complete" entry for specify');
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

    it('preamble stays under ~6500 chars per step (schema-inclusive budget)', () => {
        // After embedding the JSON Schema contract + authorship/dispatch-time rules
        // (round 3, F10/F14), preambles run ~6k chars. Bound kept generous-but-finite
        // to catch unintentional bloat.
        mockConfig(true);
        for (const step of ['specify', 'clarify', 'plan', 'tasks', 'analyze', 'implement'] as const) {
            const out = buildPrompt({ command: 'x', step, specDir: 'specs/001-demo' });
            expect(out.length).toBeLessThan(6500);
        }
    });

    it('embeds a JSON Schema for .spec-context.json', () => {
        mockConfig(true);
        const out = buildPrompt({ command: 'x', step: 'plan', specDir: 'specs/001-demo' });
        expect(out).toContain('```jsonschema');
        expect(out).toContain('"required": ["workflow", "specName", "currentStep", "status", "history"]');
        expect(out).toContain('`history` is APPEND-ONLY');
        expect(out).toContain('last `history[]` entry');
        // workflow is now an open string type, no longer an enum of speckit/sdd.
        expect(out).toContain('"workflow":    { "type": "string" }');
        expect(out).not.toContain('"enum": ["speckit", "sdd"]');
        // history `by` enum dropped the sdd-skill author; it's now extension/user/cli/ai.
        expect(out).toContain('"by":      { "enum": ["extension","user","cli","ai"] }');
        expect(out).not.toContain('sdd-skill');
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
        for (const step of ['specify', 'clarify', 'plan', 'tasks', 'analyze', 'implement'] as const) {
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
    it('keeps the implement step at "implemented", never "completed" (F8), and lets the hook close it', () => {
        mockConfig(true);
        const out = buildPrompt({ command: 'x', step: 'implement', specDir: 'specs/001-demo' });
        // The AI no longer flips implement status — the end-of-step hook does.
        expect(out).not.toContain('Flip status to "implemented"');
        expect(out).not.toContain('Flip status to "completed"');
        // The implemented-vs-completed distinction stays in the status lifecycle.
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
        const out = buildLifecyclePrompt('/speckit.implement "specs/001"', 'specs/001');
        expect(out).toContain('<!-- speckit-companion:context-update -->');
        expect(out).toContain('keep');
        expect(out).toContain('specs/001/.spec-context.json');
        expect(out).toContain('Canonical statuses:');
        expect(out).toContain('/speckit.implement "specs/001"');
    });

    it('returns raw command when disabled', () => {
        mockConfig(false);
        const cmd = '/speckit.implement "specs/001"';
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
        const out = buildLifecyclePrompt('/speckit.implement "specs/001"', 'specs/001');
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
        const out = buildSpecifyCreationPreamble('custom-flow', null);
        expect(out).toContain('"workflow": "custom-flow"');
    });

    it('seeds a history entry attributed to "extension"', () => {
        mockConfig(true);
        const out = buildSpecifyCreationPreamble('speckit', null);
        expect(out).toContain('"step": "specify"');
        expect(out).toContain('"by": "extension"');
        // The writer no longer emits `from` — the seed entry must not carry it.
        expect(out).not.toContain('"from"');
        // The seed must go into `history`, not the deprecated `transitions` field.
        expect(out).toContain('"history": [');
        expect(out).not.toContain('"transitions": [');
    });

    it('includes lifecycle framing so chat history carries rules forward', () => {
        mockConfig(true);
        const out = buildSpecifyCreationPreamble('speckit', null);
        expect(out).toContain('For EACH step you work on');
        expect(out).toContain('specify, clarify, plan, tasks, analyze, implement');
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

    it('does NOT pin a profile in the seed JSON by default (preserves today\'s behavior)', () => {
        mockConfig(true);
        const out = buildSpecifyCreationPreamble('speckit', null);
        expect(out).not.toContain('"profile": "turbo"');
    });

    it('pins profile: turbo in the seed JSON when the turbo option was picked', () => {
        mockConfig(true);
        const out = buildSpecifyCreationPreamble('speckit-turbo', null, 'turbo');
        expect(out).toContain('"profile": "turbo"');
        // And instructs the model to keep it.
        expect(out).toContain('the user picked turbo for this spec at creation');
    });

    it('does NOT pin turbo when profile is explicitly standard', () => {
        mockConfig(true);
        const out = buildSpecifyCreationPreamble('speckit', null, 'standard');
        expect(out).not.toContain('"profile": "turbo"');
    });
});
