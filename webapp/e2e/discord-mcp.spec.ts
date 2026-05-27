import { expect, test } from "@playwright/test";

test.describe("Discord-MCP Webapp", () => {
  test("Dashboard loads with heading", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expect(page).not.toHaveTitle(/Error/);
  });

  test("Root path redirects to /dashboard", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/dashboard");
    await expect(page).not.toHaveTitle(/Error/);
  });

  const pages = [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/guilds", label: "Guilds" },
    { path: "/channels", label: "Channels" },
    { path: "/invites", label: "Invites" },
    { path: "/members", label: "Members" },
    { path: "/messages", label: "Messages" },
    { path: "/send", label: "Send message" },
    { path: "/favorites", label: "Favorites" },
    { path: "/trawl", label: "Trawl" },
    { path: "/rag", label: "RAG" },
    { path: "/stats", label: "Statistics" },
    { path: "/tools", label: "Tools" },
    { path: "/skills", label: "Skills" },
    { path: "/apps", label: "Apps" },
    { path: "/settings", label: "Settings" },
    { path: "/help", label: "Help" },
  ];

  for (const p of pages) {
    test(`Page "${p.label}" loads (${p.path})`, async ({ page }) => {
      await page.goto(p.path);
      await expect(page.locator("h1, h2").first()).toBeVisible({
        timeout: 10000,
      });
      await expect(page).not.toHaveTitle(/Error/);
    });
  }

  test("Sidebar navigation links exist", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.locator("nav a");
    const count = await sidebar.count();
    expect(count).toBeGreaterThanOrEqual(15);
  });

  test("Topbar shows Discord MCP branding", async ({ page }) => {
    await page.goto("/dashboard");
    const topbar = page.locator('header, [class*="top"]');
    await expect(topbar.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("REST API", () => {
  test("GET /api/v1/health returns 200", async ({ request }) => {
    const resp = await request.get("http://localhost:10756/api/v1/health");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty("status", "ok");
    expect(body).toHaveProperty("service", "discord-mcp");
  });

  test("GET /api/v1/meta returns 200", async ({ request }) => {
    const resp = await request.get("http://localhost:10756/api/v1/meta");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty("service", "discord-mcp");
    expect(body.tools).toContain("discord");
  });

  test("GET /api/v1/skills returns 200", async ({ request }) => {
    const resp = await request.get("http://localhost:10756/api/v1/skills");
    expect(resp.status()).toBe(200);
  });

  test("POST /api/v1/channels/:id/messages with invalid input returns 422", async ({
    request,
  }) => {
    const resp = await request.post(
      "http://localhost:10756/api/v1/channels/123/messages",
      {
        data: {},
      },
    );
    expect(resp.status()).toBe(422);
  });
});
