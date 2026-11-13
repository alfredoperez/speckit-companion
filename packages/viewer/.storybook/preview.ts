import type { Preview } from '@storybook/preact';
import '../dist/styles/highlight/github-dark.css';
import '../dist/styles/viewer.css';

const preview: Preview = {
    parameters: { layout: 'fullscreen' },
};

export default preview;
