/**
 * Ledger id-chip behaviour: hover card, jump with flash, and the Back pill.
 * Everything is read from the rendered DOM and built with DOM APIs.
 */

import { navState } from './signals';
import { openDocumentAtFragment } from './documentLinks';
import { prefersReducedMotion } from './toc';
import { slugForId } from './markdown/ledger/primitives';

const HOVER_DELAY_MS = 300;
const HIDE_DELAY_MS = 120;
const FLASH_MS = 1400;
const MAX_CHARS = 220;
const CHIP = 'a.lg-chip[data-ref]';

const FAMILY_LABEL: Record<string, string> = {
    story: 'User story',
    req: 'Requirement',
    decision: 'Decision',
    task: 'Task',
    data: 'Data',
    guard: 'Guardrail',
};

const STATUS_LABEL: Record<string, string> = {
    done: 'Done',
    running: 'In progress',
    warn: 'Needs attention',
    fail: 'Failed',
    todo: 'To do',
};

interface Origin {
    el: Element;
    label: string;
}

let card: HTMLElement | null = null;
let pill: HTMLButtonElement | null = null;
let origin: Origin | null = null;
let showTimer: number | undefined;
let hideTimer: number | undefined;
let cardChip: HTMLElement | null = null;

const behavior = (): ScrollBehavior => (prefersReducedMotion() ? 'auto' : 'smooth');

function targetFor(chip: Element): HTMLElement | null {
    const id = chip.getAttribute('data-ref');
    return id ? document.getElementById(slugForId(id)) : null;
}

function statusOf(target: HTMLElement): string | undefined {
    const declared = target.dataset.status;
    if (declared && STATUS_LABEL[declared]) return declared;
    const box = target.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (box) return box.checked ? 'done' : 'todo';
    return undefined;
}

function buildCard(chip: HTMLElement, target: HTMLElement): HTMLElement {
    const el = document.createElement('div');
    el.className = 'lg-refcard';
    el.id = 'lg-refcard';
    el.setAttribute('role', 'tooltip');

    const family = target.dataset.family;
    const head = document.createElement('div');
    head.className = `lg-refcard-eyebrow${family ? ` lg-fam-${family}` : ''}`;
    head.textContent = `${target.dataset.label ?? (family ? FAMILY_LABEL[family] : undefined) ?? 'Reference'} · ${chip.dataset.ref ?? ''}`;
    el.appendChild(head);

    const body = document.createElement('div');
    body.className = 'lg-refcard-text';
    const text = (target.textContent ?? '').replace(/\s+/g, ' ').trim();
    body.textContent = text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS).trimEnd()}…` : text;
    el.appendChild(body);

    const status = statusOf(target);
    if (status) {
        const foot = document.createElement('div');
        foot.className = 'lg-refcard-status';
        const dot = document.createElement('span');
        dot.className = `lg-dot lg-dot--${status}`;
        dot.setAttribute('aria-hidden', 'true');
        foot.append(dot, STATUS_LABEL[status]);
        el.appendChild(foot);
    }
    return el;
}

function place(el: HTMLElement, chip: HTMLElement): void {
    const margin = 12;
    el.style.maxWidth = `${Math.min(420, window.innerWidth - margin * 2)}px`;
    const rect = chip.getBoundingClientRect();
    const width = el.offsetWidth;
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    const below = rect.bottom + 6;
    const top = below + el.offsetHeight > window.innerHeight - margin ? Math.max(margin, rect.top - el.offsetHeight - 6) : below;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
}

export function hideRefCard(): void {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    showTimer = undefined;
    cardChip?.removeAttribute('aria-describedby');
    cardChip = null;
    card?.remove();
    card = null;
}

function showRefCard(chip: HTMLElement): void {
    const target = targetFor(chip);
    if (!target) return;
    hideRefCard();
    card = buildCard(chip, target);
    card.addEventListener('mouseenter', () => window.clearTimeout(hideTimer));
    card.addEventListener('mouseleave', scheduleHide);
    document.body.appendChild(card);
    chip.setAttribute('aria-describedby', 'lg-refcard');
    cardChip = chip;
    place(card, chip);
}

function scheduleShow(chip: HTMLElement): void {
    window.clearTimeout(hideTimer);
    window.clearTimeout(showTimer);
    if (cardChip === chip) return;
    showTimer = window.setTimeout(() => showRefCard(chip), HOVER_DELAY_MS);
}

function scheduleHide(): void {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hideRefCard, HIDE_DELAY_MS);
}

export function flash(el: Element): void {
    el.classList.remove('lg-flash');
    void (el as HTMLElement).offsetWidth;
    el.classList.add('lg-flash');
    window.setTimeout(() => el.classList.remove('lg-flash'), FLASH_MS);
}

export function hideBackPill(): void {
    pill?.remove();
    pill = null;
    origin = null;
}

function showBackPill(from: Origin): void {
    hideBackPill();
    origin = from;
    pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'lg-backpill';
    pill.setAttribute('aria-label', `Back to ${from.label} (Alt+Left)`);
    const icon = document.createElement('span');
    icon.className = 'codicon codicon-arrow-left';
    icon.setAttribute('aria-hidden', 'true');
    pill.append(icon, `Back to ${from.label}`);
    pill.addEventListener('click', goBack);
    document.body.appendChild(pill);
}

export function goBack(): void {
    const from = origin;
    hideBackPill();
    if (!from || !from.el.isConnected) return;
    from.el.scrollIntoView({ behavior: behavior(), block: 'center' });
    flash(from.el);
}

/** Scrolls to the chip's target and flashes it; a chip for another document switches to it first. */
export function jumpToRef(chip: HTMLElement): void {
    const id = chip.dataset.ref;
    if (!id) return;
    hideRefCard();
    const doc = chip.dataset.doc;
    if (doc && doc !== navState.value?.currentDoc) {
        openDocumentAtFragment(doc, slugForId(id));
        return;
    }
    const target = targetFor(chip);
    if (!target) return;
    const row = chip.closest<HTMLElement>('[data-ref-target]');
    if (row === target) return;
    showBackPill({ el: row ?? chip, label: row?.dataset.refTarget ?? 'where you were' });
    target.scrollIntoView({ behavior: behavior(), block: 'center' });
    flash(target);
}

let installed = false;

export function setupLedgerRefs(): void {
    if (installed) return;
    installed = true;
    const chipOf = (e: Event) => (e.target instanceof Element ? e.target.closest<HTMLElement>(CHIP) : null);

    document.addEventListener('mouseover', (e) => {
        const chip = chipOf(e);
        if (chip) scheduleShow(chip);
    });
    document.addEventListener('mouseout', (e) => {
        if (chipOf(e)) scheduleHide();
    });
    document.addEventListener('focusin', (e) => {
        const chip = chipOf(e);
        if (chip) scheduleShow(chip);
    });
    document.addEventListener('focusout', (e) => {
        if (chipOf(e)) scheduleHide();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && (card || showTimer !== undefined)) hideRefCard();
        else if (e.key === 'ArrowLeft' && e.altKey && origin) {
            e.preventDefault();
            goBack();
        }
    });
    // Capture phase: runs before the document-link handler, which would scroll without the Back pill.
    document.addEventListener('click', (e) => {
        const chip = chipOf(e);
        if (!chip) return;
        e.preventDefault();
        e.stopPropagation();
        jumpToRef(chip);
    }, true);
}
