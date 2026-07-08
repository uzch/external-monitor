import { expect, test } from "@playwright/test";
import { startStaticServer, StaticServer } from "./staticServer";

let appServer: StaticServer;

test.beforeAll(async () => {
  appServer = await startStaticServer();
});
test.afterAll(async () => {
  await appServer.close();
});

test("runtime account and source setup drills into truthful account detail", async ({ page }) => {
  await page.goto(appServer.url);

  await expect(page.getByRole("heading", { name: "External Account Signal Monitor" })).toBeVisible();
  await expect(page.getByText("Semantic evaluator is not configured")).toBeVisible();
  await expect(page.getByText("monitors active registered sources only")).toBeVisible();

  await page.getByLabel("Account name").fill("Example Corp");
  await page.getByLabel("Aliases").fill("Example");
  await page.getByRole("button", { name: "Add account" }).click();

  await page.getByLabel("Source name").fill("Example public feed");
  await page.getByLabel("RSS/Atom URL").fill("https://example.com/feed.xml");
  await page.getByRole("button", { name: "Register source" }).click();

  await expect(page.getByRole("link", { name: "Example Corp" })).toBeVisible();
  await page.getByRole("link", { name: "Example Corp" }).click();

  await expect(page.getByRole("heading", { name: "Example Corp", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Registered sources" })).toBeVisible();
  await expect(page.getByText("Example public feed")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evaluated semantic signals" })).toBeVisible();
  await expect(page.getByText("No evidence-backed semantic signals")).toBeVisible();
});

test("mobile setup flow keeps registration controls usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(appServer.url);

  await page.getByLabel("Account name").fill("Mobile Example Corp");
  await page.getByLabel("Aliases").fill("Mobile Example");
  await page.getByRole("button", { name: "Add account" }).click();

  await page.getByRole("combobox").selectOption({ label: "Mobile Example Corp" });
  await page.getByLabel("Source name").fill("Mobile public feed");
  await page.getByLabel("RSS/Atom URL").fill("https://example.com/mobile-feed.xml");
  await page.getByRole("button", { name: "Register source" }).click();

  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole("link", { name: "Mobile Example Corp" }).click();
  await expect(page.getByRole("heading", { name: "Mobile Example Corp", exact: true })).toBeVisible();
  await expect(page.getByText("Mobile public feed")).toBeVisible();
});
