// Adding a meal when no AI key is saved: the key panel must save the key, then estimate the meal.
// Fake data only; no account or key is touched.
import { expect, test } from "@playwright/test";

test("a key saved in the panel is sent, and the estimate runs again", async ({ page }) => {
  let keySaved = false;
  let keyRequest: { url: string; body: unknown } | null = null;
  await page.route("**/api/v1/me", (r) =>
    r.fulfill({ json: { id: "demo", email: "demo@example.com", display_name: null, daily_targets: { calories: null, protein_g: null }, encouragement_enabled: true } }),
  );
  await page.route("**/api/v1/days/**", (r) =>
    r.fulfill({ json: { date: new Date().toISOString().slice(0, 10), calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, meal_count: 0, meals: [], targets: { calories: null, protein_g: null } } }),
  );
  await page.route("**/api/v1/estimates", (r) =>
    keySaved
      ? r.fulfill({ json: { status: "estimate", provider: "gemini", estimate: { name: "Tea", calories: 90, protein_g: 3, carbs_g: 12, fat_g: 3, confidence: 0.8, items: [], assumptions: [] } } })
      : r.fulfill({ status: 409, json: { type: "x", title: "Conflict", status: 409, detail: "Add your AI key in Settings to estimate meals." } }),
  );
  await page.route("**/api/v1/me/ai-keys/**", (r) => {
    keyRequest = { url: r.request().url(), body: r.request().postDataJSON() };
    keySaved = true;
    return r.fulfill({ json: { provider: "gemini", last4: "abcd", validated_at: new Date().toISOString() } });
  });

  await page.goto("/");
  await page.locator('button:has-text("+ Add meal"), a:has-text("+ Add")').filter({ visible: true }).first().click();
  await page.getByLabel("What did you eat?").fill("a cup of tea with milk");
  await page.getByRole("button", { name: "Estimate" }).click();

  // The key panel appears. Choose the account, paste a key, tick the box, and save.
  await expect(page.getByRole("region", { name: "Connect an AI account" })).toBeVisible();
  await page.getByRole("radio", { name: "Gemini" }).check();
  await page.getByLabel(/Paste your Gemini key/).fill("AIzaFAKEKEYFORTESTINGONLY0000000000000");
  await page.getByLabel(/Send my meal descriptions to Gemini/).check();
  await page.getByRole("button", { name: "Save and estimate" }).click();

  await expect.poll(() => keyRequest, { timeout: 8000 }).not.toBeNull();
  // The estimate runs again after the key is saved, and the typed meal is still there.
  await expect(page.getByLabel("Meal name")).toHaveValue("Tea", { timeout: 8000 });
  await expect(page.getByLabel("What did you eat?")).toBeHidden().catch(() => {});
});

test("the meal being typed survives a reload", async ({ page }) => {
  await page.route("**/api/v1/me", (r) =>
    r.fulfill({ json: { id: "demo", email: "demo@example.com", display_name: null, daily_targets: { calories: null, protein_g: null }, encouragement_enabled: true } }),
  );
  await page.route("**/api/v1/days/**", (r) =>
    r.fulfill({ json: { date: new Date().toISOString().slice(0, 10), calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, meal_count: 0, meals: [], targets: { calories: null, protein_g: null } } }),
  );
  await page.goto("/");
  await page.locator('button:has-text("+ Add meal"), a:has-text("+ Add")').filter({ visible: true }).first().click();
  await page.getByLabel("What did you eat?").fill("3 aapam with channa");
  await page.reload();
  await page.locator('button:has-text("+ Add meal"), a:has-text("+ Add")').filter({ visible: true }).first().click();
  await expect(page.getByLabel("What did you eat?")).toHaveValue("3 aapam with channa");
});
