/* eslint-disable @typescript-eslint/no-explicit-any */

export enum FileType {
    Unknown = 0,
    File = 1,
    Directory = 2,
    SymbolicLink = 64,
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
};
