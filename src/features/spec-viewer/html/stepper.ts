/**
 * SpecKit Companion - Stepper HTML Generation
 * Generates the phase stepper HTML
 */

import { PhaseInfo } from '../types';

/**
 * Generate the phase stepper HTML
 */
export function generatePhaseStepper(phases: PhaseInfo[], taskCompletionPercent: number): string {
    const steps = phases.map((phase, index) => {
        const isActive = phase.active;
        const isCompleted = phase.completed;
        const isInProgress = phase.phase === 4 && taskCompletionPercent > 0 && taskCompletionPercent < 100;

        let indicator = phase.phase.toString();
        let stepClass = '';

        if (isCompleted) {
            indicator = '✓';
            stepClass = 'completed';
        }
        if (isActive) {
            stepClass += ' active';
        }
        if (isInProgress) {
            indicator = `${taskCompletionPercent}%`;
            stepClass = 'in-progress';
        }

        // For Done phase with completion
        if (phase.phase === 4) {
            if (taskCompletionPercent === 100) {
                indicator = '✓';
                stepClass = 'completed';
            } else if (taskCompletionPercent > 0) {
                indicator = `${taskCompletionPercent}%`;
                stepClass = 'in-progress';
            } else {
                indicator = '4';
            }
        }

        const phaseKey = phase.phase === 1 ? 'spec' : phase.phase === 2 ? 'plan' : phase.phase === 3 ? 'tasks' : 'done';

        return `
            <div class="step ${stepClass.trim()}" data-phase="${phaseKey}">
                <div class="step-indicator">${indicator}</div>
                <div class="step-label">${phase.label}</div>
            </div>
        `;
    });

    // Add connectors between steps
    const stepsWithConnectors: string[] = [];
    for (let i = 0; i < steps.length; i++) {
        stepsWithConnectors.push(steps[i]);
        if (i < steps.length - 1) {
            const connectorClass = phases[i].completed ? 'completed' : '';
            const inProgressClass = phases[i].completed && !phases[i + 1].completed && phases[i + 1].progressPercent
                ? 'in-progress' : '';
            stepsWithConnectors.push(`<div class="step-connector ${connectorClass} ${inProgressClass}"></div>`);
        }
    }

    return `
        <nav class="phase-stepper">
            ${stepsWithConnectors.join('\n')}
        </nav>
    `;
}
