// A stand-in for `@github/copilot-sdk/extension`, which the Copilot host supplies and the repo does not install.
// joinSession records its config on globalThis so a test can read what an extension registered.
export class CanvasError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

export const createCanvas = (options) => ({ ...options, __canvas: true });

export async function joinSession(config) {
    (globalThis.__copilotJoined ??= []).push(config);
    return { send: async () => {}, log: () => {} };
}
