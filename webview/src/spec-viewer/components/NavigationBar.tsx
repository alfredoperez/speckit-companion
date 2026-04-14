import type { VSCodeApi } from '../types';
import { navState } from '../signals';
import { StepTab } from './StepTab';

declare const vscode: VSCodeApi;

export function NavigationBar() {
    const ns = navState.value;
    if (!ns) return null;

    const { coreDocs, relatedDocs, currentDoc, workflowPhase,
        taskCompletionPercent, isViewingRelatedDoc, activeStep,
        stepHistory, stalenessMap } = ns;

    const viewingRelatedDoc = isViewingRelatedDoc
        ? relatedDocs.find(d => d.type === currentDoc)
        : undefined;
    const parentPhaseForRelated = viewingRelatedDoc?.parentStep || coreDocs?.[0]?.type || 'spec';

    // Index of the step currently running (activeStep with no completedAt).
    // Future tabs beyond this index get locked while the step is in-flight.
    const runningStepIndex = (() => {
        if (!activeStep) return null;
        if (stepHistory?.[activeStep]?.completedAt) return null;
        const idx = coreDocs.findIndex(d => d.type === activeStep);
        return idx >= 0 ? idx : null;
    })();

    const handleClick = (phase: string) => {
        vscode.postMessage({ type: 'stepperClick', phase });
    };

    return (
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
        </div>
    );
}
