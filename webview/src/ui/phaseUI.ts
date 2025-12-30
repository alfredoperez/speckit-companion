/**
 * Phase UI management
 */
import type { SpecInfo } from '../types';

export function updatePhaseUI(specInfo: SpecInfo): void {
    document.querySelectorAll('.phase-stepper .step').forEach(step => {
        const phase = (step as HTMLElement).dataset.phase;
        const phaseNum = phase === 'spec' ? 1 : phase === 'plan' ? 2 : 3;

        step.classList.toggle('active', phaseNum === specInfo.currentPhase);
        step.classList.toggle('completed', phaseNum < specInfo.currentPhase);

        const indicator = step.querySelector('.step-indicator');
        if (indicator) {
            indicator.textContent = phaseNum < specInfo.currentPhase ? '✓' : phaseNum.toString();
        }
    });

    document.querySelectorAll('.step-connector').forEach((connector, index) => {
        connector.classList.toggle('completed', index + 1 < specInfo.currentPhase);
    });
}
