/* eslint-disable @typescript-eslint/no-explicit-any */

export enum FileType {
    Unknown = 0,
    File = 1,
    Directory = 2,
    SymbolicLink = 64,
}

export enum TreeItemCollapsibleState {
    None = 0,
    Collapsed = 1,
    Expanded = 2,
}

export class ThemeColor {
    constructor(public readonly id: string) {}
}

export class ThemeIcon {
    constructor(public readonly id: string, public readonly color?: ThemeColor) {}
}

export class TreeItem {
    label: string;
    collapsibleState: TreeItemCollapsibleState;
    iconPath?: any;
    tooltip?: string;
    description?: string;
    contextValue?: string;
    command?: any;
    resourceUri?: any;

    constructor(label: string, collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.None) {
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}

export class EventEmitter<T> {
    private listeners: Array<(e: T) => void> = [];

    event = (listener: (e: T) => void) => {
        this.listeners.push(listener);
        return { dispose: () => { this.listeners = this.listeners.filter(l => l !== listener); } };
    };

    fire(data?: T): void {
        for (const listener of this.listeners) {
            listener(data as T);
        }
    }

    dispose(): void {
        this.listeners = [];
    }
}

export class Uri {
    readonly scheme: string;
    readonly fsPath: string;
    readonly path: string;

    private constructor(fsPath: string) {
        this.scheme = 'file';
        this.fsPath = fsPath;
        this.path = fsPath;
    }

    static file(path: string): Uri {
        return new Uri(path);
    }

    static parse(value: string): Uri {
        // The mock keeps the parsed value verbatim so toString() round-trips it
        // (real vscode.Uri.parse preserves scheme/authority/query).
        return new Uri(value);
    }

    static joinPath(base: Uri, ...pathSegments: string[]): Uri {
        const joined = [base.fsPath, ...pathSegments].join('/');
        return new Uri(joined);
    }

    toString(): string {
        return this.fsPath;
    }
}

export class RelativePattern {
    base: string;
    pattern: string;

    constructor(base: string | { uri: Uri }, pattern: string) {
        this.base = typeof base === 'string' ? base : base.uri.fsPath;
        this.pattern = pattern;
    }
}

export enum ConfigurationTarget {
    Global = 1,
    Workspace = 2,
    WorkspaceFolder = 3,
}

export enum QuickPickItemKind {
    Separator = -1,
    Default = 0,
}

/**
 * A capturing FileSystemWatcher stub. Records the glob it was registered for
 * and the listeners passed to each `onDid*`, exposing `fire*` helpers so a test
 * can drive a change/create/delete through the registered handlers.
 */
export function createMockFileSystemWatcher(pattern: any) {
    const handlers: { change: any[]; create: any[]; delete: any[] } = {
        change: [],
        create: [],
        delete: [],
    };
    const register = (bucket: any[]) => (cb: any) => {
        bucket.push(cb);
        return { dispose: jest.fn() };
    };
    return {
        pattern,
        onDidChange: jest.fn(register(handlers.change)),
        onDidCreate: jest.fn(register(handlers.create)),
        onDidDelete: jest.fn(register(handlers.delete)),
        dispose: jest.fn(),
        __handlers: handlers,
        fireChange: (uri: any) => Promise.all(handlers.change.map(cb => cb(uri))),
        fireCreate: (uri: any) => Promise.all(handlers.create.map(cb => cb(uri))),
        fireDelete: (uri: any) => Promise.all(handlers.delete.map(cb => cb(uri))),
    };
}

export const workspace = {
    fs: {
        readDirectory: jest.fn().mockResolvedValue([]),
        stat: jest.fn().mockRejectedValue(new Error('not found')),
        readFile: jest.fn().mockResolvedValue(new Uint8Array()),
        writeFile: jest.fn().mockResolvedValue(undefined),
        createDirectory: jest.fn().mockResolvedValue(undefined),
        copy: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
    },
    workspaceFolders: undefined as any,
    findFiles: jest.fn().mockResolvedValue([]),
    createFileSystemWatcher: jest.fn().mockImplementation(createMockFileSystemWatcher),
    getConfiguration: jest.fn().mockReturnValue({
        get: jest.fn().mockReturnValue(['specs']),
    }),
};

export const window = {
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInputBox: jest.fn(),
    showQuickPick: jest.fn(),
    showTextDocument: jest.fn(),
    activeTextEditor: undefined as any,
    createTerminal: jest.fn().mockReturnValue({ show: jest.fn(), sendText: jest.fn() }),
    onDidCloseTerminal: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    createOutputChannel: jest.fn().mockReturnValue({
        appendLine: jest.fn(),
        show: jest.fn(),
        dispose: jest.fn(),
    }),
};

export const commands = {
    registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    executeCommand: jest.fn(),
    getCommands: jest.fn().mockResolvedValue([]),
};

export const extensions = {
    getExtension: jest.fn(),
};

export const env = {
    openExternal: jest.fn(),
    shell: '' as string,
    appName: '' as string,
    uriScheme: '' as string,
    clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
    },
};
