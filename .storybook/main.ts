import type { StorybookConfig } from '@storybook/preact-vite';

const config: StorybookConfig = {
    stories: ['../webview/src/**/*.stories.tsx'],
    framework: '@storybook/preact-vite',
    addons: ['@storybook/addon-essentials'],
    viteFinal(config) {
        config.resolve = config.resolve || {};
        config.resolve.alias = {
            ...config.resolve.alias,
            'react': 'preact/compat',
            'react-dom': 'preact/compat',
        };
        config.esbuild = {
            ...config.esbuild,
            jsxFactory: 'h',
            jsxFragment: 'Fragment',
            jsxInject: `import { h, Fragment } from 'preact'`,
        };
        return config;
    },
};

export default config;
