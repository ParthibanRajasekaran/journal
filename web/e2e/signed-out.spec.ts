// Pages anyone can reach without an account. No credentials are used.
import { expect, test } from "@playwright/test";

test("the sign-in page explains the app and offers Google sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Journal" })).toBeVisible();
  await expect(page.getByText("A calmer way to see what you eat.")).toBeVisible();
  await expect(page.getByText("Continue with Google")).toBeVisible();
});

test("Google sign-in stays off until the user confirms they are 18 or older", async ({ page }) => {
  await page.goto("/");
  const button = page.locator("a.google-btn");
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await page.getByLabel("I am 18 or older.").check();
  await expect(button).toHaveAttribute("aria-disabled", "false");
});

test("a failed sign-in shows a calm message and removes the marker from the address", async ({ page }) => {
  await page.goto("/?signin=failed");
  await expect(page.getByRole("alert")).toContainText("Sign-in didn't finish");
  await expect(page).toHaveURL(/\/$/);
});

test("the session check answers signed-out visitors with a clear 401", async ({ request }) => {
  const response = await request.get("/api/v1/me");
  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ status: 401 });
});

test("no horizontal scrolling on the sign-in page", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the sign-in page raises no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    // The signed-out session check answers 401 by design; the browser logs that as an error.
    if (msg.type() === "error" && !msg.text().includes("status of 401")) errors.push(msg.text());
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

test("an unknown address still shows the sign-in page", async ({ page }) => {
  await page.goto("/this-page-does-not-exist");
  await expect(page.getByText("Continue with Google")).toBeVisible();
});

test("a very long address does not break the page", async ({ page }) => {
  await page.goto(`/?q=${"x".repeat(1500)}`);
  await expect(page.getByText("Continue with Google")).toBeVisible();
});

test("a failed sign-in with extra parameters still shows the message once", async ({ page }) => {
  await page.goto("/?signin=failed&state=abc&error=access_denied");
  await expect(page.getByRole("alert")).toContainText("Sign-in didn't finish");
});

test("an unknown API route answers with a problem document, not a page", async ({ request }) => {
  const response = await request.get("/api/v1/not-a-route");
  expect(response.status()).toBe(404);
  expect(response.headers()["content-type"]).toContain("application/problem+json");
});

test("the sign-in controls can be reached by keyboard", async ({ page }) => {
  await page.goto("/");
  // Focus starts on the page only after a click, so the first Tab then reaches the first control.
  await page.locator("h1").click();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(["INPUT", "A", "BUTTON"]).toContain(focused);
});
