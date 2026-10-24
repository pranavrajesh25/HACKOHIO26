import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser", timeout: 90000, fullyParallel: false,
  expect: { timeout: 15000 },
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  webServer: { command: "npm run dev -- --port 3100", url: "http://localhost:3100", reuseExistingServer: !process.env.CI, timeout: 120000, env: { DATABASE_PATH: "./data/test-drive.e2e.sqlite", BETTER_AUTH_URL: "http://localhost:3100", NEXT_DIST_DIR: ".next-e2e", OPENROUTER_API_KEY: "" } },
});
