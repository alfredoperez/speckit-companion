import type { VSCodeApi, SpecDocument } from '../types';
import { navState, overviewAvailable, showingOverview, viewerMode } from '../signals';
import { StepTab } from './StepTab';

declare const vscode: VSCodeApi;

export function NavigationBar() {
    const ns = navState.value;
    if (!ns) return null;

    const { coreDocs, relatedDocs, currentDoc,
        taskCompletionPercent, isViewingRelatedDoc, activeStep,
        currentStep, stepHistory, stalenessMap } = ns;

    // Living-spec mode: no workflow phases to step through — render only a
    // flat tier tab strip (Spec / Architecture / Coverage).
    if (ns.livingMode) {
        const tiers = coreDocs.filter(d => d.exists);
        if (tiers.length <= 1) return null;
        return (
            <div class="step-children" aria-label="Living spec tiers">
                <div class="step-children-tabs">
                    {tiers.map(doc => (
                        <button
                            key={doc.type}
                            class={`step-child ${doc.type === currentDoc ? 'active' : ''}`}
                            data-doc={doc.type}
                            aria-current={doc.type === currentDoc ? 'page' : undefined}
                            onClick={() => vscode.postMessage({ type: 'switchDocument', documentType: doc.type })}
                        >
                            {doc.label}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // The rail lists documents only: action steps (Implement, Mark Complete,
    // any custom step without a document) never render as entries. Every
    // index below is computed against this rendered list so hidden steps
    // can't shift or lock tabs.
    const railDocs = (coreDocs ?? []).filter(d => d.category !== 'action');
    const rootPhase = railDocs[0]?.type || 'spec';
    // The implement percent renders on the implement entry when a workflow
    // defines it as a document step, else on the last rendered tab.
    const percentHostType = railDocs.find(d => d.type === 'implement')?.type
        ?? railDocs[railDocs.length - 1]?.type;
    const viewingRelatedDoc = isViewingRelatedDoc
        ? relatedDocs.find(d => d.type === currentDoc)
        : undefined;
    const parentPhaseForRelated = viewingRelatedDoc?.parentStep || rootPhase;

    // Index of the step currently running — derive from stepHistory
    // (entry with startedAt set and no completedAt). Future tabs beyond this
    // index get locked while the step is in-flight. A running step with no
    // rail entry (a hidden action step) yields no index, so it locks nothing.
    const runningStepIndex = (() => {
        if (!stepHistory) return null;
        for (const [stepKey, entry] of Object.entries(stepHistory)) {
            if (entry?.startedAt && !entry?.completedAt) {
                const idx = railDocs.findIndex(d => d.type === stepKey);
                if (idx >= 0) return idx;
            }
        }
        return null;
    })();

    // Selecting any document from the rail is a "read documents" action —
    // the shell leaves the Overview if it was showing.
    const handleClick = (phase: string) => {
        viewerMode.value = 'document';
        vscode.postMessage({ type: 'stepperClick', phase });
    };

    const handleRelatedClick = (docType: string) => {
        viewerMode.value = 'document';
        vscode.postMessage({ type: 'switchDocument', documentType: docType });
    };

    // Artifact groups: every existing related doc, grouped under
    // its owning step, always visible — "where am I" answers from one place
    // instead of a per-step second row.
    const groups: Array<{ parent: SpecDocument | undefined; key: string; docs: SpecDocument[] }> = [];
    for (const doc of relatedDocs) {
        if (!doc.exists) continue;
        const parentType = doc.parentStep || rootPhase;
        let group = groups.find(g => g.key === parentType);
        if (!group) {
            group = { parent: coreDocs.find(d => d.type === parentType), key: parentType, docs: [] };
            groups.push(group);
        }
        group.docs.push(doc);
    }

    const recovery = ns.runRecovery;

    // The Overview is a rail destination, so selecting it deselects every document.
    const hasOverview = overviewAvailable.value;
    const onOverview = showingOverview.value;
    const selectedDoc = onOverview ? '' : currentDoc;

    return (
        <nav class="doc-rail" aria-label="Spec documents">
            {hasOverview && (
                <div class="rail-group">
                    <button
                        type="button"
                        class={`rail-overview${onOverview ? ' current' : ''}`}
                        aria-current={onOverview ? 'page' : undefined}
                        onClick={() => { viewerMode.value = 'overview'; }}
                    >
                        <span class="codicon codicon-book" aria-hidden="true" />
                        Overview
                    </button>
                </div>
            )}
            {recovery?.show && (
                <div class={`run-recovery run-recovery--${recovery.mode}`} role="status">
                    <span class="run-recovery__msg" title={recovery.message}>{recovery.message}</span>
                    <div class="run-recovery__actions">
                        {recovery.mode === 'stale' ? (
                            // Nothing has been running for days — resuming is the
                            // wrong offer, so closing the spec out leads instead.
                            <button
                                type="button"
                                class="run-recovery__btn run-recovery__btn--primary"
                                title="Mark this spec as completed"
                                onClick={() => vscode.postMessage({ type: 'completeSpec' })}
                            >
                                Mark complete
                            </button>
                        ) : (
                            <button
                                type="button"
                                class="run-recovery__btn run-recovery__btn--primary"
                                title="Resume the pipeline from where it left off"
                                onClick={() => vscode.postMessage({ type: 'resumeRun' })}
                            >
                                Resume
                            </button>
                        )}
                        <button
                            type="button"
                            class="run-recovery__btn"
                            title="Force this spec to a lifecycle status"
                            onClick={() => vscode.postMessage({ type: 'setStatus' })}
                        >
                            Set status…
                        </button>
                    </div>
                </div>
            )}
            <div class="rail-group">
                <p class="rail-label">Pipeline</p>
                <div class="step-tabs">
                    {railDocs.map((doc, i) => (
                        <StepTab
                            key={doc.type}
                            doc={doc}
                            index={i}
                            currentDoc={selectedDoc}
                            taskCompletionPercent={taskCompletionPercent}
                            isViewingRelatedDoc={!onOverview && isViewingRelatedDoc}
                            parentPhaseForRelated={parentPhaseForRelated}
                            activeStep={activeStep}
                            currentStep={currentStep}
                            stepHistory={stepHistory}
                            stalenessMap={stalenessMap}
                            hasRelatedChildren={relatedDocs.some(d => d.parentStep === doc.type)}
                            runningStepIndex={runningStepIndex}
                            isPercentHost={doc.type === percentHostType}
                            onClick={handleClick}
                        />
                    ))}
                </div>
            </div>
            {groups.map(group => (
                <div class="rail-group" key={group.key}>
                    <p class="rail-label">{group.parent ? `${group.parent.label} files` : 'Artifacts'}</p>
                    <div class="step-children-tabs">
                        {group.docs.map(doc => (
                            <button
                                key={doc.type}
                                class={`step-child ${doc.type === selectedDoc ? 'active' : ''}`}
                                data-doc={doc.type}
                                aria-current={doc.type === selectedDoc ? 'page' : undefined}
                                onClick={() => handleRelatedClick(doc.type)}
                            >
                                {doc.label}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </nav>
    );
}
