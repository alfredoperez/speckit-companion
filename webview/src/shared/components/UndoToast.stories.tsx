import type { Meta, StoryObj } from '@storybook/preact';
import { useState } from 'preact/hooks';
import { UndoToast } from './UndoToast';
import { Button } from './Button';

const meta: Meta<typeof UndoToast> = {
    title: 'Primitives/UndoToast',
    component: UndoToast,
};
export default meta;

type Story = StoryObj<typeof UndoToast>;

/**
 * Static snapshot — useful for theme/visual review. The countdown does
 * not actually tick in this story; see Interactive for the live version.
 */
export const Default: Story = {
    args: {
        message: 'Regenerating in 5s…',
        countdownMs: 5000,
        active: true,
        onElapse: () => undefined,
        onUndo: () => undefined,
    },
};

export const ShortWindow: Story = {
    args: {
        message: 'Deleting in 2s…',
        countdownMs: 2000,
        active: true,
        onElapse: () => undefined,
        onUndo: () => undefined,
    },
};

/**
 * Interactive — toggles the toast on with a button so the countdown +
 * Undo / Escape handling can be exercised visually.
 */
export const Interactive: Story = {
    render: () => {
        const [active, setActive] = useState(false);
        const [log, setLog] = useState<string[]>([]);
        const push = (msg: string) => setLog((prev) => [...prev, msg]);

        return (
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <Button
                    label={active ? 'Cancel toast' : 'Trigger regenerate'}
                    variant={active ? 'secondary' : 'primary'}
                    onClick={() => {
                        if (active) {
                            push('cancelled by user click');
                            setActive(false);
                        } else {
                            setActive(true);
                        }
                    }}
                />
                <UndoToast
                    message="Regenerating in 5s…"
                    countdownMs={5000}
                    active={active}
                    onElapse={() => {
                        push('elapsed — regenerate fired');
                        setActive(false);
                    }}
                    onUndo={() => {
                        push('undone');
                        setActive(false);
                    }}
                />
                <pre style="margin: 0; padding: 8px; background: var(--bg-elevated, #1e1e1e); border-radius: 4px; font-size: 11px; min-height: 100px;">
                    {log.length === 0 ? '(no events)' : log.join('\n')}
                </pre>
            </div>
        );
    },
};
