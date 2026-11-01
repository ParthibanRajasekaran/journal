// The moment a meal is saved. The API is answered with fake data, so no account or meal is touched.
import { expect, test, type Page } from "@playwright/test";

type Setup = { protein: number; target?: number | null; encouragement?: boolean };

async function setUp(page: Page, { protein, target = 100, encouragement = true }: Setup) {
  const meals: Array<Record<string, unknown>> = [];
  const day = new Date().toISOString().slice(0, 10);
  const totals = () => {
    const t = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    for (const m of meals) for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += m[k] as number;
    return t;
  };
  await page.route("**/api/v1/me", (r) =>
    r.fulfill({
      json: {
        id: "demo",
        email: "demo@example.com",
        display_name: "Demo",
        daily_targets: { calories: 2000, protein_g: target },
        encouragement_enabled: encouragement,
      },
    }),
  );
  await page.route("**/api/v1/days/**", (r) =>
    r.fulfill({
      json: { date: day, ...totals(), meal_count: meals.length, meals, targets: { calories: 2000, protein_g: target } },
    }),
  );
  await page.route("**/api/v1/estimates", (r) =>
    r.fulfill({
      json: {
        status: "estimate",
        provider: "openai",
        estimate: { name: "Dal and rice", calories: 640, protein_g: protein, carbs_g: 60, fat_g: 20, confidence: 0.8, items: [], assumptions: [] },
      },
    }),
  );
  await page.route("**/api/v1/meals", (r) => {
    const body = r.request().postDataJSON() as Record<string, unknown>;
    const saved = { id: `m${meals.length}`, version: 1, ...body };
    meals.push(saved);
    return r.fulfill({ status: 201, json: saved });
  });
}

async function saveDemoMeal(page: Page) {
  await page.goto("/");
  // Desktop has the "+ Add meal" button in the top bar; phones use the "+ Add" tab. Click the visible one.
  await page.locator('button:has-text("+ Add meal"), a:has-text("+ Add")').filter({ visible: true }).first().click();
  await page.getByLabel("What did you eat?").fill("dal and rice, one bowl");
  await page.getByRole("button", { name: "Estimate" }).click();
  await page.getByRole("button", { name: "Save meal" }).click();
}

test("saving a meal shows the meal and a calm line naming the protein tier reached", async ({ page }) => {
  await setUp(page, { protein: 96 });
  await saveDemoMeal(page);
  const note = page.locator(".saved-note");
  await expect(note).toContainText("Great! You're close to your protein goal.");
  await expect(page.getByText("Dal and rice")).toBeVisible();
});

test("the line never mentions calories, percentages or judgement", async ({ page }) => {
  await setUp(page, { protein: 96 });
  await saveDemoMeal(page);
  const text = (await page.locator(".saved-note").innerText()).toLowerCase();
  for (const banned of ["calorie", "kcal", "%", "over", "under", "failed", "missed", "streak"]) {
    expect(text).not.toContain(banned);
  }
});

test("the amazing tier is reached at the full protein target", async ({ page }) => {
  await setUp(page, { protein: 100 });
  await saveDemoMeal(page);
  await expect(page.locator(".saved-note")).toContainText("Amazing! You've reached your protein goal for today.");
});

test("below 80% of the target the line is calm and does not mention the goal", async ({ page }) => {
  await setUp(page, { protein: 40 });
  await saveDemoMeal(page);
  const note = page.locator(".saved-note");
  await expect(note).toHaveText(/Logged\. Nice work keeping track\./);
  await expect(note).not.toContainText("goal");
});

test("with encouragement switched off, no line appears after saving", async ({ page }) => {
  await setUp(page, { protein: 100, encouragement: false });
  await saveDemoMeal(page);
  await expect(page.getByText("Dal and rice")).toBeVisible();
  await expect(page.locator(".saved-note")).toHaveCount(0);
});

test("the line fades away on its own after a few seconds", async ({ page }) => {
  await setUp(page, { protein: 96 });
  await saveDemoMeal(page);
  const note = page.locator(".saved-note");
  await expect(note).toBeVisible();
  await expect(note).toBeHidden({ timeout: 8000 });
});

test("tapping the line dismisses it", async ({ page }) => {
  await setUp(page, { protein: 96 });
  await saveDemoMeal(page);
  const note = page.locator(".saved-note");
  await expect(note).toBeVisible();
  await note.click();
  await expect(note).toBeHidden();
});
