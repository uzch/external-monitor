import { expect, test } from "@playwright/test";
import { startStaticServer, StaticServer } from "./staticServer";

let appServer: StaticServer;

test.beforeAll(async () => {
  appServer = await startStaticServer();
});

test.afterAll(async () => {
  await appServer.close();
});

test("portfolio scope selection drills into account detail with evidence and action", async ({
  page,
}) => {
  await page.goto(appServer.url);

  await expect(page.getByRole("heading", { name: "External Account Signal Monitor" })).toBeVisible();
  await page.getByLabel("Hierarchy scope").selectOption("region-east");

  await expect(page.getByText("Mapped accounts only.").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Nova Bank" })).toBeVisible();

  await page.getByRole("link", { name: "Nova Bank" }).click();

  await expect(page.getByRole("heading", { name: "Nova Bank", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Account Pulse" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "External fact" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Source evidence" }).first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Red Hat relevance hypothesis" }).first(),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Validation action" }).first()).toBeVisible();
  await expect(page.getByText("No account-specific relevance is loaded.").first()).toBeVisible();
});
