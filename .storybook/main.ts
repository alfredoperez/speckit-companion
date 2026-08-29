import type { StorybookConfig } from '@storybook/preact-vite';

const config: StorybookConfig = {
    stories: ['../webview/src/**/*.stories.tsx'],
    framework: '@storybook/preact-vite',
    addons: ['@storybook/addon-docs'],
    /*
      The composite capture stories build cards out of imagery that already
      exists on disk rather than re-rendering the product inside the story. The
      social card is the one that needs it: it lays real product surface behind
      its type, and the alternative is a text-on-gradient card that looks like
      every other dev tool's.

      Anything served here is a BUILD ARTIFACT of another script, so those have
      to run first — `npm run clips:stills` before the social card is shot.
    */
    staticDirs: [
        { from: '../media/web', to: '/stills' },
        { from: '../assets/mascot', to: '/mascot' },
    ],
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
