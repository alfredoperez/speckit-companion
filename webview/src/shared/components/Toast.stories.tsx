import type { Meta, StoryObj } from '@storybook/preact';
import { Toast, showToast } from './Toast';

const meta: Meta<typeof Toast> = {
    title: 'Primitives/Toast',
    component: Toast,
};
export default meta;

type Story = StoryObj<typeof Toast>;

/** Simulates the footer context so the floating toast positions correctly. */
const FooterWrapper = ({ children }: { children: any }) => (
    <div style="position: relative; display: flex; align-items: center; padding: 8px 16px; background: var(--bg-secondary, #1e1e1e); border-top: 1px solid var(--border, #333); margin-top: 120px;">
        {children}
    </div>
);

export const Default: Story = {
    render: () => (
        <FooterWrapper>
            <button onClick={() => showToast('demo-toast', 'Spec archived successfully!')}>
                Show Toast
            </button>
            <Toast id="demo-toast" />
        </FooterWrapper>
    ),
};

export const LongMessage: Story = {
    render: () => (
        <FooterWrapper>
            <button onClick={() => showToast('demo-long', 'Plan regenerated — 12 tasks updated')}>
                Show Toast
            </button>
            <Toast id="demo-long" />
        </FooterWrapper>
    ),
};

export const RapidReplacement: Story = {
    render: () => {
        let count = 0;
        return (
            <FooterWrapper>
                <button onClick={() => showToast('demo-replace', `Toast #${++count}`)}>
                    Click rapidly
                </button>
                <Toast id="demo-replace" />
            </FooterWrapper>
        );
    },
};

export const CustomDuration: Story = {
    render: () => (
        <FooterWrapper>
            <button onClick={() => showToast('demo-duration', 'Visible for 5 seconds', 5000)}>
                Show (5s)
            </button>
            <Toast id="demo-duration" />
        </FooterWrapper>
    ),
};
