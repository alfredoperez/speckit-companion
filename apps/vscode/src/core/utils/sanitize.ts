/**
 * Input sanitization utilities to prevent command injection
 */

/**
 * Sanitize user input for use in shell commands.
 * Escapes special characters that could be used for command injection.
 * @param input - User-provided input string
 * @returns Sanitized string safe for shell use
 */
export function sanitizeShellInput(input: string): string {
    if (!input) {
        return '';
    }

    // Remove or escape potentially dangerous characters
    return input
        // Remove backticks (command substitution)
        .replace(/`/g, '')
        // Remove $() (command substitution)
        .replace(/\$\(/g, '')
        // Escape double quotes
        .replace(/"/g, '\\"')
        // Remove semicolons (command chaining)
        .replace(/;/g, '')
        // Remove pipes (piping)
        .replace(/\|/g, '')
        // Remove && and || (command chaining)
        .replace(/&&/g, '')
        .replace(/\|\|/g, '')
        // Remove > and < (redirection)
        .replace(/[><]/g, '')
        // Remove newlines (command separation)
        .replace(/[\r\n]/g, ' ')
        // Trim whitespace
        .trim();
}

/**
 * Validate that a string is a safe project/spec name.
 * Only allows alphanumeric characters, hyphens, and underscores.
 * @param name - Project or spec name to validate
 * @returns true if name is safe, false otherwise
 */
export function isValidProjectName(name: string): boolean {
    if (!name || name.length === 0 || name.length > 100) {
        return false;
    }
    // Allow alphanumeric, hyphens, underscores, and spaces
    return /^[a-zA-Z0-9\-_\s]+$/.test(name);
}

/**
 * Sanitize a project name by removing invalid characters.
 * @param name - Project name to sanitize
 * @returns Sanitized project name
 */
export function sanitizeProjectName(name: string): string {
    if (!name) {
        return '';
    }
    // Replace invalid characters with hyphens, collapse multiple hyphens
    return name
        .replace(/[^a-zA-Z0-9\-_\s]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .trim();
}
