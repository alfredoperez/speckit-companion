import * as vscode from 'vscode';

/**
 * Base error class for SpecKit errors
 */
export class SpecKitError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly cause?: Error
    ) {
        super(message);
        this.name = 'SpecKitError';
    }
}

export class FileNotFoundError extends SpecKitError {
    constructor(filePath: string, cause?: Error) {
        super(`File not found: ${filePath}`, 'FILE_NOT_FOUND', cause);
        this.name = 'FileNotFoundError';
    }
}

export class ParseError extends SpecKitError {
    constructor(message: string, cause?: Error) {
        super(message, 'PARSE_ERROR', cause);
        this.name = 'ParseError';
    }
}

export class ConfigurationError extends SpecKitError {
    constructor(message: string, cause?: Error) {
        super(message, 'CONFIGURATION_ERROR', cause);
        this.name = 'ConfigurationError';
    }
}

export class WorkspaceError extends SpecKitError {
    constructor(message: string, cause?: Error) {
        super(message, 'WORKSPACE_ERROR', cause);
        this.name = 'WorkspaceError';
    }
}

/**
 * Options for error handling
 */
export interface ErrorHandlerOptions {
    outputChannel?: vscode.OutputChannel;
    context?: string;
    showNotification?: boolean;
    rethrow?: boolean;
}

/**
 * Handle an error with consistent logging and optional notification
 */
export function handleError(error: unknown, options: ErrorHandlerOptions = {}): void {
    const { outputChannel, context, showNotification = false, rethrow = false } = options;

    const errorMessage = error instanceof Error ? error.message : String(error);
    const prefix = context ? `[${context}]` : '[Error]';

    if (outputChannel) {
        outputChannel.appendLine(`${prefix} ${errorMessage}`);
        if (error instanceof Error && error.stack) {
            outputChannel.appendLine(error.stack);
        }
    }

    if (showNotification) {
        vscode.window.showErrorMessage(`${context ? context + ': ' : ''}${errorMessage}`);
    }

    if (rethrow) {
        throw error;
    }
}

/**
 * Wrap an async function with error handling
 */
export function withErrorHandling<T>(
    fn: () => Promise<T>,
    options: ErrorHandlerOptions = {}
): Promise<T | undefined> {
    return fn().catch((error) => {
        handleError(error, options);
        return undefined;
    });
}
