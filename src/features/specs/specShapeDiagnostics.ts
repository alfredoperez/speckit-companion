/**
 * Spec-shape findings in the editor's own problem list.
 *
 * A break in a spec used to surface days later, in a fold's refusal message.
 * This runs the same checks on save and puts each finding on the line it is
 * about, so it is fixed while the author is still looking at it.
 *
 * The checks themselves live in `specShapeCheck.ts` and know nothing about the
 * editor. This module owns the collection, the listener, and the gate.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { checkFeatureDeltas, checkLivingSpec, Finding } from './specShapeCheck';
import { readLivingSpecs } from './livingSpecsModel';

const SOURCE = 'SpecKit Companion';

function severityOf(finding: Finding): vscode.DiagnosticSeverity {
    return finding.severity === 'error'
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning;
}

function toDiagnostic(doc: vscode.TextDocument, finding: Finding): vscode.Diagnostic {
    // The finding's line is one-based and may name a line the document no
    // longer has if it was produced against older text; clamp rather than throw.
    const index = Math.min(Math.max(finding.line - 1, 0), Math.max(doc.lineCount - 1, 0));
    const range = doc.lineAt(index).range;
    const diagnostic = new vscode.Diagnostic(range, finding.message, severityOf(finding));
    diagnostic.source = SOURCE;
    diagnostic.code = finding.code;
    return diagnostic;
}

/**
 * The findings for one saved document, or an empty list when it is not ours.
 *
 * Exported so the behaviour can be tested without a save event: the gate and
 * the mapping are the parts worth pinning, not the listener wiring.
 */
export function findingsFor(
    workspaceRoot: string,
    file: string,
    text: string
): Finding[] {
    if (!file.endsWith('.spec.md')) return [];
    let listing;
    try {
        listing = readLivingSpecs(workspaceRoot, { withOrphans: false });
    } catch {
        return [];
    }
    if (!listing.enabled) return [];
    const rel = path.relative(workspaceRoot, file).split(path.sep).join('/');
    // Every `*.spec.md` is checked; only one the registry claims gets a name.
    const capability = listing.capabilities.find(c => c.spec === rel)?.name;
    // Only the checks this document answers on its own. The marker check wants
    // the whole tree, which is not a cost to pay on every save.
    return checkLivingSpec(text, rel, { capability });
}

/** The feature-spec half: a `spec.md` under `specs/`, checked for its deltas. */
export function deltaFindingsFor(
    workspaceRoot: string,
    file: string,
    text: string
): Finding[] {
    const rel = path.relative(workspaceRoot, file).split(path.sep).join('/');
    if (!/^specs\/[^/]+\/spec\.md$/.test(rel)) return [];
    let listing;
    try {
        listing = readLivingSpecs(workspaceRoot, { withOrphans: false });
    } catch {
        return [];
    }
    if (!listing.enabled) return [];
    const targetTexts: Record<string, string> = {};
    for (const cap of listing.capabilities) {
        if (!cap.exists) continue;
        try {
            targetTexts[cap.name] = fs.readFileSync(path.join(workspaceRoot, cap.spec), 'utf-8');
        } catch {
            // A capability we cannot read is not checked. Absent is not evidence.
        }
    }
    return checkFeatureDeltas(text, rel, {
        knownCapabilities: listing.capabilities.map(c => c.name),
        targetTexts,
    });
}

/**
 * Publish spec-shape findings on save, and clear them when they are fixed.
 *
 * Returns a disposable that owns the collection, so deactivation takes the
 * problems with it rather than leaving them on a page nothing updates.
 */
export function registerSpecShapeDiagnostics(): vscode.Disposable {
    const collection = vscode.languages.createDiagnosticCollection('speckit-spec-shape');

    const publish = (doc: vscode.TextDocument): void => {
        const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
        if (!folder) {
            // A document whose folder went away keeps whatever was published
            // for it until something clears it, and nothing else will.
            collection.delete(doc.uri);
            return;
        }
        const root = folder.uri.fsPath;
        const file = doc.uri.fsPath;
        const text = doc.getText();
        const findings = [
            ...findingsFor(root, file, text),
            ...deltaFindingsFor(root, file, text),
        ];
        // Setting an empty list is what clears a fixed problem; deleting the
        // entry would leave the last render standing until the next save.
        collection.set(doc.uri, findings.map(f => toDiagnostic(doc, f)));
    };

    const onSave = vscode.workspace.onDidSaveTextDocument(publish);
    const onClose = vscode.workspace.onDidCloseTextDocument(doc => collection.delete(doc.uri));

    return vscode.Disposable.from(collection, onSave, onClose);
}
