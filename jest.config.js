/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/tests/**/*.test.[jt]s',
    '**/?(*.)+(spec|test).[jt]s'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!tests/**',
    '!src/extension.ts', // Extension entry point is hard to test
    '!src/prompts/target/**', // Generated files
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    // Handle VS Code module
    'vscode': '<rootDir>/tests/__mocks__/vscode.ts'
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
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