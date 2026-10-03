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

    constructor(base: string | Uri | { uri: Uri }, pattern: string) {
        if (typeof base === 'string') {
            this.base = base;
        } else if ('fsPath' in base) {
            this.base = base.fsPath;
        } else {
            this.base = base.uri.fsPath;
        }
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

const workspaceFoldersEmitter = new EventEmitter<any>();
const configurationEmitter = new EventEmitter<any>();

/** Report a workspace-folder change, as `onDidChangeWorkspaceFolders` would. */
export function __fireWorkspaceFoldersChange(): void {
    workspaceFoldersEmitter.fire({ added: [], removed: [] });
}

/** Report a settings change touching the given keys, as `onDidChangeConfiguration` would. */
export function __fireConfigurationChange(...keys: string[]): void {
    configurationEmitter.fire({
        affectsConfiguration: (section: string) => keys.some(k => k === section || k.startsWith(`${section}.`)),
    });
}

function currentFolders(): any[] | undefined {
    return (workspace as { workspaceFolders?: any[] }).workspaceFolders;
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
    // Faithful enough for path-owner resolution: the folder whose fsPath prefixes the uri.
    getWorkspaceFolder: jest.fn((uri: any): any =>
        currentFolders()?.find(
            (f: any) => typeof uri?.fsPath === 'string' && uri.fsPath.startsWith(f.uri.fsPath)
        )
    ),
    onDidChangeWorkspaceFolders: jest.fn(workspaceFoldersEmitter.event),
    onDidChangeConfiguration: jest.fn(configurationEmitter.event),
    openTextDocument: jest.fn().mockResolvedValue({}),
    onDidSaveTextDocument: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    findFiles: jest.fn().mockResolvedValue([]),
    createFileSystemWatcher: jest.fn().mockImplementation(createMockFileSystemWatcher),
    getConfiguration: jest.fn().mockReturnValue({
        get: jest.fn().mockReturnValue(['specs']),
        inspect: jest.fn().mockReturnValue(undefined),
    }),
};

export class Position {
    constructor(public readonly line: number, public readonly character: number) {}
}

export class Range {
    constructor(public readonly start: Position, public readonly end: Position) {}
}

export class Selection extends Range {}

export const TextEditorRevealType = {
    Default: 0,
    InCenter: 1,
    InCenterIfOutsideViewport: 2,
    AtTop: 3,
};

export const ViewColumn = {
    Active: -1,
    Beside: -2,
    One: 1,
    Two: 2,
    Three: 3,
};

/**
 * A drivable WebviewPanel stub.
 *
 * The listener a panel registers with `onDidReceiveMessage` is kept rather than
 * dropped, so a test can send the panel the message a click would have sent and
 * assert on what came back — `__posted` collects every `postMessage`, and
 * `__lastPosted(type)` picks out the newest of one kind.
 */
export function createMockWebviewPanel() {
    const received: any[] = [];
    const posted: any[] = [];
    const disposeListeners: any[] = [];
    const panel = {
        title: '',
        webview: {
            html: '',
            postMessage: jest.fn((message: any) => {
                posted.push(message);
                return Promise.resolve(true);
            }),
            onDidReceiveMessage: jest.fn((cb: any) => {
                received.push(cb);
                return { dispose: jest.fn() };
            }),
            asWebviewUri: jest.fn((uri: any) => uri),
            cspSource: 'vscode-webview:',
        },
        reveal: jest.fn(),
        dispose: jest.fn(),
        onDidDispose: jest.fn((cb: any) => {
            disposeListeners.push(cb);
            return { dispose: jest.fn() };
        }),
        onDidChangeViewState: jest.fn().mockReturnValue({ dispose: jest.fn() }),
        __posted: posted,
        /** Send the panel a message, as the webview would. Awaits the handler. */
        async __receive(message: any): Promise<void> {
            for (const cb of received) { await cb(message); }
        },
        /** Close the panel, as the editor would. */
        __fireDispose(): void {
            for (const cb of disposeListeners) { cb(); }
        },
        /** The newest message of one kind, or undefined. */
        __lastPosted(type: string): any {
            return [...posted].reverse().find(m => m?.type === type);
        },
    };
    return panel;
}

/**
 * A drivable TreeView stub. `visible` starts false (override on the returned
 * object for an already-open sidebar); `__fireVisibilityChange(visible)` updates
 * the flag and fires every `onDidChangeVisibility` listener, as the real editor does.
 */
export function createMockTreeView() {
    const visibilityEmitter = new EventEmitter<{ visible: boolean }>();
    const selectionEmitter = new EventEmitter<{ selection: any[] }>();
    const treeView = {
        visible: false,
        selection: [] as any[],
        badge: undefined as any,
        onDidChangeVisibility: visibilityEmitter.event,
        onDidChangeSelection: selectionEmitter.event,
        reveal: jest.fn().mockResolvedValue(undefined),
        dispose: jest.fn(),
        __fireVisibilityChange(visible: boolean): void {
            treeView.visible = visible;
            visibilityEmitter.fire({ visible });
        },
    };
    return treeView;
}

export enum StatusBarAlignment {
    Left = 1,
    Right = 2,
}

/** An ExtensionContext whose globalState is a Map, so tests read back what the code wrote. */
export const createMockExtensionContext = (seed: Record<string, unknown> = {}) => {
    const store = new Map<string, unknown>(Object.entries(seed));
    const workspaceStore = new Map<string, unknown>();
    return {
        store,
        workspaceStore,
        context: {
            extensionPath: '/ext',
            extensionUri: Uri.file('/ext'),
            subscriptions: [] as unknown[],
            globalState: {
                get: (key: string, fallback?: unknown) => (store.has(key) ? store.get(key) : fallback),
                update: async (key: string, value: unknown) => { store.set(key, value); },
            },
            workspaceState: {
                get: (key: string, fallback?: unknown) => (workspaceStore.has(key) ? workspaceStore.get(key) : fallback),
                update: async (key: string, value: unknown) => { workspaceStore.set(key, value); },
            },
        },
    };
};

export const createMockStatusBarItem = () => ({
    text: '',
    tooltip: undefined as unknown,
    command: undefined as unknown,
    backgroundColor: undefined as unknown,
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
});

const shellIntegrationEmitter = new EventEmitter<{ terminal: any; shellIntegration: any }>();
const shellExecutionEndEmitter = new EventEmitter<{ terminal: any; execution: any; exitCode: number | undefined }>();
const closeTerminalEmitter = new EventEmitter<any>();

/** A Terminal stub: `__activateShellIntegration` fires the integration event, `autoExitCode` ends each command, `write` gets keystrokes, `__commands` lists what ran. */
export function createMockTerminal(options: {
    name?: string;
    shellIntegration?: boolean;
    autoExitCode?: number;
    write?: (data: string) => void;
} = {}) {
    const order: Array<{ via: 'sendText' | 'executeCommand'; text: string; enter: boolean }> = [];
    const terminal: any = {
        name: options.name ?? 'mock terminal',
        exitStatus: undefined,
        shellIntegration: undefined,
        show: jest.fn(),
        dispose: jest.fn(),
        sendText: jest.fn((text: string, addNewLine: boolean = true) => {
            order.push({ via: 'sendText', text, enter: addNewLine !== false });
            options.write?.(addNewLine !== false ? `${text}\r` : text);
        }),
        executions: [] as any[],
        __activateShellIntegration(): void {
            terminal.shellIntegration = {
                cwd: undefined,
                executeCommand: jest.fn((commandLine: string) => {
                    order.push({ via: 'executeCommand', text: commandLine, enter: true });
                    options.write?.(`${commandLine}\r`);
                    const execution = { commandLine: { value: commandLine } };
                    terminal.executions.push(execution);
                    if (options.autoExitCode !== undefined) {
                        const code = options.autoExitCode;
                        void Promise.resolve().then(() => shellExecutionEndEmitter.fire({ terminal, execution, exitCode: code }));
                    }
                    return execution;
                }),
            };
            shellIntegrationEmitter.fire({ terminal, shellIntegration: terminal.shellIntegration });
        },
        __commands(): string[] {
            return order.filter(o => o.enter).map(o => o.text);
        },
        __typed(): Array<{ via: 'sendText' | 'executeCommand'; text: string; enter: boolean }> {
            return [...order];
        },
    };
    if (options.shellIntegration !== false) terminal.__activateShellIntegration();
    return terminal;
}

/** End a command started through shell integration, as `onDidEndTerminalShellExecution` would report it. */
export function __fireShellExecutionEnd(terminal: any, execution: any, exitCode: number | undefined): void {
    shellExecutionEndEmitter.fire({ terminal, execution, exitCode });
}

/** Close a terminal, as `onDidCloseTerminal` would report it. */
export function __fireCloseTerminal(terminal: any): void {
    closeTerminalEmitter.fire(terminal);
}

export const window = {
    createWebviewPanel: jest.fn().mockImplementation(createMockWebviewPanel),
    createStatusBarItem: jest.fn().mockImplementation(createMockStatusBarItem),
    createTreeView: jest.fn().mockImplementation(createMockTreeView),
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showInputBox: jest.fn(),
    showQuickPick: jest.fn(),
    showTextDocument: jest.fn(),
    activeTextEditor: undefined as any,
    onDidChangeActiveTextEditor: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    createTerminal: jest.fn().mockImplementation((nameOrOptions?: any) =>
        createMockTerminal({ name: typeof nameOrOptions === 'string' ? nameOrOptions : nameOrOptions?.name })),
    onDidCloseTerminal: jest.fn(closeTerminalEmitter.event),
    onDidChangeTerminalShellIntegration: jest.fn(shellIntegrationEmitter.event),
    onDidEndTerminalShellExecution: jest.fn(shellExecutionEndEmitter.event),
    createOutputChannel: jest.fn().mockReturnValue({
        appendLine: jest.fn(),
        show: jest.fn(),
        dispose: jest.fn(),
    }),
    withProgress: jest.fn().mockImplementation((_options: unknown, task: () => Promise<unknown>) => task()),
};

export const ProgressLocation = {
    SourceControl: 1,
    Window: 10,
    Notification: 15,
};

export const commands = {
    registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    executeCommand: jest.fn(),
    getCommands: jest.fn().mockResolvedValue([]),
};

export const extensions = {
    getExtension: jest.fn(),
};

export const version = '1.90.0-test';

const telemetryEnabledEmitter = new EventEmitter<boolean>();

export const env = {
    openExternal: jest.fn(),
    shell: '' as string,
    appName: '' as string,
    uriScheme: '' as string,
    machineId: 'test-machine-id' as string,
    isTelemetryEnabled: true as boolean,
    onDidChangeTelemetryEnabled: telemetryEnabledEmitter.event,
    clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
    },
};

/**
 * Drive the editor-wide telemetry gate from a test: updates `env.isTelemetryEnabled`
 * and fires every `env.onDidChangeTelemetryEnabled` listener with the new value,
 * as the real editor does.
 */
export function __fireTelemetryEnabledChange(enabled: boolean): void {
    env.isTelemetryEnabled = enabled;
    telemetryEnabledEmitter.fire(enabled);
}
