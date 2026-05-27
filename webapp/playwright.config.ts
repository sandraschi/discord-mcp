import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  retries: 1,
  use: {
    baseURL: "http://localhost:10757",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "uv run uvicorn discord_mcp.server:app --host 127.0.0.1 --port 10756 --log-level warning",
    port: 10756,
    cwd: "../",
    timeout: 30000,
    reuseExistingServer: false,
  },
});
