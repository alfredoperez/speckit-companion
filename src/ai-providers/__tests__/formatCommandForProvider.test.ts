import * as vscode from 'vscode';
import { formatCommandForProvider, PROVIDER_PATHS } from '../aiProvider';
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
});
