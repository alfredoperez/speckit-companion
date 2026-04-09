import type { Meta, StoryObj } from '@storybook/preact';
import { Toast, showToast } from './Toast';

const meta: Meta<typeof Toast> = {
    title: 'Primitives/Toast',
    component: Toast,
};
export default meta;

type Story = StoryObj<typeof Toast>;

export const Default: Story = {
    render: () => (
        <div>
            <button onClick={() => showToast('demo-toast', 'Spec archived successfully!')}>
                Show Toast
            </button>
            <div style="margin-top: 12px;">
                <Toast id="demo-toast" />
            </div>
        </div>
    ),
};
