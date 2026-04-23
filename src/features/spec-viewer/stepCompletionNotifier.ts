import * as path from 'path';
import * as vscode from 'vscode';

export interface StepHistoryLike {
    startedAt?: string;
    completedAt?: string | null;
}

export interface NotifierContext {
    stepHistory?: Record<string, StepHistoryLike> | null;
}

const STEP_LABELS: Record<string, string> = {
    specify: 'Specify',
    clarify: 'Clarify',
    plan: 'Plan',
    tasks: 'Tasks',
    analyze: 'Analyze',
    implement: 'Implement',
};

function labelFor(step: string): string {
    return STEP_LABELS[step] ?? step.charAt(0).toUpperCase() + step.slice(1);
}

function specNumberFromDir(specDir: string): string {
    const basename = path.basename(specDir);
    const match = basename.match(/^(\d+)/);
    return match ? match[1] : basename;
}

function historyEntries(ctx: NotifierContext | null | undefined): Record<string, StepHistoryLike> {
    return ctx?.stepHistory ?? {};
}

function key(specDir: string, step: string, startedAt: string): string {
    return `${specDir}:${step}:${startedAt}`;
}

export class StepCompletionNotifier {
    private readonly seen = new Set<string>();
    private readonly seeded = new Set<string>();

    observe(specDir: string, prevCtx: NotifierContext | null | undefined, nextCtx: NotifierContext | null | undefined): void {
        const nextHist = historyEntries(nextCtx);

        if (!this.seeded.has(specDir)) {
            for (const [step, entry] of Object.entries(nextHist)) {
                if (entry?.startedAt && entry?.completedAt) {
                    this.seen.add(key(specDir, step, entry.startedAt));
                }
            }
            this.seeded.add(specDir);
            return;
        }

        if (!this.isEnabled()) return;

        const prevHist = historyEntries(prevCtx);
        for (const [step, entry] of Object.entries(nextHist)) {
            if (!entry?.startedAt || !entry?.completedAt) continue;
            const prevEntry = prevHist[step];
            const wasIncomplete = !prevEntry?.completedAt;
            if (!wasIncomplete) continue;
            const k = key(specDir, step, entry.startedAt);
            if (this.seen.has(k)) continue;
            this.seen.add(k);
            void this.announce(specDir, step);
        }
    }

    forget(specDir: string): void {
        this.seeded.delete(specDir);
        for (const k of Array.from(this.seen)) {
            if (k.startsWith(`${specDir}:`)) this.seen.delete(k);
        }
    }

    private isEnabled(): boolean {
        return vscode.workspace
            .getConfiguration('speckit')
            .get<boolean>('notifications.stepComplete', true);
    }

    private async announce(specDir: string, step: string): Promise<void> {
        const msg = `Spec ${specNumberFromDir(specDir)} · ${labelFor(step)} complete`;
        const OPEN = 'Open spec';
        const choice = await vscode.window.showInformationMessage(msg, OPEN);
        if (choice === OPEN) {
            const specFile = path.join(specDir, 'spec.md');
            await vscode.commands.executeCommand('speckit.viewSpecDocument', specFile);
        }
    }
}
