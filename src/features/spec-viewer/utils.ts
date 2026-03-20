/**
 * SpecKit Companion - Spec Viewer Utilities
 * Helper functions for the spec viewer provider
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { CORE_DOCUMENT_FILES, CoreDocumentType, DocumentType } from './types';
import type { WorkflowStepConfig } from '../workflows/types';
import { isInsideSpecDirectory } from '../../core/specDirectoryResolver';

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

/**
 * Convert filename to display name (e.g., "research.md" -> "Research")
 */
export function fileNameToDisplayName(fileName: string): string {
    const baseName = fileName.replace(/\.md$/i, '');
    // Convert kebab-case or snake_case to Title Case
    return baseName
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Convert filename to document type (e.g., "research.md" -> "research")
 */
export function fileNameToDocType(fileName: string): string {
    return fileName.replace(/\.md$/i, '').toLowerCase();
}

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
    return path.dirname(filePath);
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
