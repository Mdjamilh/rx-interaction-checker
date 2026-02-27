import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const fixtures: Record<string, unknown> = JSON.parse(readFileSync(new URL("./fixtures.json", import.meta.url), "utf8"));

// Serve recorded API responses (scripts/record-fixtures.mjs) instead of the network.
test.beforeEach(async ({ context }) => {
  for (const host of ["https://rxnav.nlm.nih.gov/**", "https://api.fda.gov/**"]) {
    await context.route(host, (route) => {
      const body = fixtures[route.request().url()];
      return body ? route.fulfill({ json: body }) : route.fulfill({ status: 404, json: {} });
    });
  }
});

test("check the example list and read what the labels say", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use an example list" }).click();
  await expect(page).toHaveURL(/meds=Coumadin%2CAdvil%2Cclarithromycin%2CLipitor/);
  await page.getByRole("button", { name: "Check 4 medications" }).click();

  const summary = page.getByRole("heading", { level: 2 });
  await expect(summary).toHaveText(/of 6 pairs are mentioned in the labels/);
  await expect(summary).toBeFocused();

  const warfarinAdvil = page.locator("article").filter({ has: page.getByRole("heading", { name: /Coumadin.*Advil/ }) });
  await expect(warfarinAdvil.locator("mark").first()).toBeVisible();
  await expect(warfarinAdvil.getByRole("link", { name: "read the full label" }).first()).toHaveAttribute("href", /dailymed\.nlm\.nih\.gov/);
});

test("search suggestions can be picked with the keyboard", async ({ page }) => {
  await page.goto("/");
  const input = page.getByRole("combobox", { name: "Add a medication" });
  await input.fill("advi");
  await expect(page.getByRole("option").first()).toBeVisible();
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page.getByRole("list", { name: "Your medications" })).toContainText("Advil");
});

test("warns when the same ingredient is listed twice", async ({ page }) => {
  await page.goto("/?meds=Advil,ibuprofen");
  await page.getByRole("button", { name: "Check 2 medications" }).click();
  await expect(page.getByText("Advil and ibuprofen both contain ibuprofen")).toBeVisible();
});

test("a shared link restores the list", async ({ page }) => {
  await page.goto("/?meds=Coumadin,Lipitor");
  await expect(page.getByRole("list", { name: "Your medications" }).getByRole("listitem")).toHaveCount(2);
});

test("no detectable accessibility violations before and after a check", async ({ page }) => {
  await page.goto("/?meds=Coumadin,clarithromycin");
  const scan = async () => (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations.map((v) => v.id);
  expect(await scan()).toEqual([]);
  await page.getByRole("button", { name: "Check 2 medications" }).click();
  await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
  expect(await scan()).toEqual([]);
});
