import { test, expect, type Page } from "@playwright/test";

async function register(page: Page, name: string, email: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Create an account", exact: true }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("test-drive-e2e-password!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("full contribution, revision, credit, application and accepted invitation across independent sessions", async ({ browser }) => {
  const leadContext = await browser.newContext(); const studentContext = await browser.newContext(); const visitorContext = await browser.newContext();
  const lead = await leadContext.newPage(); const student = await studentContext.newPage();
  const suffix = Date.now();
  await register(lead, "Demo Lead", `lead-${suffix}@example.test`);
  await lead.goto("/?view=editor");
  for (const [label, value] of [
    ["Project title", `Campus Route Test ${suffix}`], ["The problem, in a sentence", "Help a fictional robot choose a route around campus obstacles."], ["Project goal", "Practice thoughtful route planning with a welcoming demo team."], ["Description & current work", "We are a fictional demo team testing route trade-offs around stairs and construction. All content is demo material."], ["Relevant disciplines", "Engineering, Design"], ["Starter materials", "Bundled fictional campus route map v1: route A has stairs, B is a level garden loop, C is blocked by construction."], ["Team & mentor information", "Demo Lead · Project lead (fictional demo person)"], ["Available longer-project roles", "Route research\nInteraction design"], ["Project duration", "6 weeks"], ["Expected weekly commitment", "2 hours per week"],
  ]) await lead.getByLabel(label, { exact: true }).fill(value);
  await lead.getByRole("button", { name: "Save project draft" }).click();
  await expect(lead.getByRole("heading", { name: `Campus Route Test ${suffix}`, exact: true })).toBeVisible();
  let data = await (await lead.request.get("/api/data")).json(); const projectId = data.projects.find((p: { title: string }) => p.title === `Campus Route Test ${suffix}`).id;
  const visitor = await visitorContext.newPage();
  const publicDrafts = await (await visitor.request.get("/api/data")).json();
  expect(publicDrafts.projects.some((p: { id: string }) => p.id === projectId)).toBe(false);
  await lead.getByRole("button", { name: "Publish project", exact: true }).click();
  await lead.getByRole("link", { name: "Add task", exact: false }).click();
  await lead.getByRole("button", { name: "Save task draft" }).click();
  await expect(lead.getByRole("checkbox")).toBeVisible();
  await lead.getByRole("checkbox").check();
  await lead.getByRole("button", { name: "Approve & publish task" }).click();
  await expect(lead.getByText("Owner-approved task published.", { exact: true })).toBeVisible();
  data = await (await lead.request.get("/api/data")).json(); const task = data.tasks.find((t: { project_id: string }) => t.project_id === projectId);

  await register(student, "Demo Student", `student-${suffix}@example.test`);
  await student.goto(`/?view=workspace&id=${task.id}`);
  await student.getByRole("radio", { name: "B", exact: false }).check();
  const explanation = "I recommend route B because route A has stairs that the robot cannot climb, while route C is blocked by construction. The longer level path avoids both known obstacles.";
  await student.getByLabel("Walk us through your thinking", { exact: false }).fill(explanation);
  await student.getByLabel("What would you need to check?", { exact: false }).fill("I would check pedestrian traffic before testing this route.");
  await student.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(student.getByText("Draft saved. You can pick up right here later.")).toBeVisible();
  await student.reload();
  await expect(student.getByLabel("Walk us through your thinking", { exact: false })).toHaveValue(explanation);
  await student.getByRole("button", { name: "Submit contribution", exact: true }).click();
  await expect(student.getByText("Awaiting human feedback on this revision")).toBeVisible();
  data = await (await student.request.get("/api/data")).json(); const submission = data.submissions.find((s: { task_id: string }) => s.task_id === task.id);
  await lead.goto(`/?view=review&id=${submission.id}`);
  await lead.getByLabel("Feedback on revision 1", { exact: false }).fill("Thoughtful obstacle comparison. Please explain how you would verify path width before testing.");
  await lead.getByRole("button", { name: "Request a revision", exact: true }).click();
  await expect(lead.getByText("Revision requested. Your feedback is saved.", { exact: true })).toBeVisible();
  await student.reload();
  await student.getByRole("link", { name: "Revise your contribution", exact: false }).click();
  await student.getByLabel("What would you need to check?", { exact: false }).fill("I would measure the narrowest section of the garden path and compare it to the robot’s required clearance, and check pedestrian traffic before testing.");
  await student.getByRole("button", { name: "Resubmit", exact: true }).click();
  await expect(student.getByRole("heading", { name: "Revision 2", exact: true })).toBeVisible();
  await lead.reload();
  await lead.getByLabel("Feedback on revision 2", { exact: false }).fill("Clear route trade-offs and a useful plan for measuring clearance. Approved—thank you for contributing!");
  await lead.getByRole("button", { name: "Approve contribution", exact: true }).click();
  await expect(lead.getByText("Contribution approved and credited in the shared artifact.", { exact: true })).toBeVisible();
  await visitor.goto(`/?view=project&id=${projectId}`);
  await expect(visitor.getByText("Contributed by Demo Student", { exact: false })).toBeVisible();
  const publicData = await (await visitor.request.get("/api/data")).json();
  expect(publicData.submissions).toEqual([]); expect(publicData.applications).toEqual([]);
  await student.reload();
  await student.getByRole("link", { name: "Interested in joining?", exact: false }).click();
  await student.getByLabel("What does your availability look like?", { exact: false }).fill("Tuesday afternoons, 2 hours per week.");
  await student.getByLabel("What would you love to learn?", { exact: false }).fill("I want to learn how robotics teams test route assumptions responsibly.");
  await student.getByRole("button", { name: "Send application", exact: false }).click();
  await expect(student.getByText("Application sent", { exact: true })).toBeVisible();
  await lead.goto("/?view=applicants");
  await lead.getByRole("button", { name: "Invite to team", exact: true }).click();
  await expect(lead.getByText("Invitation sent. Membership starts when the student accepts.")).toBeVisible();
  const beforeAccept = await (await student.request.get("/api/data")).json();
  expect(beforeAccept.memberships.some((m: { project_id: string }) => m.project_id === projectId)).toBe(false);
  await student.reload();
  await student.getByRole("button", { name: "Accept invitation", exact: false }).click();
  await expect(student.getByText("Membership created. You’re part of the team.")).toBeVisible();
  await student.getByRole("button", { name: "Sign out", exact: true }).click();
  await student.getByRole("button", { name: "Sign in", exact: true }).click();
  await student.getByLabel("Email address").fill(`student-${suffix}@example.test`);
  await student.getByLabel("Password", { exact: true }).fill("test-drive-e2e-password!");
  await student.getByRole("dialog").getByRole("button", { name: "Sign in", exact: false }).click();
  await expect(student.getByRole("dialog")).toHaveCount(0);
  await student.goto("/?view=applications");
  await expect(student.getByText("Membership created. You’re part of the team.")).toBeVisible();
  await leadContext.close(); await studentContext.close(); await visitorContext.close();
});

test("explore is responsive, searchable, and labels previews", async ({ page }) => {
  await page.goto("/"); await expect(page.getByRole("heading", { name: "Big ideas. Small beginnings." })).toBeVisible();
  await expect(page.locator(".preview-chip")).toHaveCount(2);
  await page.getByRole("textbox", { name: "Search projects" }).fill("Robot Route Rescue");
  await expect(page.locator(".project-card")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Search projects" }).fill("");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("link", { name: "My contributions", exact: false })).toBeVisible();
});

test("optional assistance clearly labels simulation and saves only an unpublished draft", async ({ page, request }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Try as lead", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/?view=task-editor&id=robot-route-rescue");
  await page.getByRole("button", { name: "Generate starter task", exact: true }).click();
  await expect(page.getByText("SIMULATED OUTPUT — preset example, not live AI. Review and edit before publication.", { exact: true })).toBeVisible();
  const taskId = new URL(page.url()).searchParams.get("id");
  const data = await (await page.request.get("/api/data")).json();
  const task = data.tasks.find((t: { id: string }) => t.id === taskId);
  expect(task.status).toBe("draft"); expect(task.source).toBe("simulated");
  expect(task.content.missingInformation).toContain("SIMULATED DRAFT");
  await page.reload();
  await expect(page.getByText("SIMULATED OUTPUT — preset example, not live AI. Review and edit before publication.", { exact: true })).toBeVisible();
  const publicResponse = await (await request.get("/api/data")).json();
  expect(publicResponse.tasks.some((t: { id: string }) => t.id === taskId)).toBe(false);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Approve & publish task", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Resolve the missing information field before publishing." })).toBeVisible();
});
