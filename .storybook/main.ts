import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { searchForWorkspaceRoot } from 'vite';
import type { StorybookConfig } from '@storybook/preact-vite';

const require = createRequire(import.meta.url);

const config: StorybookConfig = {
    stories: ['../apps/vscode/webview/src/**/*.mdx', '../apps/vscode/webview/src/**/*.stories.tsx'],
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
        { from: '../content/media/web', to: '/stills' },
        { from: '../assets/mascot', to: '/mascot' },
    ],
    viteFinal(config) {
        config.resolve = config.resolve || {};
        config.resolve.alias = {
            ...config.resolve.alias,
            'react': 'preact/compat',
            'react-dom': 'preact/compat',
        };
        // A worktree symlinks node_modules to the main checkout; Vite answers the
        // codicon font with 403 unless that real folder is allowed, and the icons
        // render as empty squares.
        config.server = config.server || {};
        config.server.fs = {
            ...config.server.fs,
            allow: [...(config.server.fs?.allow ?? []), searchForWorkspaceRoot(process.cwd()), dirname(dirname(require.resolve('@vscode/codicons/package.json')))],
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
