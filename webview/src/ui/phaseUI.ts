/**
 * Phase UI management
 */
import type { SpecInfo } from '../types';

export function updatePhaseUI(specInfo: SpecInfo): void {
    const completedPhases = specInfo.completedPhases || [];
    const taskPercent = specInfo.taskCompletionPercent || 0;
    const phase3Complete = completedPhases.includes(3);
    const allTasksDone = taskPercent === 100;

    document.querySelectorAll('.phase-stepper .step').forEach(step => {
        const phase = (step as HTMLElement).dataset.phase;
        const phaseNum = phase === 'spec' ? 1 : phase === 'plan' ? 2 : phase === 'tasks' ? 3 : 4;
        const isCompleted = completedPhases.includes(phaseNum);

        // Active = currently viewing this file (not for "done" phase)
        step.classList.toggle('active', phaseNum === specInfo.currentPhase && phase !== 'done');

        // Completed = file exists (for phases 1-3) or all tasks done (for phase 4)
        if (phase === 'done') {
            step.classList.toggle('completed', allTasksDone);
            step.classList.toggle('in-progress', phase3Complete && !allTasksDone && taskPercent > 0);
        } else {
            step.classList.toggle('completed', isCompleted);
            step.classList.remove('in-progress');
        }

        const indicator = step.querySelector('.step-indicator');
        if (indicator) {
            if (phase === 'done') {
                // Done shows percentage when in progress, checkmark when 100%
                if (allTasksDone) {
                    indicator.textContent = '✓';
                } else if (phase3Complete && taskPercent > 0) {
                    indicator.textContent = `${taskPercent}%`;
                } else {
                    indicator.textContent = '4';
                }
            } else {
                // Other phases: checkmark if complete, number otherwise
                indicator.textContent = isCompleted ? '✓' : phaseNum.toString();
            }
        }
    });

    document.querySelectorAll('.step-connector').forEach((connector, index) => {
        const phaseNum = index + 1;
        connector.classList.toggle('completed', completedPhases.includes(phaseNum));
        connector.classList.remove('in-progress');
    });
}
