/**
 * True while a constitution still holds the template's placeholders. The Sync Impact Report
 * `/speckit.constitution` writes at the top is an HTML comment naming every placeholder it replaced,
 * so a finished constitution still contains the words: read the body only.
 */
export function constitutionNeedsSetup(text: string): boolean {
    const body = text.replace(/<!--[\s\S]*?-->/g, '');
    return /\[PROJECT_NAME\]|\[PRINCIPLE_\d+_NAME\]|\[PLACEHOLDER\]/.test(body);
}
