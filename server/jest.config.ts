export default {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  moduleFileExtensions: ["ts", "tsx", "js"],
  rootDir: "./server/src",
  testMatch: ["**/__tests__/**/*.(ts|tsx|js)"],
};
