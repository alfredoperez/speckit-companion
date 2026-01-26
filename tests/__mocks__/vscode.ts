/**
 * Mock for VS Code module
 * Provides minimal mocks for testing
 */

export const Uri = {
  file: (path: string) => ({ fsPath: path, scheme: 'file' }),
  parse: (uri: string) => ({ fsPath: uri, scheme: 'file' }),
};

export const workspace = {
  workspaceFolders: [],
  getConfiguration: () => ({
    get: () => undefined,
    update: () => Promise.resolve(),
  }),
};

export const window = {
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  createOutputChannel: () => ({
    appendLine: jest.fn(),
    show: jest.fn(),
    dispose: jest.fn(),
  }),
};

export const commands = {
  registerCommand: jest.fn(),
  executeCommand: jest.fn(),
};

export const EventEmitter = jest.fn().mockImplementation(() => ({
  event: jest.fn(),
  fire: jest.fn(),
  dispose: jest.fn(),
}));

export const TreeItem = jest.fn();
export const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
};

export const ThemeIcon = jest.fn();
