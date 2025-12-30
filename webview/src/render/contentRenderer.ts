/**
 * Main content renderer
 */
import type { SpecInfo } from '../types';
import { renderLine } from './lineRenderer';
import { renderCodeBlock, renderTable } from './blockRenderer';

interface PhaseInfo {
    startLine: number;
    total: number;
    completed: number;
    isComplete: boolean;
}

/**
 * Pre-calculate phase completion status for all phases in the document
 */
function calculatePhaseCompletion(lines: string[]): Map<number, PhaseInfo> {
    const phases = new Map<number, PhaseInfo>();
    let currentPhaseStart: number | null = null;
    let currentPhase: PhaseInfo | null = null;

    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        // Detect phase headers: ## Phase N: or ### Phase N:
        if (/^#{2,3}\s+Phase\s+\d+/i.test(trimmed)) {
            // Save previous phase
            if (currentPhaseStart !== null && currentPhase) {
                currentPhase.isComplete = currentPhase.total > 0 && currentPhase.completed === currentPhase.total;
                phases.set(currentPhaseStart, currentPhase);
            }
            // Start new phase
            currentPhaseStart = i;
            currentPhase = { startLine: i, total: 0, completed: 0, isComplete: false };
            continue;
        }

        // Count tasks in current phase
        if (currentPhase && /^\s*-\s+\[([ xX])\]/.test(trimmed)) {
            currentPhase.total++;
            if (/^\s*-\s+\[[xX]\]/.test(trimmed)) {
                currentPhase.completed++;
            }
        }
    }

    // Don't forget last phase
    if (currentPhaseStart !== null && currentPhase) {
        currentPhase.isComplete = currentPhase.total > 0 && currentPhase.completed === currentPhase.total;
        phases.set(currentPhaseStart, currentPhase);
    }

    return phases;
}

export function renderContent(content: string, specInfo: SpecInfo): void {
    const contentEl = document.getElementById('content');
    if (!contentEl) return;

    if (!content || content.trim().length === 0) {
        renderEmptyState(contentEl, specInfo);
        return;
    }

    const lines = content.split('\n');

    // Pre-calculate phase completion for showing ✅ on phase headers
    const phaseCompletion = calculatePhaseCompletion(lines);

    let html = '';
    let inCodeBlock = false;
    let codeBlockLang = '';
    let codeBlockLines: string[] = [];
    let tableLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Code block start/end
        if (trimmed.startsWith('```')) {
            if (inCodeBlock) {
                // End code block - render accumulated lines
                html += renderCodeBlock(codeBlockLines, codeBlockLang);
                codeBlockLines = [];
                codeBlockLang = '';
                inCodeBlock = false;
            } else {
                // Flush any pending table first
                if (tableLines.length > 0) {
                    html += renderTable(tableLines);
                    tableLines = [];
                }
                // Start code block
                inCodeBlock = true;
                codeBlockLang = trimmed.slice(3).trim();
            }
            continue;
        }

        // Inside code block - accumulate without actions
        if (inCodeBlock) {
            codeBlockLines.push(line);
            continue;
        }

        // Table detection
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            tableLines.push(trimmed);
            // Check if next line continues table
            const nextLine = lines[i + 1]?.trim() || '';
            if (!nextLine.startsWith('|')) {
                html += renderTable(tableLines);
                tableLines = [];
            }
            continue;
        }

        // Flush any pending table
        if (tableLines.length > 0) {
            html += renderTable(tableLines);
            tableLines = [];
        }

        // Regular line rendering - pass phase info if this is a phase header
        const phaseInfo = phaseCompletion.get(i);
        html += renderLine(line, i, phaseInfo);
    }

    // Flush remaining blocks
    if (codeBlockLines.length > 0) {
        html += renderCodeBlock(codeBlockLines, codeBlockLang);
    }
    if (tableLines.length > 0) {
        html += renderTable(tableLines);
    }

    contentEl.innerHTML = html;

    // Initialize syntax highlighting for code blocks
    if (typeof hljs !== 'undefined') {
        contentEl.querySelectorAll('.code-block pre code').forEach(block => {
            hljs.highlightElement(block);
        });
    }

    // Initialize mermaid diagrams if present
    if (typeof mermaid !== 'undefined' && contentEl.querySelectorAll('.mermaid').length > 0) {
        mermaid.run({ querySelector: '.mermaid' });
    }
}

function renderEmptyState(contentEl: HTMLElement, specInfo: SpecInfo): void {
    const phaseAction: Record<number, { action: string; command: string }> = {
        1: { action: 'Generate Specification', command: 'specify' },
        2: { action: 'Generate Plan', command: 'plan' },
        3: { action: 'Generate Tasks', command: 'tasks' }
    };

    const { action, command } = phaseAction[specInfo.currentPhase] || phaseAction[1];

    contentEl.innerHTML = `
        <div class="empty-state">
            <h2>Document is empty</h2>
            <p>This document has not been created yet.</p>
            <button data-action="generate" data-command="${command}">${action}</button>
        </div>
    `;
}
