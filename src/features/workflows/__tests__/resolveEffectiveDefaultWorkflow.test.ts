import { pickEffectiveDefaultWorkflow } from '../workflowManager';

describe('pickEffectiveDefaultWorkflow', () => {
    describe('when speckit.defaultWorkflow is unset', () => {
        const unset = { globalValue: undefined, workspaceValue: undefined, workspaceFolderValue: undefined };

        it('resolves to companion when the companion extension is installed', () => {
            expect(pickEffectiveDefaultWorkflow(unset, true)).toBe('companion');
        });

        it('resolves to speckit when the companion extension is not installed', () => {
            expect(pickEffectiveDefaultWorkflow(unset, false)).toBe('speckit');
        });

        it('resolves to speckit when inspect returns undefined (no scopes at all)', () => {
            expect(pickEffectiveDefaultWorkflow(undefined, false)).toBe('speckit');
            expect(pickEffectiveDefaultWorkflow(undefined, true)).toBe('companion');
        });

        it('treats a schema defaultValue (no user value) as unset', () => {
            const schemaDefaultOnly = { globalValue: undefined, workspaceValue: undefined, workspaceFolderValue: undefined };
            expect(pickEffectiveDefaultWorkflow(schemaDefaultOnly, true)).toBe('companion');
        });

        it('treats an empty-string scope value as unset', () => {
            expect(pickEffectiveDefaultWorkflow({ globalValue: '' }, true)).toBe('companion');
        });
    });

    describe('when speckit.defaultWorkflow is explicitly set', () => {
        it('returns explicit speckit even when the extension is installed', () => {
            expect(pickEffectiveDefaultWorkflow({ globalValue: 'speckit' }, true)).toBe('speckit');
        });

        it('returns explicit companion', () => {
            expect(pickEffectiveDefaultWorkflow({ globalValue: 'companion' }, false)).toBe('companion');
        });

        it('returns an explicit custom workflow name verbatim', () => {
            expect(pickEffectiveDefaultWorkflow({ workspaceValue: 'my-custom-flow' }, true)).toBe('my-custom-flow');
        });

        it('prefers the most-specific scope (workspaceFolder over workspace over global)', () => {
            expect(
                pickEffectiveDefaultWorkflow(
                    { globalValue: 'speckit', workspaceValue: 'companion', workspaceFolderValue: 'my-custom-flow' },
                    false
                )
            ).toBe('my-custom-flow');
            expect(
                pickEffectiveDefaultWorkflow({ globalValue: 'speckit', workspaceValue: 'companion' }, false)
            ).toBe('companion');
        });
    });
});
