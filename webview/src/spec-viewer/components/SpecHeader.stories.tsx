import type { Meta, StoryObj } from '@storybook/preact';
import { navState, viewerState as vs } from '../signals';
import { SpecHeader } from './SpecHeader';
import { mockNavState } from './__stories__/mockData';

const meta: Meta<typeof SpecHeader> = {
    title: 'Viewer/SpecHeader',
    component: SpecHeader,
    // Reset body[data-spec-status] before every story so a previous status
    // variant doesn't leak into the next one. Status stories below re-apply
    // the attribute via their own decorator.
    decorators: [
        (Story) => {
            document.body.removeAttribute('data-spec-status');
            return <Story />;
        },
    ],
};
export default meta;

type Story = StoryObj<typeof SpecHeader>;

/** Per-story decorator that sets body[data-spec-status] for the duration of the story. */
const withStatus = (status: string) => (Story: any) => {
    document.body.setAttribute('data-spec-status', status);
    return <Story />;
};

export const Full: Story = {
    render: () => {
        navState.value = mockNavState({
            badgeText: 'COMPLETED',
            createdDate: 'Apr 4, 2026',
            specContextName: 'Explorer Viewer Fixes',
            branch: 'main',
            docTypeLabel: 'Tasks',
        });
        return <SpecHeader />;
    },
};

export const ActiveDraft: Story = {
    render: () => {
        navState.value = mockNavState({
            badgeText: 'DRAFT',
            createdDate: 'Apr 6, 2026',
            specContextName: 'New Feature',
            branch: 'feat/new-feature',
            docTypeLabel: 'Spec',
        });
        return <SpecHeader />;
    },
};

export const MinimalTitle: Story = {
    render: () => {
        navState.value = mockNavState({
            badgeText: null,
            createdDate: null,
            specContextName: 'Minimal Spec',
            branch: null,
            docTypeLabel: 'Spec',
        });
        return <SpecHeader />;
    },
};

export const Empty: Story = {
    render: () => {
        navState.value = mockNavState({
            badgeText: null,
            createdDate: null,
            specContextName: null,
            branch: null,
        });
        return <SpecHeader />;
    },
};

// ── Spec-badge variants driven by body[data-spec-status] ─────
// Each sets the attribute via the `withStatus` decorator so the
// .spec-badge overrides in _content.css (lines 275–297) render.

export const StatusActive: Story = {
    decorators: [withStatus('active')],
    render: () => {
        navState.value = mockNavState({
            badgeText: 'ACTIVE',
            specContextName: 'Active Feature',
            docTypeLabel: 'Spec',
        });
        return <SpecHeader />;
    },
};

export const StatusCompleted: Story = {
    decorators: [withStatus('completed')],
    render: () => {
        navState.value = mockNavState({
            badgeText: 'COMPLETED',
            specContextName: 'Completed Feature',
            docTypeLabel: 'Tasks',
        });
        return <SpecHeader />;
    },
};

export const StatusArchived: Story = {
    decorators: [withStatus('archived')],
    render: () => {
        navState.value = mockNavState({
            badgeText: 'ARCHIVED',
            specContextName: 'Archived Feature',
            docTypeLabel: 'Spec',
        });
        return <SpecHeader />;
    },
};

export const StatusTasksDone: Story = {
    decorators: [withStatus('tasks-done')],
    render: () => {
        navState.value = mockNavState({
            badgeText: 'TASKS DONE',
            specContextName: 'All Tasks Complete',
            docTypeLabel: 'Tasks',
        });
        return <SpecHeader />;
    },
};

// ── Renamed status labels (spec 094, second pass) ─────────
// These show the friendlier visible labels for status keys
// whose default hyphen-split capitalization isn't great.

export const StatusCreatingTasks: Story = {
    name: 'Creating Tasks',
    decorators: [withStatus('tasking')],
    render: () => {
        navState.value = mockNavState({
            specContextName: 'Tasking In Progress',
            docTypeLabel: 'Tasks',
        });
        vs.value = {
            status: 'tasking',
            activeStep: 'tasks',
            steps: {},
            pulse: null,
            highlights: [],
            activeSubstep: null,
            footer: [],
        };
        return <SpecHeader />;
    },
};

export const StatusTasksCreated: Story = {
    name: 'Tasks Created',
    decorators: [withStatus('ready-to-implement')],
    render: () => {
        navState.value = mockNavState({
            specContextName: 'Ready For Build',
            docTypeLabel: 'Tasks',
        });
        vs.value = {
            status: 'ready-to-implement',
            activeStep: 'tasks',
            steps: {},
            pulse: null,
            highlights: [],
            activeSubstep: null,
            footer: [],
        };
        return <SpecHeader />;
    },
};

// ── Living specs ─────────────────────────────────────────
// A living spec has no branch, date, phases or task progress —
// the header carries capability facts instead. `viewerState` is
// left null so the badge text comes from navState, as it does in
// the real living-spec panel.

const livingMeta = (overrides = {}) => ({
    capabilityName: 'speckit-extension-capture',
    specPath: 'capabilities/speckit-extension-capture/spec.md',
    location: 'centralized' as const,
    match: ['speckit-extension/**'],
    ...overrides,
});

const living = (overrides: any = {}) => {
    vs.value = null;
    navState.value = mockNavState({
        livingMode: true,
        badgeText: 'LIVING',
        branch: null,
        createdDate: null,
        specContextName: 'SpecKit Extension Capture',
        titleFromHeading: true,
        docTypeLabel: 'Spec',
        ...overrides,
    });
    return <SpecHeader />;
};

export const LivingFull: Story = {
    name: 'Living — everything known',
    decorators: [withStatus('active')],
    render: () => living({
        livingMeta: livingMeta({
            requirements: 12,
            scenarios: 34,
            coverage: { covered: 8, total: 12 },
            drifted: true,
            match: ['speckit-extension/**', 'src/features/specs/**'],
        }),
    }),
};

export const LivingDraft: Story = {
    name: 'Living — draft',
    decorators: [withStatus('draft')],
    render: () => living({
        badgeText: 'DRAFT',
        specContextName: 'Payments Core',
        livingMeta: livingMeta({
            capabilityName: 'payments-core',
            specPath: 'capabilities/payments-core/spec.md',
            requirements: 6,
            scenarios: 9,
            match: ['src/billing/**'],
        }),
    }),
};

export const LivingNoCoverage: Story = {
    name: 'Living — no coverage tier',
    decorators: [withStatus('active')],
    render: () => living({
        livingMeta: livingMeta({ requirements: 12, scenarios: 34 }),
    }),
};

export const LivingDrifted: Story = {
    name: 'Living — drifted, fully covered',
    decorators: [withStatus('active')],
    render: () => living({
        livingMeta: livingMeta({
            requirements: 9,
            scenarios: 21,
            coverage: { covered: 9, total: 9 },
            drifted: true,
        }),
    }),
};

export const LivingManyGlobs: Story = {
    name: 'Living — many claimed patterns',
    decorators: [withStatus('active')],
    render: () => living({
        livingMeta: livingMeta({
            requirements: 62,
            scenarios: 140,
            coverage: { covered: 41, total: 62 },
            match: [
                'src/features/specs/**',
                'src/features/spec-viewer/**',
                'src/features/steering/**',
                'webview/src/spec-viewer/**',
                'webview/styles/**',
                'docs/viewer-states.md',
            ],
        }),
    }),
};

export const LivingLongTitle: Story = {
    name: 'Living — long title, colocated spec',
    decorators: [withStatus('active')],
    render: () => living({
        specContextName: 'Cross-Provider Terminal Dispatch And Session Recovery',
        livingMeta: livingMeta({
            capabilityName: 'terminal-dispatch',
            specPath: 'src/ai-providers/terminal/dispatch.spec.md',
            location: 'colocated',
            requirements: 18,
            scenarios: 44,
            coverage: { covered: 12, total: 18 },
            match: ['src/ai-providers/**'],
        }),
    }),
};

export const LivingBare: Story = {
    name: 'Living — nothing determinable',
    decorators: [withStatus('active')],
    render: () => living({
        livingMeta: livingMeta({ match: [] }),
    }),
};

export const StatusImplemented: Story = {
    name: 'Implemented',
    decorators: [withStatus('implemented')],
    render: () => {
        navState.value = mockNavState({
            specContextName: 'Build Done — Awaiting Approval',
            docTypeLabel: 'Tasks',
        });
        vs.value = {
            status: 'implemented',
            activeStep: 'implement',
            steps: {},
            pulse: null,
            highlights: [],
            activeSubstep: null,
            footer: [],
        };
        return <SpecHeader />;
    },
};
