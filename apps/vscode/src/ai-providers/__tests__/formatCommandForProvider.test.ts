import * as vscode from 'vscode';
import { formatCommandForProvider, toSlashCommand, PROVIDER_PATHS } from '../aiProvider';
import { AIProviders } from '../../core/constants';

describe('formatCommandForProvider', () => {
    const command = 'speckit.specify';

    function mockCommandFormat(value: string) {
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn((key: string, defaultValue?: unknown) => {
                if (key === 'commandFormat') {
                    return value;
                }
                return defaultValue;
            }),
        });
    }

    describe('when commandFormat is "dash"', () => {
        beforeEach(() => mockCommandFormat('dash'));

        it('should override a dot-default provider (Gemini) to return dash notation', () => {
            expect(PROVIDER_PATHS[AIProviders.GEMINI].commandFormat).toBe('dot');
            expect(formatCommandForProvider(command, AIProviders.GEMINI)).toBe('speckit-specify');
        });

        it('should keep dash notation for a dash-default provider (Claude)', () => {
            expect(formatCommandForProvider(command, AIProviders.CLAUDE)).toBe('speckit-specify');
        });
    });

    describe('when commandFormat is "dot"', () => {
        beforeEach(() => mockCommandFormat('dot'));

        it('should override a dash-default provider (Claude) to return dot notation', () => {
            expect(PROVIDER_PATHS[AIProviders.CLAUDE].commandFormat).toBe('dash');
            expect(formatCommandForProvider(command, AIProviders.CLAUDE)).toBe('speckit.specify');
        });

        it('should keep dot notation for a dot-default provider (Gemini)', () => {
            expect(formatCommandForProvider(command, AIProviders.GEMINI)).toBe('speckit.specify');
        });
    });

    describe('namespaced companion commands', () => {
        it('dash-converts every dot so the name matches the registered skill (Claude)', () => {
            mockCommandFormat('auto');
            expect(formatCommandForProvider('speckit.companion.specify', AIProviders.CLAUDE)).toBe('speckit-companion-specify');
            expect(formatCommandForProvider('speckit.companion.plan', AIProviders.CLAUDE)).toBe('speckit-companion-plan');
        });

        it('keeps the dot form for a dot-default provider (Gemini)', () => {
            mockCommandFormat('auto');
            expect(formatCommandForProvider('speckit.companion.specify', AIProviders.GEMINI)).toBe('speckit.companion.specify');
        });

        it('leaves a non-speckit custom command untouched even in dash mode', () => {
            mockCommandFormat('dash');
            expect(formatCommandForProvider('myteam.custom', AIProviders.CLAUDE)).toBe('myteam.custom');
        });
    });

    describe('when commandFormat is "auto" (default)', () => {
        beforeEach(() => mockCommandFormat('auto'));

        it('should use dash notation for Claude', () => {
            expect(formatCommandForProvider(command, AIProviders.CLAUDE)).toBe('speckit-specify');
        });

        it('should use dash notation for Codex', () => {
            expect(formatCommandForProvider(command, AIProviders.CODEX)).toBe('speckit-specify');
        });

        it('should use dot notation for Gemini', () => {
            expect(formatCommandForProvider(command, AIProviders.GEMINI)).toBe('speckit.specify');
        });

        it('should use dot notation for Copilot', () => {
            expect(formatCommandForProvider(command, AIProviders.COPILOT)).toBe('speckit.specify');
        });

        it('should use dot notation for Qwen', () => {
            expect(formatCommandForProvider(command, AIProviders.QWEN)).toBe('speckit.specify');
        });
    });

    describe('toSlashCommand', () => {
        it('adds the slash and converts every dot for a dash host', () => {
            expect(toSlashCommand('speckit.companion.living-adopt', AIProviders.CLAUDE))
                .toBe('/speckit-companion-living-adopt');
        });

        it('converts a command that already carries its slash', () => {
            expect(toSlashCommand('/speckit.companion.living-sync', AIProviders.CLAUDE))
                .toBe('/speckit-companion-living-sync');
        });

        it('leaves the argument alone, dots and all', () => {
            expect(toSlashCommand('/speckit.companion.plan specs/172-nodes/plan.md', AIProviders.CLAUDE))
                .toBe('/speckit-companion-plan specs/172-nodes/plan.md');
        });

        it('keeps dot form on a host that registers dots', () => {
            expect(toSlashCommand('speckit.companion.plan', AIProviders.GEMINI))
                .toBe('/speckit.companion.plan');
        });

        it('is idempotent, so a caller that already formatted is not mangled', () => {
            expect(toSlashCommand('/speckit-companion-plan', AIProviders.CLAUDE))
                .toBe('/speckit-companion-plan');
        });
    });
});
