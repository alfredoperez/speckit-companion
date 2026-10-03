/**
 * SpecKit Companion - Spec Viewer Utilities
 * Helper functions for the spec viewer provider
 */

import * as path from 'path';
import * as fs from 'fs';
import { CORE_DOCUMENT_FILES, CoreDocumentType, DocumentType } from './types';
import type { WorkflowStepConfig } from '../workflows/types';
import { isInsideSpecDirectory } from '../../core/specDirectoryResolver';
import { getProjectRoot } from '../../core/projectRoot';
import { SPEC_CONTEXT_FILENAME } from '../specs/specContextReader';
import { STOCK_SPEC_FILE, featureSpecPath, isFeatureSpecFile } from '../specs/featureSpecPath';

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
import { fileNameToDocType, relativePathToDocType } from '../../core/utils/fileNaming';

/** A markdown file inside a spec folder that the document scanner lists, so the viewer can open it. */
export function isSpecDocument(
    filePath: string,
    workspaceRoot: string | undefined = getProjectRoot(),
): boolean {
    if (!filePath.endsWith('.md') || filePath.endsWith('-extra.md')) {
        return false;
    }
    if (!workspaceRoot) {
        return filePath.includes('/specs/');
    }
    const specRel = isInsideSpecDirectory(filePath, workspaceRoot);
    if (!specRel) {
        return false;
    }
    const inside = path.relative(path.resolve(workspaceRoot, specRel), path.resolve(filePath));
    return inside !== '' && !inside.startsWith('..') && !inside.split(/[\\/]/).some(part => part.startsWith('.'));
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
            if (fileName === stepFile || (stepFile === STOCK_SPEC_FILE && isFeatureSpecFile(fileName))) {
                return step.name;
            }
        }
    }

    // Check core documents
    for (const [type, file] of Object.entries(CORE_DOCUMENT_FILES)) {
        if (fileName === file || (file === STOCK_SPEC_FILE && isFeatureSpecFile(fileName))) {
            return type as CoreDocumentType;
        }
    }

    // Related document. A nested one is typed by its path under the spec, because that is how
    // the scan stored it: `checklists/requirements.md` is `checklists/requirements`, and typing
    // it as `requirements` finds no document, so the click does nothing at all.
    const rel = path.relative(getSpecDirectoryFromPath(filePath), filePath);
    if (rel && !rel.startsWith('..') && /[\\/]/.test(rel)) {
        return relativePathToDocType(rel);
    }
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
                fs.existsSync(featureSpecPath(dir))
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
 * Base64 for carrying a document through an HTML attribute — the webview reads
 * it back with `decodeBase64Utf8`. Named for what it does: it is not an escaper,
 * and `escapeHtml` above is safe for element content only, never an attribute.
 */
export function encodeBase64Utf8(text: string): string {
    return Buffer.from(text).toString('base64');
}
