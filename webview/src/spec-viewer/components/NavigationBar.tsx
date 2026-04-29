import type { VSCodeApi } from '../types';
import { navState, timelineVisible } from '../signals';
import { StepTab } from './StepTab';

declare const vscode: VSCodeApi;

export function NavigationBar() {
    const ns = navState.value;
    if (!ns) return null;

    const { coreDocs, relatedDocs, currentDoc, workflowPhase,
        taskCompletionPercent, isViewingRelatedDoc, activeStep,
        currentStep, stepHistory, stalenessMap } = ns;

    const viewingRelatedDoc = isViewingRelatedDoc
        ? relatedDocs.find(d => d.type === currentDoc)
        : undefined;
    const parentPhaseForRelated = viewingRelatedDoc?.parentStep || coreDocs?.[0]?.type || 'spec';

    // Index of the step currently running — derive from stepHistory
    // (entry with startedAt set and no completedAt). Future tabs beyond this
    // index get locked while the step is in-flight.
    const runningStepIndex = (() => {
        if (!stepHistory) return null;
        for (const [stepKey, entry] of Object.entries(stepHistory)) {
            if (entry?.startedAt && !entry?.completedAt) {
                const idx = coreDocs.findIndex(d => d.type === stepKey);
                if (idx >= 0) return idx;
            }
        }
        return null;
    })();

    const handleClick = (phase: string) => {
        vscode.postMessage({ type: 'stepperClick', phase });
    };

    const handleRelatedClick = (docType: string) => {
        vscode.postMessage({ type: 'switchDocument', documentType: docType });
    };

    // Related tabs for the current step — rendered in a right-aligned slot
    // inside .nav-primary (R010, R011). The Overview tab is removed since
    // the parent step-tab itself routes to the overview.
    const relevantRelatedDocs = relatedDocs.filter(d =>
        d.parentStep === currentDoc
    );
    const displayRelatedDocs = isViewingRelatedDoc
        ? relatedDocs.filter(d => {
            return !d.parentStep || d.parentStep === viewingRelatedDoc?.parentStep;
        })
        : relevantRelatedDocs;

    // Parent step for the second-row children rail. When viewing a core step,
    // that step is its own parent; when viewing a related doc, parent comes from
    // the doc's parentStep field. Including the parent as the first child tab
    // gives users a single way back to the step's overview from any sub-doc.
    const parentStepType = isViewingRelatedDoc
        ? viewingRelatedDoc?.parentStep
        : currentDoc;
    const parentStepDoc = coreDocs.find(d => d.type === parentStepType);
    const showChildrenRow = displayRelatedDocs.length > 0 && parentStepDoc;

    const timelineActive = timelineVisible.value;
    const handleTimelineToggle = () => {
        timelineVisible.value = !timelineVisible.value;
    };

    return (
        <>
            <div class="nav-primary">
                <div class="step-tabs">
                    {coreDocs.map((doc, i) => {
                        const hasRelatedChildren = relatedDocs.some(d => d.parentStep === doc.type);
                        const exists = doc.exists || hasRelatedChildren;
                        return (
                            <>
                                <StepTab
                                    key={doc.type}
                                    doc={doc}
                                    index={i}
                                    totalSteps={coreDocs.length}
                                    currentDoc={currentDoc}
                                    workflowPhase={workflowPhase}
                                    taskCompletionPercent={taskCompletionPercent}
                                    isViewingRelatedDoc={isViewingRelatedDoc}
                                    parentPhaseForRelated={parentPhaseForRelated}
                                    activeStep={activeStep}
                                    currentStep={currentStep}
                                    stepHistory={stepHistory}
                                    stalenessMap={stalenessMap}
                                    hasRelatedChildren={hasRelatedChildren}
                                    runningStepIndex={runningStepIndex}
                                    onClick={handleClick}
                                />
                                {i < coreDocs.length - 1 && (
                                    <span class={`step-connector ${exists ? 'filled' : ''}`} />
                                )}
                            </>
                        );
                    })}
                </div>
                <button
                    type="button"
                    class="timeline-toggle"
                    aria-pressed={timelineActive}
                    title="Toggle timeline of all spec transitions"
                    onClick={handleTimelineToggle}
                >
                    Timeline
                </button>
            </div>
            {showChildrenRow && (
                <div class="step-children" aria-label={`${parentStepDoc.label} files`}>
                    <div class="step-children-tabs">
                        <button
                            key={parentStepDoc.type}
                            class={`step-child step-child--parent ${parentStepDoc.type === currentDoc ? 'active' : ''}`}
                            data-doc={parentStepDoc.type}
                            onClick={() => handleRelatedClick(parentStepDoc.type)}
                        >
                            {parentStepDoc.label}
                        </button>
                        {displayRelatedDocs.map(doc => (
                            <button
                                key={doc.type}
                                class={`step-child ${doc.type === currentDoc ? 'active' : ''}`}
                                data-doc={doc.type}
                                onClick={() => handleRelatedClick(doc.type)}
                            >
                                {doc.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
