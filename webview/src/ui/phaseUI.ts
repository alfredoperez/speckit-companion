/**
 * Phase UI management
 */
import type { SpecInfo } from "../types";

export function updatePhaseUI(specInfo: SpecInfo): void {
  const completedPhases = specInfo.completedPhases || [];
  const taskPercent = specInfo.taskCompletionPercent || 0;
  const phase3Complete = completedPhases.includes(3);
  const allTasksDone = taskPercent === 100;

  document.querySelectorAll(".phase-stepper .step").forEach(step => {
    const stepEl = step as HTMLElement;
    const phase = stepEl.dataset.phase;

    if (phase === "done") {
      // Handle logical state classes
      step.classList.toggle("completed", allTasksDone);
      step.classList.toggle(
        "in-progress",
        phase3Complete && !allTasksDone && taskPercent > 0,
      );

      // Check if we need to structural transform (Badge VS Circle)
      const isCurrentlyBadge = step.classList.contains("spec-completed-badge");

      if (allTasksDone && !isCurrentlyBadge) {
        // Transform to Badge
        step.classList.add("spec-completed-badge");
        step.innerHTML = `
                    <span class="badge-icon">🌱</span>
                    <span class="badge-text">SPEC COMPLETED</span>
                `;
      } else if (!allTasksDone && isCurrentlyBadge) {
        // Transform back to Circle
        step.classList.remove("spec-completed-badge");
        step.innerHTML = `
                    <div class="step-indicator"></div>
                    <div class="step-label">Done</div>
                `;
      }

      // Update content if currently a circle (not a badge)
      if (!allTasksDone) {
        const indicator = step.querySelector(".step-indicator");
        if (indicator) {
          if (phase3Complete && taskPercent > 0) {
            indicator.textContent = `${taskPercent}%`;
          } else {
            indicator.textContent = "4";
          }
        }
      }
    } else {
      // Standard phases (1-3)
      const phaseNum = phase === "spec" ? 1 : phase === "plan" ? 2 : 3;
      const isCompleted = completedPhases.includes(phaseNum);

      step.classList.toggle("active", phaseNum === specInfo.currentPhase);
      step.classList.toggle("completed", isCompleted);
      step.classList.remove("in-progress");

      const indicator = step.querySelector(".step-indicator");
      if (indicator) {
        indicator.textContent = isCompleted ? "✓" : phaseNum.toString();
      }
    }
  });

  document.querySelectorAll(".step-connector").forEach((connector, index) => {
    const phaseNum = index + 1;
    connector.classList.toggle("completed", completedPhases.includes(phaseNum));
    connector.classList.remove("in-progress");
  });
}
