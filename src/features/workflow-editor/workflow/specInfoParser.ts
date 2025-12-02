import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { SpecInfo, RelatedDoc, EnhancementButton } from '../../../core/types';

/**
 * Parse spec information from a document
 */
export function parseSpecInfo(document: vscode.TextDocument): SpecInfo {
    const fileName = path.basename(document.fileName);
    const dirPath = path.dirname(document.fileName);

    // Detect current phase and document type based on filename (SpecKit format only)
    let currentPhase = 1;
    let phaseIcon = '📋';
    let documentType: 'spec' | 'plan' | 'tasks' | 'other' = 'other';
    let enhancementButton: EnhancementButton | null = null;

    if (fileName === 'spec.md') {
        currentPhase = 1;
        phaseIcon = '📋';
        documentType = 'spec';
        enhancementButton = {
            label: 'Clarify',
            command: 'clarify',
            icon: '?',
            tooltip: 'Ask clarifying questions about ambiguous requirements'
        };
    } else if (fileName === 'plan.md') {
        currentPhase = 2;
        phaseIcon = '🔷';
        documentType = 'plan';
        enhancementButton = {
            label: 'Checklist',
            command: 'checklist',
            icon: '✓',
            tooltip: 'Generate implementation checklist from design'
        };
    } else if (fileName === 'tasks.md') {
        currentPhase = 3;
        phaseIcon = '✅';
        documentType = 'tasks';
        enhancementButton = {
            label: 'Analyze',
            command: 'analyze',
            icon: '⚡',
            tooltip: 'Analyze task dependencies and complexity'
        };
    } else if (fileName === 'research.md') {
        currentPhase = 1;
        phaseIcon = '🔍';
    } else if (fileName.endsWith('.md')) {
        // Related docs (data-model.md, quickstart.md, etc.) are part of the Plan phase
        currentPhase = 2;
        phaseIcon = '📄';
        documentType = 'plan';  // Treat as plan-related
    }

    // Check if next phase file exists
    const nextFileName = currentPhase === 1 ? 'plan.md' : currentPhase === 2 ? 'tasks.md' : null;
    const nextPhaseExists = nextFileName ? fs.existsSync(path.join(dirPath, nextFileName)) : false;

    // Find ALL documents in same folder for tabs (consistent order)
    const allDocs = getRelatedDocs(dirPath, fileName, documentType);

    return {
        currentPhase,
        phaseIcon,
        progressPercent: (currentPhase / 3) * 100,
        specDir: dirPath,
        documentType,
        enhancementButton,
        nextPhaseExists,
        currentFileName: fileName,
        allDocs
    };
}

/**
 * Get related documents for tab display
 */
function getRelatedDocs(dirPath: string, currentFileName: string, documentType: string): RelatedDoc[] {
    const mainDocs = ['spec.md', 'plan.md', 'tasks.md'];

    try {
        const files = fs.readdirSync(dirPath);
        // Get non-main docs
        const otherDocs = files.filter(f => f.endsWith('.md') && !mainDocs.includes(f));

        // For phase 2 (plan) or related docs, show tabs
        if (documentType === 'plan' || otherDocs.includes(currentFileName)) {
            // Workflow order: research → plan → data-model → quickstart → others alphabetically
            const docOrder = ['research.md', 'plan.md', 'data-model.md', 'quickstart.md'];

            // Collect all docs that exist
            const docsToShow: RelatedDoc[] = [];

            // Add plan.md if it exists
            if (fs.existsSync(path.join(dirPath, 'plan.md'))) {
                docsToShow.push({
                    name: 'Plan',
                    fileName: 'plan.md',
                    path: path.join(dirPath, 'plan.md')
                });
            }

            // Add other docs
            otherDocs.forEach(f => {
                docsToShow.push({
                    name: formatDocName(f.replace('.md', '')),
                    fileName: f,
                    path: path.join(dirPath, f)
                });
            });

            // Sort by workflow order
            docsToShow.sort((a, b) => {
                const aIdx = docOrder.indexOf(a.fileName);
                const bIdx = docOrder.indexOf(b.fileName);
                if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                if (aIdx !== -1) return -1;
                if (bIdx !== -1) return 1;
                return a.fileName.localeCompare(b.fileName);
            });

            return docsToShow;
        }
    } catch {
        // Ignore errors
    }

    return [];
}

/**
 * Format document name: capitalize and replace dashes with spaces
 */
export function formatDocName(name: string): string {
    return name
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
