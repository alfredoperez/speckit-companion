import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import type { ActivityTab, ActivityTabId } from '../activityTabsModel';

export interface ActivityTabsProps {
    tabs: ActivityTab[];
    active: ActivityTabId;
    onSelect: (id: ActivityTabId) => void;
    children: ComponentChildren;
}

/**
 * Accessible segmented tabs for the Activity panel detail: tablist/tab
 * semantics with arrow-key navigation. Renders only the tabs it is given
 * (empty tabs are filtered by the model). `children` is the active panel.
 */
export function ActivityTabs({ tabs, active, onSelect, children }: ActivityTabsProps) {
    const listRef = useRef<HTMLDivElement>(null);
    if (tabs.length === 0) return null;

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const idx = tabs.findIndex(t => t.id === active);
        const next = e.key === 'ArrowRight'
            ? tabs[(idx + 1) % tabs.length]
            : tabs[(idx - 1 + tabs.length) % tabs.length];
        onSelect(next.id);
        const btn = listRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`);
        btn?.focus();
    };

    return (
        <div class="activity-tabs">
            <div class="activity-tabs__bar" role="tablist" aria-label="Activity detail" ref={listRef} onKeyDown={onKeyDown}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        data-tab={tab.id}
                        id={`activity-tab-${tab.id}`}
                        aria-selected={tab.id === active}
                        aria-controls={`activity-panel-${tab.id}`}
                        tabIndex={tab.id === active ? 0 : -1}
                        class={tab.id === active ? 'activity-tabs__tab is-active' : 'activity-tabs__tab'}
                        onClick={() => onSelect(tab.id)}
                    >
                        {tab.label}
                        {tab.count !== undefined && <span class="activity-tabs__count">{tab.count}</span>}
                    </button>
                ))}
            </div>
            <div
                class="activity-tabs__panel"
                role="tabpanel"
                id={`activity-panel-${active}`}
                aria-labelledby={`activity-tab-${active}`}
            >
                <h2 class="sr-only">{tabs.find(t => t.id === active)?.label}</h2>
                {children}
            </div>
        </div>
    );
}
