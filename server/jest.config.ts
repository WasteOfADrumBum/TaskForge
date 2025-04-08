import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  verbose: true,
  preset: "ts-jest",
  testEnvironment: "node", // Use Node environment for server-side tests
  transform: {
    "^.+\\.tsx?$": "ts-jest", // Transforms TypeScript files
  },
  globals: {
    "ts-jest": {
      isolatedModules: true, // Optimizes Jest runs with isolated modules
    },
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"], // Global setup for server tests
  moduleDirectories: ["node_modules", "src"],
};

export default config;
