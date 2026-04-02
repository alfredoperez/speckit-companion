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

export const workspace = {
    fs: {
        readDirectory: jest.fn().mockResolvedValue([]),
        stat: jest.fn().mockRejectedValue(new Error('not found')),
    },
    findFiles: jest.fn().mockResolvedValue([]),
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
    createOutputChannel: jest.fn().mockReturnValue({
        appendLine: jest.fn(),
        show: jest.fn(),
        dispose: jest.fn(),
    }),
};

export const commands = {
    registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    executeCommand: jest.fn(),
};

export const extensions = {
    getExtension: jest.fn(),
};

export const env = {
    openExternal: jest.fn(),
};
