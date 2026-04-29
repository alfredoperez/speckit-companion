import type { Transition } from '../types';
import { transitions } from '../signals';
import { TimelineEntry } from './TimelineEntry';

interface StepGroup {
    step: string;
    entries: Transition[];
}

function groupByStep(items: Transition[]): StepGroup[] {
    const groups: StepGroup[] = [];
    for (const entry of items) {
        const last = groups[groups.length - 1];
        if (last && last.step === entry.step) {
            last.entries.push(entry);
        } else {
            groups.push({ step: entry.step, entries: [entry] });
        }
    }
    return groups;
}

export function TimelinePanel() {
    const items = transitions.value;
    if (items.length === 0) {
        return (
            <div class="timeline-panel">
                <div class="timeline-empty">No transitions recorded yet</div>
            </div>
        );
    }

    const groups = groupByStep(items);
    return (
        <div class="timeline-panel">
            {groups.map((group, idx) => (
                <section
                    key={`${group.step}-${idx}`}
                    class="timeline-step-group"
                    data-step={group.step}
                >
                    <h3 class="timeline-step-heading">{group.step}</h3>
                    {group.entries.map((entry, i) => (
                        <TimelineEntry key={`${entry.at}-${i}`} transition={entry} />
                    ))}
                </section>
            ))}
        </div>
    );
}
