import type { NavState, SpecDocument, TaskCounts } from '../contract/viewer';
import type { SpecContext } from '../contract/specContext';
import {
    calculateWorkflowPhase,
    computeBadgeText,
    computeCreatedDate,
    computeLastUpdatedDate,
    getDocTypeLabel,
    mapStepToTab,
    taskCompletionPercentOf,
} from './phaseCalculation';
import { deriveStepHistory, getSpecStatus } from './stepHistoryDerivation';
import { findRunningStep } from './stateDerivation';
import { SpecStatuses } from './statuses';

/**
 * Map stepHistory keys from step names to tab names. `mapStepToTab`
 * collapses `tasks` and `implement` onto the `tasks` tab key (Implement has
 * no dedicated tab). When a later step aliases onto the same key, the
 * resolution prefers (1) the entry whose own step name equals the tab key
 * (e.g. `tasks` wins over `implement` for the `tasks` tab), then (2) a
 * completed entry over an in-flight one, then (3) earlier `startedAt` over
 * later. Without this priority, a producer that emits `implement` before
 * `tasks` (or with later `startedAt`) would shadow `tasks`' real duration on
 * the Tasks tab — order-dependence we don't want to rely on.
 */
export function mapStepHistoryToTabKeys(
    stepHistory?: Record<string, { startedAt?: string; completedAt?: string | null }>,
): Record<string, { startedAt?: string; completedAt?: string | null }> | undefined {
    if (!stepHistory) return undefined;
    const out: Record<string, { startedAt?: string; completedAt?: string | null }> = {};
    const winningStep: Record<string, string> = {};

    for (const [step, entry] of Object.entries(stepHistory)) {
        const tabName = mapStepToTab(step) || step;
        const incumbent = out[tabName];
        if (!incumbent) {
            out[tabName] = entry;
            winningStep[tabName] = step;
            continue;
        }
        // 1. The entry whose step name equals the tab name wins.
        if (step === tabName) {
            out[tabName] = entry;
            winningStep[tabName] = step;
            continue;
        }
        if (winningStep[tabName] === tabName) continue;
        // 2. Completed entries beat in-flight ones.
        if (entry.completedAt && !incumbent.completedAt) {
            out[tabName] = entry;
            winningStep[tabName] = step;
            continue;
        }
        if (!entry.completedAt && incumbent.completedAt) continue;
        // 3. Earlier startedAt wins (preserves the historical first run).
        if (entry.startedAt && incumbent.startedAt && entry.startedAt < incumbent.startedAt) {
            out[tabName] = entry;
            winningStep[tabName] = step;
        }
    }
    return out;
}

const FINISHED = new Set<string>([SpecStatuses.IMPLEMENTED, SpecStatuses.COMPLETED, SpecStatuses.ARCHIVED]);

/** The task the record names as current, or null once the run has finished. */
function currentTaskOf(record: SpecContext | null): string | null {
    const task = (record as { currentTask?: unknown } | null)?.currentTask;
    return typeof task === 'string' && !FINISHED.has(String(record?.status)) ? task : null;
}

export interface NavInput {
    /** The spec's `.spec-context.json`, or null when it has none. */
    record: SpecContext | null;
    /** The folder's documents as the rail shows them. */
    documents: SpecDocument[];
    /** The document on screen; an unknown type falls back to the first core document. */
    currentDoc: string;
    landing?: 'overview' | 'document';
    /** A run is going now; the record cannot say whether a session still holds an open step. */
    live?: boolean;
    taskCounts?: TaskCounts | null;
    /** The spec's own title, kept on every tab. */
    specTitle?: string | null;
    /** The spec's id, shown beside the title. */
    specName?: string | null;
}

/** The navigation state a host without the extension builds from a spec's record and documents. */
export function buildNavState(input: NavInput): NavState<never> {
    const { record, documents } = input;
    const coreDocs = documents.filter(d => d.category === 'core');
    const relatedDocs = documents.filter(d => d.category === 'related');
    const pipelineDocs = documents.filter(d => d.category === 'core' || d.category === 'action');
    const known = documents.some(d => d.type === input.currentDoc);
    const currentDoc = known ? input.currentDoc : coreDocs[0]?.type ?? input.currentDoc;
    const history = record ? deriveStepHistory(record.history ?? [], record.currentStep, record.status) : undefined;
    const running = findRunningStep(history);
    const counts = input.taskCounts ?? { checked: 0, total: 0 };
    const percent = taskCompletionPercentOf(counts);
    const viewing = documents.find(d => d.type === currentDoc);
    return {
        coreDocs: pipelineDocs,
        relatedDocs,
        currentDoc,
        workflowPhase: calculateWorkflowPhase(coreDocs),
        taskCompletionPercent: percent,
        taskCounts: input.taskCounts ?? undefined,
        isViewingRelatedDoc: !coreDocs.some(d => d.type === currentDoc),
        specStatus: getSpecStatus(record ?? undefined, percent),
        currentTask: currentTaskOf(record),
        activeStep: running ? mapStepToTab(running.step) || running.step : null,
        stepHistory: mapStepHistoryToTabKeys(history),
        live: input.live ?? false,
        badgeText: record ? computeBadgeText({ ...record, stepHistory: history }) : null,
        createdDate: computeCreatedDate(history),
        lastUpdatedDate: computeLastUpdatedDate(history),
        specContextName: input.specName ?? record?.specName ?? null,
        specTitle: input.specTitle ?? null,
        branch: record?.branch ?? null,
        currentStep: record?.currentStep ?? null,
        filePath: viewing?.filePath,
        docTypeLabel: getDocTypeLabel(record?.currentStep ?? currentDoc),
        activityPanelEnabled: true,
        landing: input.landing ?? 'overview',
        stalenessMap: {},
    };
}
