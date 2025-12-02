/**
 * Task Progress Service
 *
 * Tracks task completion progress in tasks.md files and detects
 * when phases are newly completed to trigger notifications.
 */

export interface PhaseProgress {
    phaseName: string;
    total: number;
    completed: number;
    isComplete: boolean;
}

export interface SpecProgress {
    specName: string;
    specPath: string;
    phases: PhaseProgress[];
    totalTasks: number;
    completedTasks: number;
}

// In-memory cache of previous state per spec path
const progressCache = new Map<string, SpecProgress>();

/**
 * Parse a tasks.md file and extract phase progress information
 */
export function parseTasksFile(content: string, specName: string, specPath: string): SpecProgress {
    const lines = content.split('\n');
    const phases: PhaseProgress[] = [];
    let currentPhase: PhaseProgress | null = null;

    for (const line of lines) {
        // Detect phase headers: ## Phase N: or ### Phase N:
        const phaseMatch = line.match(/^#{2,3}\s+Phase\s+\d+[:\s]+(.+)/i);
        if (phaseMatch) {
            // Save previous phase if exists
            if (currentPhase) {
                currentPhase.isComplete = currentPhase.total > 0 && currentPhase.completed === currentPhase.total;
                phases.push(currentPhase);
            }
            // Start new phase
            currentPhase = {
                phaseName: phaseMatch[1].trim(),
                total: 0,
                completed: 0,
                isComplete: false,
            };
            continue;
        }

        // Detect tasks: - [ ] or - [x] (case insensitive for x)
        const taskMatch = line.match(/^\s*-\s+\[([ xX])\]/);
        if (taskMatch && currentPhase) {
            currentPhase.total++;
            if (taskMatch[1].toLowerCase() === 'x') {
                currentPhase.completed++;
            }
        }
    }

    // Don't forget the last phase
    if (currentPhase) {
        currentPhase.isComplete = currentPhase.total > 0 && currentPhase.completed === currentPhase.total;
        phases.push(currentPhase);
    }

    // Calculate totals
    const totalTasks = phases.reduce((sum, p) => sum + p.total, 0);
    const completedTasks = phases.reduce((sum, p) => sum + p.completed, 0);

    return {
        specName,
        specPath,
        phases,
        totalTasks,
        completedTasks,
    };
}

/**
 * Compare current progress with cached state and return newly completed phase names
 */
export function detectNewlyCompletedPhases(specPath: string, current: SpecProgress): string[] {
    const previous = progressCache.get(specPath);
    const newlyCompleted: string[] = [];

    if (previous) {
        for (const currentPhase of current.phases) {
            // Find matching phase in previous state
            const prevPhase = previous.phases.find((p) => p.phaseName === currentPhase.phaseName);

            // Phase is newly complete if:
            // - It's complete now
            // - AND (it didn't exist before OR it wasn't complete before)
            if (currentPhase.isComplete && (!prevPhase || !prevPhase.isComplete)) {
                newlyCompleted.push(currentPhase.phaseName);
            }
        }
    }

    // Update cache with current state
    progressCache.set(specPath, current);

    return newlyCompleted;
}

/**
 * Initialize cache for a spec (call on first load to avoid false notifications)
 */
export function initializeCache(specPath: string, progress: SpecProgress): void {
    progressCache.set(specPath, progress);
}

/**
 * Clear cache for a spec (call when spec is deleted)
 */
export function clearCache(specPath: string): void {
    progressCache.delete(specPath);
}

/**
 * Clear all cached progress data
 */
export function clearAllCache(): void {
    progressCache.clear();
}

/**
 * Get cached progress for a spec (useful for UI display)
 */
export function getCachedProgress(specPath: string): SpecProgress | undefined {
    return progressCache.get(specPath);
}

/**
 * Extract spec name from file path
 * e.g., /path/to/specs/my-feature/tasks.md -> my-feature
 */
export function extractSpecNameFromPath(filePath: string): string {
    const parts = filePath.split('/');
    const tasksIndex = parts.findIndex((p) => p === 'tasks.md');
    if (tasksIndex > 0) {
        return parts[tasksIndex - 1];
    }
    // Fallback: use parent directory name
    return parts[parts.length - 2] || 'unknown';
}
