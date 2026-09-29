const STUB = new URL('./extension.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
    if (specifier === '@github/copilot-sdk/extension') return { url: STUB, shortCircuit: true };
    return nextResolve(specifier, context);
}
