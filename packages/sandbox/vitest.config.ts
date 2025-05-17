import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Enable or disable global environment variables mocking
    globals: true,
    // Set the environment mode
    environment: "node",
    // Include specific test directories
    include: ["__tests__/**/*.test.{js,ts}"],
    // Configure timeout for tests
    testTimeout: 10000,
    // Setup files that run before each test file
    setupFiles: ["__tests__/setup.ts"],
  },
});
