import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  verbose: true,
  preset: "ts-jest",
  testEnvironment: "jsdom", // Use jsdom for browser-like environment
  transform: {
    "^.+\\.tsx?$": "ts-jest", // Transforms TypeScript files
  },
  moduleNameMapper: {
    "\\.(css|less)$": "identity-obj-proxy", // Mock CSS imports
    "\\.(png|jpg|jpeg|gif|svg)$": "identity-obj-proxy", // Mock image imports
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"], // Set up for global test configuration
  moduleDirectories: ["node_modules", "src"],
  globals: {
    "ts-jest": {
      isolatedModules: true,
    },
  },
  transformIgnorePatterns: ["/node_modules/(?!@babel)"], // Ignore transforming certain modules
};

export default config;
