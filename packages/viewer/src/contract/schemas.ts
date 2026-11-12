/**
 * Runtime checks for what crosses into a host: the `.spec-context.json` record as current
 * writers produce it, the two state objects the viewer draws, and the messages it sends back.
 * Unknown fields survive every parse, so a newer writer never breaks an older reader.
 * Legacy records (`transitions`, status `active`) need the extension's normalizer first.
 */
import { z } from 'zod';
import { HISTORY_ENTRY_BY, STATUSES, STEP_NAMES, type HistoryEntryBy, type Status, type StepName } from './specContext';

const stepName = z.enum(STEP_NAMES as [StepName, ...StepName[]]);
const status = z.enum(STATUSES as [Status, ...Status[]]);
const tier = z.enum(['low', 'normal', 'high']);

export const HistoryEntrySchema = z.looseObject({
    step: stepName,
    substep: z.string().nullable(),
    task: z.string().optional(),
    kind: z.enum(['start', 'complete']),
    from: z.looseObject({ step: stepName.nullable(), substep: z.string().nullable() }).optional(),
    by: z.enum(HISTORY_ENTRY_BY as [HistoryEntryBy, ...HistoryEntryBy[]]),
    at: z.string(),
});

const earlierAnswer = z.looseObject({ decision: z.string(), by: z.string().optional(), at: z.string().optional() });
const decision = z.looseObject({
    decision: z.string(),
    why: z.string().optional(),
    rejected: z.string().optional(),
    id: z.string().optional(),
    by: z.string().optional(),
    at: z.string().optional(),
    earlier: z.array(earlierAnswer).optional(),
});
// The writer's batch form records "T001,T004" as one string; readers get the list.
const idList = z.union([
    z.array(z.string()),
    z.string().transform((ids) => ids.split(',').map((id) => id.trim()).filter(Boolean)),
]);
const concern = z.looseObject({ task: z.string().optional(), note: z.string() });
const verification = z.looseObject({
    what: z.string(),
    result: z.string().optional(),
    command: z.string().optional(),
    warnings: z.array(z.string()).optional(),
    source: z.literal('derived').optional(),
    exitCode: z.number().optional(),
    durationSeconds: z.number().optional(),
});

export const SpecContextSchema = z.looseObject({
    workflow: z.string(),
    specName: z.string(),
    branch: z.string(),
    workingBranch: z.string().nullable().optional(),
    selectedAt: z.string().optional(),
    currentStep: stepName,
    status,
    history: z.array(HistoryEntrySchema),
    reviewComments: z
        .array(
            z.looseObject({
                id: z.string(),
                doc: z.string(),
                anchor: z.looseObject({ heading: z.string().nullable(), blockText: z.string(), line: z.number() }),
                comment: z.string(),
                status: z.enum(['pending', 'applied']),
                createdAt: z.string(),
            })
        )
        .optional(),
    last_action: z.string().optional(),
    progress: z.string().nullable().optional(),
    files_modified: z.array(z.string()).optional(),
    prUrl: z.string().optional(),
    prNumber: z.number().optional(),
    checkpointStatus: z.record(z.string(), z.union([z.boolean(), z.string()])).optional(),
    profile: z.enum(['standard', 'turbo']).optional(),
    telemetryInstanceId: z.string().optional(),
    assistant: z.string().optional(),
    task_summaries: z.record(z.string(), z.unknown()).optional(),
    step_summaries: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
    livingSpecs: z
        .looseObject({
            loaded: z.array(z.string()).optional(),
            synced: z.array(z.string()).optional(),
            loadedRequirements: z.record(z.string(), z.array(z.string())).optional(),
        })
        .optional(),
    intent: z.string().optional(),
    request: z.string().optional(),
    expectations: z.array(z.string()).optional(),
    context: z.array(z.string()).optional(),
    approach: z.string().optional(),
    decisions: z.array(z.union([decision, z.string()])).optional(),
    concerns: z.array(z.union([concern, z.string()])).optional(),
    verified: z.array(z.union([verification, z.string()])).optional(),
    coverage: z
        .record(
            z.string(),
            z.looseObject({
                tasks: idList.optional(),
                tests: idList.optional(),
                assumes: z.string().optional(),
                weak: z.boolean().optional(),
            })
        )
        .optional(),
    classification: z
        .looseObject({
            projectedFiles: z.number().optional(),
            projectedTasks: z.number().optional(),
            scopeSignal: z.enum(['larger', 'smaller', 'none']).optional(),
            verdict: z.enum(['simple', 'normal', 'oversized']),
        })
        .optional(),
    risk: z
        .looseObject({
            tier,
            computed: tier,
            reasons: z.array(z.string()),
            raised: z.looseObject({ tier, reason: z.string(), by: z.string(), at: z.string() }).optional(),
        })
        .optional(),
    source: z.string().optional(),
    extends: z.string().optional(),
    supersedes: z.string().optional(),
    convergePasses: z
        .array(
            z.looseObject({
                startedAt: z.string(),
                by: z.enum(['extension', 'ai']),
                before: z.array(z.string()).optional(),
                finishedAt: z.string().optional(),
                added: z.array(z.string()).optional(),
                completed: z.boolean().optional(),
            })
        )
        .optional(),
});

const specDocument = z.looseObject({
    type: z.string(),
    label: z.string(),
    fileName: z.string(),
    filePath: z.string(),
    exists: z.boolean(),
    isCore: z.boolean(),
    category: z.enum(['core', 'related', 'action']),
    parentStep: z.string().optional(),
});

/** The required navigation fields; the optional ones pass through unchecked. */
export const NavStateSchema = z.looseObject({
    coreDocs: z.array(specDocument),
    relatedDocs: z.array(specDocument),
    currentDoc: z.string(),
    workflowPhase: z.string(),
    taskCompletionPercent: z.number(),
    isViewingRelatedDoc: z.boolean(),
});

/** The required viewer-state fields; the optional ones pass through unchecked. */
export const ViewerStateSchema = z.looseObject({
    status: z.string(),
    activeStep: z.string(),
    steps: z.record(z.string(), z.enum(['not-started', 'in-progress', 'completed'])),
    pulse: z.string().nullable(),
    highlights: z.array(z.string()),
    activeSubstep: z.looseObject({ step: z.string(), name: z.string() }).nullable(),
    footer: z.array(z.looseObject({ id: z.string(), label: z.string(), scope: z.enum(['spec', 'step']), tooltip: z.string() })),
    history: z.array(HistoryEntrySchema),
    stepHistory: z.record(z.string(), z.looseObject({})),
});

/** Every message the viewer can send its host, by `type`. */
export const VIEWER_MESSAGE_TYPES = [
    'switchDocument',
    'editDocument',
    'refreshContent',
    'ready',
    'refineLine',
    'editLine',
    'removeLine',
    'toggleCheckbox',
    'editSource',
    'regenerate',
    'approve',
    'showTerminal',
    'clarify',
    'footerAction',
    'stepperClick',
    'addComment',
    'removeComment',
    'editComment',
    'runDocRefinement',
    'completeSpec',
    'archiveSpec',
    'reactivateSpec',
    'resumeRun',
    'setStatus',
    'livingUpdate',
    'livingSyncAll',
    'livingAdopt',
    'livingValidate',
    'revealGlob',
    'overviewChosen',
    'removeRequirement',
    'approveRequirement',
    'undoLivingAction',
    'approveSpec',
    'reportAction',
    'reportAnswer',
    'openIdea',
    'openFile',
    'openLivingSpec',
    'webviewError',
    'installSpecKitExtension',
    'openReadme',
    'dismissInstallBanner',
] as const;

/** Checks the discriminant only; each message's payload is the host's to read. */
export const ViewerMessageSchema = z.looseObject({ type: z.enum(VIEWER_MESSAGE_TYPES) });
