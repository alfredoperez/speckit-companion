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
