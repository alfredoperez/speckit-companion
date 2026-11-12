import { onAction } from 'speckit-viewer/view/host';
import '../signals';

describe('the VS Code webview forwards every view action to postMessage', () => {
    it('sends the action unchanged, reading the vscode global at call time', () => {
        const postMessage = jest.fn();
        (globalThis as { vscode?: unknown }).vscode = { postMessage };

        onAction({ type: 'openFile', filename: 'spec.md', line: 3 });

        expect(postMessage).toHaveBeenCalledWith({ type: 'openFile', filename: 'spec.md', line: 3 });
    });
});
