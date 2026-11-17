import type { StorybookConfig } from '@storybook/preact-vite';

// The package's own Storybook: the viewer as a host outside VS Code sees it, one story per theme.
// It loads the built stylesheet, so `npm run storybook -w speckit-viewer` builds the package first.
const config: StorybookConfig = {
    stories: ['../stories/**/*.stories.tsx'],
    framework: '@storybook/preact-vite',
    addons: ['@storybook/addon-docs'],
    viteFinal(config) {
        config.esbuild = { ...config.esbuild, jsx: 'automatic', jsxImportSource: 'preact' };
        return config;
    },
};

export default config;
