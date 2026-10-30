// Pages behind sign-in. They run only when E2E_STORAGE_STATE points to a saved browser session of a
// dedicated test account, created by the owner. No credentials are typed or stored by these tests.
import * as fs from "node:fs";
import { expect, test } from "@playwright/test";

const storage = process.env.E2E_STORAGE_STATE;
test.skip(!storage || !fs.existsSync(storage), "Set E2E_STORAGE_STATE to a saved test-account session.");
test.use({ storageState: storage });

test("Today shows the day and the Add meal action", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Today|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Add meal" })).toBeVisible();
});

test("Add meal shows the describe box and the When choices", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "+ Add meal" }).click();
  await expect(page.getByLabel("What did you eat?")).toBeVisible();
  await expect(page.getByRole("group", { name: "When" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Other" })).toBeVisible();
});

test("Settings shows the encouragement switch", async ({ page }) => {
  await page.goto("/#settings");
  await page.getByRole("link", { name: "Settings" }).first().click();
  await expect(page.getByRole("switch")).toBeVisible();
});

test("Week shows the week heading and the seven days", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Week" }).first().click();
  await expect(page.getByText(/Week of/)).toBeVisible();
  await expect(page.locator(".day-tile")).toHaveCount(7);
});
