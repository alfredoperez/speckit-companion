/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps/vscode/src', '<rootDir>/apps/vscode/webview/src', '<rootDir>/apps/vscode/tests'],
  testMatch: [
    '**/tests/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],
  collectCoverageFrom: [
    'apps/vscode/src/**/*.ts',
    '!apps/vscode/src/**/*.d.ts',
    '!apps/vscode/tests/**',
    '!apps/vscode/src/extension.ts', // Extension entry point is hard to test
    '!apps/vscode/src/prompts/target/**', // Generated files
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    // Handle VS Code module
    'vscode': '<rootDir>/apps/vscode/tests/__mocks__/vscode.ts',
    // Preact ships ESM-only via the "import" condition, which Jest in
    // CommonJS mode can't load. Force the CJS entry for tests.
    '^preact$': '<rootDir>/node_modules/preact/dist/preact.js',
    '^preact/hooks$': '<rootDir>/node_modules/preact/hooks/dist/hooks.js',
    '^preact/jsx-runtime$': '<rootDir>/node_modules/preact/jsx-runtime/dist/jsxRuntime.js',
    '^@preact/signals$': '<rootDir>/node_modules/@preact/signals/dist/signals.js',
    '^@preact/signals-core$': '<rootDir>/node_modules/@preact/signals-core/dist/signals-core.js'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json'
    }]
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__mocks__/'
  ],
  // 使快照文件更易读
  snapshotFormat: {
    escapeString: false,
    printBasicPrototype: false
  }
};