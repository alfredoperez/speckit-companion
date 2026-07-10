/**
 * SpecKit Companion - Spec Viewer Utilities
 * Helper functions for the spec viewer provider
 */

import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { CORE_DOCUMENT_FILES, CoreDocumentType, DocumentType } from './types';
import type { WorkflowStepConfig } from '../workflows/types';
import { isInsideSpecDirectory } from '../../core/specDirectoryResolver';
import { SPEC_CONTEXT_FILENAME } from '../specs/specContextReader';

/**
 * Generates a random nonce for CSP
 */
export function generateNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// `fileNameToDocType` lives in `core/utils/fileNaming.ts`.
// Imported locally so `getDocumentTypeFromPath` below can use them; not
// re-exported (callers import from `core/utils/fileNaming` directly).
import { fileNameToDocType } from '../../core/utils/fileNaming';

/**
 * Check if a file path is a spec document
 */
export function isSpecDocument(filePath: string): boolean {
    const fileName = path.basename(filePath).toLowerCase();
    if (!fileName.endsWith('.md')) {
        return false;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
        return isInsideSpecDirectory(filePath, workspaceRoot) !== undefined;
    }

    // Fallback: check for /specs/ in path
    return filePath.includes('/specs/');
}

/**
 * Get document type from file path.
 * When `steps` is provided, matches against workflow step files first.
 */
export function getDocumentTypeFromPath(filePath: string, steps?: WorkflowStepConfig[]): DocumentType {
    const fileName = path.basename(filePath).toLowerCase();

    // Check workflow steps first when available
    if (steps) {
        for (const step of steps) {
            const stepFile = (step.file ?? `${step.name}.md`).toLowerCase();
            if (fileName === stepFile) {
                return step.name;
            }
        }
    }

    // Check core documents
    for (const [type, file] of Object.entries(CORE_DOCUMENT_FILES)) {
        if (fileName === file) {
            return type as CoreDocumentType;
        }
    }

    // Related document
    return fileNameToDocType(fileName);
}

/**
 * Get spec directory from file path
 */
export function getSpecDirectoryFromPath(filePath: string): string {
    const start = path.dirname(filePath);
    // Resolve to the actual spec ROOT, not just the file's parent. A document
    // can live in a step subDir (`issues/NN-*.md`) or a related-doc
    // folder — `path.dirname` alone points at that subfolder, so the viewer would
    // read a nonexistent `.spec-context.json` there and backfill a bogus "draft"
    // spec with the wrong name, losing the stepper state and forward button.
    // Walk up to the nearest ancestor that actually holds the spec (its
    // `.spec-context.json` or `spec.md`), bounded so a stray path can't loop.
    let dir = start;
    for (let i = 0; i < 8; i++) {
        try {
            if (
                fs.existsSync(path.join(dir, SPEC_CONTEXT_FILENAME)) ||
                fs.existsSync(path.join(dir, 'spec.md'))
            ) {
                return dir;
            }
        } catch {
            /* ignore and keep walking */
        }
        const parent = path.dirname(dir);
        if (parent === dir) break; // reached filesystem root
        dir = parent;
    }
    // No spec-root marker found — preserve the original behavior.
    return start;
}

/**
 * Escape HTML entities
 */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Escape for HTML attribute (more aggressive escaping)
 */
export function escapeHtmlAttribute(text: string): string {
    return Buffer.from(text).toString('base64');
}
