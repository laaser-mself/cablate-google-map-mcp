/** @type {import("jest").Config} */
const config = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testMatch: ["<rootDir>/tests/integration/**/*.test.ts", "<rootDir>/tests/e2e/**/*.test.ts"],
  testTimeout: 30000,
  setupFiles: ["<rootDir>/tests/setupJestGlobals.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          isolatedModules: true,
        },
      },
    ],
  },
};

export default config;
