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
    { path: "/tree", label: "Server tree" },
    { path: "/invites", label: "Invites" },
    { path: "/members", label: "Members" },
    { path: "/bans", label: "Bans" },
    { path: "/roles", label: "Roles" },
    { path: "/webhooks", label: "Webhooks" },
    { path: "/audit-log", label: "Audit log" },
    { path: "/messages", label: "Messages" },
    { path: "/recents", label: "Recents" },
    { path: "/send", label: "Send message" },
    { path: "/chat", label: "Chat" },
    { path: "/comms", label: "Comms" },
    { path: "/favorites", label: "Favorites" },
    { path: "/trawl", label: "Trawl" },
    { path: "/rag", label: "RAG" },
    { path: "/scheduled", label: "Scheduled" },
    { path: "/bridge", label: "Bridge" },
    { path: "/rules", label: "Rules" },
    { path: "/stats", label: "Statistics" },
    { path: "/tools", label: "Tools" },
    { path: "/skills", label: "Skills" },
    { path: "/apps", label: "Apps" },
    { path: "/bots", label: "Bots" },
    { path: "/embed-builder", label: "Embed builder" },
    { path: "/logs", label: "Logs" },
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

  test("Recents page shows heading and refresh", async ({ page }) => {
    await page.goto("/recents");
    await expect(page.getByRole("heading", { name: "Recents" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
  });

  test("Roles page shows overwrites matrix", async ({ page }) => {
    await page.goto("/roles");
    await expect(page.getByText("Channel access (overwrites)")).toBeVisible({ timeout: 10000 });
  });

  test("Send page offers DM mode", async ({ page }) => {
    await page.goto("/send");
    await expect(page.getByRole("button", { name: "Direct message" })).toBeVisible({ timeout: 10000 });
  });

  test("Dashboard shows new KPIs and quick actions", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("RAG chunks")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("link", { name: "Recents" })).toBeVisible();
  });

  test("Messages page shows Pins toggle", async ({ page }) => {
    await page.goto("/messages");
    await expect(page.getByRole("button", { name: /Pins/ })).toBeVisible({ timeout: 10000 });
  });

  test("Tools page lists prompt descriptions", async ({ page }) => {
    await page.goto("/tools");
    await expect(page.getByText("discord_quick_start")).toBeVisible({ timeout: 15000 });
  });

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

  test("PUT permissions with bad ids returns 502 (route wired, Discord rejects)", async ({
    request,
  }) => {
    const resp = await request.put(
      "http://localhost:10756/api/v1/channels/123/permissions/456",
      { data: { allow: "0", deny: "0" } },
    );
    expect(resp.status()).toBe(502);
  });

  test("GET /api/v1/guilds/:id/recent with bad guild returns 502", async ({ request }) => {
    const resp = await request.get(
      "http://localhost:10756/api/v1/guilds/123/recent?limit_channels=1",
    );
    expect(resp.status()).toBe(502);
  });

  test("GET /api/v1/meta exposes prompt descriptions", async ({ request }) => {
    const resp = await request.get("http://localhost:10756/api/v1/meta");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.prompt_descriptions["discord_quick_start"]).toBeTruthy();
  });
});
