/**
 * SpecKit Companion — webview design system catalogue.
 *
 * The canonical list of reusable Preact components. Every interactive
 * primitive in the spec viewer (and future webviews) should reach for one
 * of these before rolling a one-off. New primitives go here and get a
 * matching `*.stories.tsx` so future contributors can see the variants at
 * a glance.
 *
 * Style tokens live in `webview/styles/tokens.css`. Primitive defaults
 * (Card / EmptyState / Tooltip / Button variants) live in
 * `_primitives.css` and `_buttons.css` under `webview/styles/spec-viewer/`.
 */

export { Button } from './Button';
export type { ButtonProps, ButtonVariant } from './Button';

export { Badge } from './Badge';
export type { BadgeProps, BadgeVariant } from './Badge';

export { Card } from './Card';
export type { CardProps } from './Card';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { Input } from './Input';
export type { InputProps, InputVariant } from './Input';

export { Toast, showToast } from './Toast';
export type { ToastProps } from './Toast';

export { Tooltip } from './Tooltip';
export type { TooltipProps } from './Tooltip';

export { UndoToast } from './UndoToast';
export type { UndoToastProps } from './UndoToast';
