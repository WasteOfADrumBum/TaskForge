import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  verbose: true,
  preset: "ts-jest",
  testEnvironment: "node",
  moduleDirectories: ["node_modules", "src"],
  transform: {
    "^.+\\.tsx?$": "ts-jest", // Transforms TypeScript files
  },
  globals: {
    "ts-jest": {
      isolatedModules: true, // Speeds up compilation for isolated modules
    },
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"], // Set up for global test configuration
};

export default config;
