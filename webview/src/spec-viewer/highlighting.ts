/**
 * SpecKit Companion - Code Highlighting & Mermaid Diagrams
 * Handles syntax highlighting and mermaid diagram initialization
 */

declare const hljs: {
    highlightElement: (element: Element) => void;
    highlightAll: () => void;
};

declare const mermaid: {
    initialize: (config: {
        startOnLoad: boolean;
        theme: string;
        themeVariables?: Record<string, string>;
        flowchart?: { useMaxWidth?: boolean };
        sequence?: { useMaxWidth?: boolean };
    }) => void;
    run: (config: { querySelector: string }) => void;
};

/**
 * Apply syntax highlighting to code blocks
 * Includes retry mechanism if hljs is not yet loaded
 */
export function applyHighlighting(retryCount: number = 0): void {
    const maxRetries = 15;
    const retryDelay = 150;

    // Retry mechanism if hljs not yet loaded
    if (typeof hljs === 'undefined') {
        if (retryCount < maxRetries) {
            setTimeout(() => applyHighlighting(retryCount + 1), retryDelay);
        } else {
            console.warn('[SpecViewer] highlight.js not loaded after max retries');
        }
        return;
    }

    // Find all code blocks that need highlighting (skip already highlighted ones)
    const codeBlocks = document.querySelectorAll('pre.code-block code[class*="language-"]');

    if (codeBlocks.length === 0) {
        return;
    }

    codeBlocks.forEach((block) => {
        try {
            const el = block as HTMLElement;

            // Remove previous hljs classes to allow re-highlighting
            el.classList.forEach(cls => {
                if (cls.startsWith('hljs-') || cls === 'hljs') {
                    el.classList.remove(cls);
                }
            });

            // Apply highlighting
            hljs.highlightElement(el);

            // Ensure hljs class is present for CSS
            if (!el.classList.contains('hljs')) {
                el.classList.add('hljs');
            }
        } catch (e) {
            console.warn('[SpecViewer] Failed to highlight block:', e);
        }
    });
}

/**
 * Initialize mermaid diagrams
 */
export function initializeMermaid(): void {
    if (typeof mermaid === 'undefined') {
        console.warn('[SpecViewer] mermaid not loaded');
        return;
    }

    const mermaidBlocks = document.querySelectorAll('.mermaid');
    if (mermaidBlocks.length === 0) {
        return;
    }

    try {
        // Detect theme based on body class
        const isDark = document.body.classList.contains('vscode-dark') ||
                       document.body.classList.contains('vscode-high-contrast');

        // Get computed CSS variables for theme-aware colors
        const computedStyle = getComputedStyle(document.documentElement);
        const accent = computedStyle.getPropertyValue('--accent').trim() || '#007fd4';
        const bgPrimary = computedStyle.getPropertyValue('--bg-primary').trim() || (isDark ? '#1e1e1e' : '#ffffff');
        const bgSecondary = computedStyle.getPropertyValue('--bg-secondary').trim() || (isDark ? '#252526' : '#f3f3f3');
        const textPrimary = computedStyle.getPropertyValue('--text-primary').trim() || (isDark ? '#d4d4d4' : '#333333');
        const headerSection = computedStyle.getPropertyValue('--header-section').trim() || '#ee9d28';

        mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            // Disable max-width for flowchart + sequence so they render at natural
            // width rather than being scaled down to the container (which shrinks
            // per-box text). State / class diagrams keep defaults so we don't risk
            // affecting mermaid's parser for those types.
            flowchart: { useMaxWidth: false },
            sequence: { useMaxWidth: false },
            themeVariables: {
                // Background colors
                primaryColor: bgSecondary,
                primaryBorderColor: accent,
                primaryTextColor: textPrimary,

                // Secondary colors
                secondaryColor: bgPrimary,
                secondaryBorderColor: accent,
                secondaryTextColor: textPrimary,

                // Tertiary colors
                tertiaryColor: bgSecondary,
                tertiaryBorderColor: accent,
                tertiaryTextColor: textPrimary,

                // Lines and labels
                lineColor: accent,
                textColor: textPrimary,

                // State diagram specific
                labelBackground: bgSecondary,
                labelTextColor: headerSection,

                // Node styling
                nodeBorder: accent,
                nodeTextColor: textPrimary,

                // Edge labels
                edgeLabelBackground: bgSecondary,

                // Fonts
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: '18px'
            }
        });

        mermaid.run({ querySelector: '.mermaid' });
        // Add zoom controls after mermaid renders (use setTimeout to wait for DOM update)
        setTimeout(() => addMermaidZoomControls(), 100);
    } catch (e) {
        console.warn('[SpecViewer] Failed to initialize mermaid:', e);
    }
}

/**
 * Add zoom controls to each mermaid container
 */
function addMermaidZoomControls(): void {
    document.querySelectorAll('.mermaid-container').forEach(container => {
        if (container.querySelector('.mermaid-controls')) return;

        const controls = document.createElement('div');
        controls.className = 'mermaid-controls';
        controls.innerHTML = `
            <button class="mermaid-zoom-out" title="Zoom out">−</button>
            <button class="mermaid-zoom-reset" title="Reset zoom">Reset</button>
            <button class="mermaid-zoom-in" title="Zoom in">+</button>
        `;
        container.insertBefore(controls, container.firstChild);

        const svg = container.querySelector('.mermaid svg') as SVGElement;
        if (!svg) return;

        let zoom = 1;
        const applyZoom = () => {
            svg.style.transform = `scale(${zoom})`;
        };

        controls.querySelector('.mermaid-zoom-in')!.addEventListener('click', () => {
            zoom = Math.min(3, zoom + 0.25);
            applyZoom();
        });
        controls.querySelector('.mermaid-zoom-out')!.addEventListener('click', () => {
            zoom = Math.max(0.5, zoom - 0.25);
            applyZoom();
        });
        controls.querySelector('.mermaid-zoom-reset')!.addEventListener('click', () => {
            zoom = 1;
            applyZoom();
        });
    });
}
