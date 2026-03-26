/**
 * Convert Windows path to WSL path if running inside a WSL environment.
 * Only converts when both conditions are met:
 * 1. Platform is win32
 * 2. WSL_DISTRO_NAME environment variable is set (indicating WSL)
 */
export function convertPathIfWSL(filePath: string): string {
    if (process.platform === 'win32' && process.env.WSL_DISTRO_NAME && filePath.match(/^[A-Za-z]:\\/)) {
        let wslPath = filePath.replace(/\\/g, '/');
        wslPath = wslPath.replace(/^([A-Za-z]):/, (_match, drive) => `/mnt/${drive.toLowerCase()}`);
        return wslPath;
    }
    return filePath;
}
