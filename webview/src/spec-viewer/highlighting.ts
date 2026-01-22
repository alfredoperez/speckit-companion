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
                fontSize: '14px'
            }
        });

        mermaid.run({ querySelector: '.mermaid' });
    } catch (e) {
        console.warn('[SpecViewer] Failed to initialize mermaid:', e);
    }
}
