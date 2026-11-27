// A modal holds the keyboard while open: focus goes in, Tab stays in, Escape closes, focus goes back.
import { RefObject } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function useModal(box: RefObject<HTMLElement>, onClose: () => void, first?: string): void {
    const opener = useRef<HTMLElement | null>(null);
    const close = useRef(onClose);
    close.current = onClose;

    useLayoutEffect(() => {
        const was = document.activeElement as HTMLElement | null;
        opener.current = was && was !== document.body ? was : null;
        const self = box.current;
        ((first ? self?.querySelector<HTMLElement>(first) : null)
            ?? self?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
        return () => {
            const active = document.activeElement;
            const lost = !active || active === document.body || Boolean(self?.contains(active));
            if (lost && opener.current?.isConnected) { opener.current.focus(); }
        };
    }, []);

    useLayoutEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (!box.current) { return; }
            if (event.key === 'Escape') {
                if (box.current.querySelector('[aria-haspopup][aria-expanded="true"]')) { return; }
                event.preventDefault();
                close.current();
                return;
            }
            if (event.key !== 'Tab') { return; }
            const stops = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE))
                .filter(el => !el.closest('[hidden]'));
            if (stops.length === 0) { return; }
            const head = stops[0];
            const tail = stops[stops.length - 1];
            const at = document.activeElement;
            if (event.shiftKey && (at === head || !box.current.contains(at))) {
                event.preventDefault();
                tail.focus();
            } else if (!event.shiftKey && (at === tail || !box.current.contains(at))) {
                event.preventDefault();
                head.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);
}
