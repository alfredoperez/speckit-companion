import type { StorybookConfig } from '@storybook/preact-vite';

const config: StorybookConfig = {
    stories: ['../webview/src/**/*.stories.tsx'],
    framework: '@storybook/preact-vite',
    addons: ['@storybook/addon-essentials'],
};

export default config;
