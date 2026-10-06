import type { Config } from 'jest';

const config: Config = {
  verbose: true,
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  setupFiles: ['<rootDir>/integration/setup.ts'],
  testMatch: ['**/integration/**/*.integration.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: { rootDir: '.' } }],
  },
  maxWorkers: 1,
  testTimeout: 15000,
};

export default config;
