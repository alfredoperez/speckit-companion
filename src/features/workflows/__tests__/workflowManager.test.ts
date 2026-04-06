import * as vscode from 'vscode';

// Mock the VS Code config to control getWorkflows() behavior
const mockGetConfig = jest.fn();
(vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
    get: mockGetConfig,
});

import { getWorkflowCommands } from '../workflowManager';

describe('getWorkflowCommands', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetConfig.mockReturnValue([]);
    });

    it('should return commands array from a custom workflow', () => {
        const commands = [
            { name: 'auto', title: 'Auto Mode', command: '/sdd:auto', step: 'specify' },
        ];
        mockGetConfig.mockReturnValue([
            { name: 'sdd', steps: [{ name: 'specify', command: 'sdd.specify' }], commands },
        ]);

        const result = getWorkflowCommands('sdd');

        expect(result).toEqual(commands);
    });

    it('should return empty array when workflow has no commands', () => {
        mockGetConfig.mockReturnValue([
            { name: 'sdd', steps: [{ name: 'specify', command: 'sdd.specify' }] },
        ]);

        const result = getWorkflowCommands('sdd');

        expect(result).toEqual([]);
    });

    it('should return empty array when workflow is not found', () => {
        mockGetConfig.mockReturnValue([]);

        const result = getWorkflowCommands('nonexistent');

        expect(result).toEqual([]);
    });

    it('should return empty array for the default workflow (no commands)', () => {
        mockGetConfig.mockReturnValue([]);

        const result = getWorkflowCommands('speckit');

        expect(result).toEqual([]);
    });
});
