import { test, expect } from "@playwright/test";

test("saved interests produce recommendations and open an existing task", async ({ page }) => {
  await page.goto("/");
  const signup = await page.request.post("/api/auth/sign-up/email", { data: { name: "Recommendation Student", email: `recommend-${Date.now()}@example.test`, password: "recommend-test-password" } });
  expect(signup.ok()).toBe(true);
  await page.reload();
  const region = page.getByRole("region", { name: "Recommended for you" });
  await region.getByRole("link", { name: "Add your interests" }).click();
  await page.getByLabel("Interests", { exact: true }).fill("Robotics");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Profile updated.", { exact: true })).toBeVisible();
  await page.goto("/");
  await region.getByRole("button", { name: "Find tasks for me" }).click();
  await expect(region.getByRole("heading", { name: "Interest matches", exact: true })).toBeVisible();
  await expect(region.getByText("Shares interest keywords:", { exact: false }).first()).toBeVisible();
  await region.locator('a[href="/?view=workspace&id=robot-first-route"]').click();
  await expect(page).toHaveURL(/view=workspace&id=robot-first-route/);
  await expect(page.getByRole("heading", { name: "One robot. Three possible routes." })).toBeVisible();
});
