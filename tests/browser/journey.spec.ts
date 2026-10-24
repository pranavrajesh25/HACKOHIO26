import { test, expect, type Page } from "@playwright/test";
import { type TaskContent } from "../../lib/content";
import { energyTask } from "../fixtures/energy-task";
import { microtasks } from "../fixtures/task-batch";

test("lead card generates and publishes a task batch without a review step", async ({ page }) => {
  await register(page, "Quick Task Lead", `quick-${Date.now()}@example.test`);
  const created = await page.request.post("/api/data", { data: { action: "save-project", payload: {
    title: `Quick Energy ${Date.now()}`, problem: "Understand a small set of fictional campus power readings.", goal: "Help beginners read energy data.", description: "A fictional project for exploring small energy observations and beginner contributions.", topic: "Energy", disciplines: "Engineering", materials: "Fictional power readings for a demo.", team: "Quick Task Lead", roles: "Research", duration: "4 weeks", commitment: "1 hour per week", accepting: true,
  } } });
  expect(created.ok()).toBe(true);
  const { id } = await created.json();
  await page.goto("/?view=lead");
  const button = page.getByRole("button", { name: "Generate & publish 2–3 tasks", exact: true });
  await expect(button).toBeDisabled();
  await page.getByRole("button", { name: "Publish project", exact: true }).click();
  await expect(button).toBeEnabled();
  // The isolated browser server has no provider key: no simulated auto-publication.
  await button.click();
  await expect(page.getByRole("alert").filter({ hasText: "requires an OpenRouter API key" })).toBeVisible();
  let published = false, requests = 0;
  await page.route("**/api/data", async route => {
    const response = await route.fetch(); const data = await response.json();
    if (published) data.tasks.push(...microtasks.slice(0, 2).map((content, i) => ({ id: `quick-task-${i}`, project_id: id, reviewer: data.user.id, reviewer_name: "Quick Task Lead", status: "published", current_version: 1, approved: 0, source: "ai-auto", content })));
    await route.fulfill({ response, json: data });
  });
  await page.route("**/api/generate-tasks", async route => {
    requests++; expect(route.request().postDataJSON()).toEqual({ project: id });
    published = true; await route.fulfill({ json: { ids: ["quick-task-0", "quick-task-1"], count: 2 } });
  });
  await button.click();
  await expect(page.getByRole("status").filter({ hasText: "2 tasks published." })).toContainText("Students can start now");
  await expect(page.getByText(microtasks[0].title)).toBeVisible();
  await expect(page.getByText("AI auto-published", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  expect(requests).toBe(1);
  await page.route("**/api/generate-tasks", route => route.fulfill({ status: 502, json: { error: "AI could not create a valid task batch. No tasks were added." } }));
  await button.click();
  await expect(page.getByRole("alert").filter({ hasText: "No tasks were added" })).toBeVisible();
  await expect(page.getByText("AI auto-published", { exact: true })).toHaveCount(2);
});

test("résumé suggestions are reviewed, edited, merged, and saved explicitly", async ({ page }) => {
  await register(page, "Résumé Student", `resume-${Date.now()}@example.test`);
  await page.goto("/?view=profile");
  await page.getByLabel("Interests", { exact: true }).fill("Python, Music");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Profile updated.", { exact: true })).toBeVisible();
  const importer = page.getByRole("region", { name: "Import interests from résumé" });
  let calls = 0;
  await page.route("**/api/resume-interests", async route => {
    calls++; expect(route.request().headers()["content-type"]).toBe("application/pdf");
    expect(route.request().postDataBuffer()!.toString().startsWith("%PDF-")).toBe(true);
    await route.fulfill({ json: { interests: ["python", "Data analysis", "Robotics", "Design", "Sustainability"] } });
  });
  await importer.getByLabel("CV or résumé PDF").setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nFictional résumé\n%%EOF") });
  await expect(importer.getByRole("button", { name: "Suggest interests from PDF" })).toBeDisabled();
  expect(calls).toBe(0);
  await importer.getByRole("checkbox").check();
  await importer.getByRole("button", { name: "Suggest interests from PDF" }).click();
  await expect(importer.getByLabel("Suggested interest 1", { exact: true })).toHaveValue("python");
  await expect(page.getByLabel("Interests", { exact: true })).toHaveValue("Python, Music");
  expect((await (await page.request.get("/api/data")).json()).user.interests).toBe("Python, Music");
  await importer.getByLabel("Suggested interest 2", { exact: true }).fill("Data visualization");
  await importer.getByRole("button", { name: "Remove suggested interest 5", exact: true }).click();
  // Include manual edits made after analysis, not just the profile at upload time.
  await page.getByLabel("Interests", { exact: true }).fill("Python, Music, Writing");
  await importer.getByRole("button", { name: "Merge suggestions into interests" }).click();
  const merged = "Python, Music, Writing, Data visualization, Robotics, Design";
  await expect(page.getByLabel("Interests", { exact: true })).toHaveValue(merged);
  expect((await (await page.request.get("/api/data")).json()).user.interests).toBe("Python, Music");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByText("Profile updated.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save profile", exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel("Interests", { exact: true })).toHaveValue(merged);
  expect(calls).toBe(1);
});

test("résumé import handles oversized PDFs, invalid AI responses, and provider failures without changing interests", async ({ page, request }) => {
  expect((await request.post("/api/resume-interests", { headers: { "Content-Type": "application/pdf" }, data: "%PDF-1.4\n%%EOF" })).status()).toBe(401);
  await register(page, "Résumé Error Student", `resume-error-${Date.now()}@example.test`);
  await page.goto("/?view=profile");
  const importer = page.getByRole("region", { name: "Import interests from résumé" });
  await page.getByLabel("Interests", { exact: true }).fill("Keep my interests");
  await importer.getByLabel("CV or résumé PDF").setInputFiles({ name: "large.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(importer.getByRole("alert")).toContainText("5 MB");
  let calls = 0;
  await page.route("**/api/resume-interests", route => {
    calls++;
    return route.fulfill(calls === 1 ? { json: { interests: [] } } : { status: 502, json: { error: "Could not analyze this résumé. Your profile is unchanged." } });
  });
  await importer.getByLabel("CV or résumé PDF").setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
  await importer.getByRole("checkbox").check();
  await importer.getByRole("button", { name: "Suggest interests from PDF" }).click();
  await expect(importer.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Interests", { exact: true })).toHaveValue("Keep my interests");
  await expect(importer.getByRole("button", { name: "Merge suggestions into interests" })).toHaveCount(0);
  await importer.getByRole("button", { name: "Suggest interests from PDF" }).click();
  await expect(importer.getByRole("alert")).toContainText("Could not analyze");
  await expect(page.getByLabel("Interests", { exact: true })).toHaveValue("Keep my interests");
  expect((await (await page.request.get("/api/data")).json()).user.interests).toBe("");
});

test("voice project drafting records audio, fills editable fields, and preserves edits on failure or cancellation", async ({ page }) => {
  await register(page, "Voice Lead", `voice-${Date.now()}@example.test`);
  await page.goto("/?view=editor");
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext(); const oscillator = context.createOscillator();
      const destination = context.createMediaStreamDestination(); oscillator.connect(destination); oscillator.start();
      return destination.stream;
    };
  });
  const fields = { title: `Voice Garden ${Date.now()}`, problem: "Students need practical ways to explore gardening.", goal: "Investigate a welcoming beginner garden pilot.", description: "A student-led project exploring how beginners can contribute to a small campus garden pilot.", topic: "Environment", disciplines: "Suggested: Biology, Design", materials: "Suggested: Prepare a fictional garden scenario.", team: "Team details to be confirmed by the lead.", roles: "Suggested: Research assistant", duration: "Suggested: 4 weeks", commitment: "Suggested: 1 hour weekly" };
  let calls = 0;
  await page.route("**/api/project-voice", async route => {
    calls++;
    if (calls === 1) {
      expect(route.request().headers()["content-type"]).toBe("audio/wav");
      const bytes = route.request().postDataBuffer()!; expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
      expect(bytes.length).toBeGreaterThan(44); expect(bytes.length).toBeLessThanOrEqual(1920044);
    }
    if (calls === 3) return route.fulfill({ status: 502, json: { transcript: "We want a small campus garden project for beginners.", error: "Project drafting failed. Your form is unchanged." } });
    await route.fulfill({ json: { transcript: "We want a small campus garden project for beginners.", fields, suggestedFields: ["duration", "materials", "roles"] } });
  });
  await page.getByRole("button", { name: "Record description", exact: true }).click();
  await expect(page.getByText("Recording 1s / 60s", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Stop recording", exact: true }).click();
  await expect(page.getByLabel("Recorded project description")).toBeVisible();
  await page.getByRole("button", { name: "Generate project draft from recording" }).click();
  await expect(page.getByLabel("Project title", { exact: true })).toHaveValue(fields.title);
  await expect(page.getByText("AI-suggested draft applied. Review all fields.", { exact: true })).toBeVisible();
  await page.getByLabel("Project title", { exact: true }).fill("Keep my edited title");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Generate project draft from text" }).click();
  await expect(page.getByRole("button", { name: "Generate project draft from text" })).toBeEnabled();
  await expect(page.getByLabel("Project title", { exact: true })).toHaveValue("Keep my edited title");
  await page.getByRole("button", { name: "Generate project draft from text" }).click();
  await expect(page.getByRole("region", { name: "Voice project draft" }).getByRole("alert")).toContainText("Project drafting failed");
  await expect(page.getByLabel("Project title", { exact: true })).toHaveValue("Keep my edited title");
  await page.clock.install();
  await page.getByRole("button", { name: "Re-record description", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop recording", exact: true })).toBeVisible();
  await page.clock.fastForward(61000);
  await expect(page.getByText("Recording ready (60s)", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop recording", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Save project draft", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Keep my edited title", exact: true })).toBeVisible();
  const data = await (await page.request.get("/api/data")).json();
  expect(data.projects.find((p: { title: string }) => p.title === "Keep my edited title").status).toBe("draft");
});

async function fillTask(page: Page, content: TaskContent) {
  for (const [label, key] of [["Task title", "title"], ["Learning goal", "learningGoal"], ["Prerequisites", "prerequisites"], ["Estimated duration", "duration"], ["Instructions", "instructions"], ["References to supplied materials", "materials"], ["Expected deliverable", "deliverable"], ["Human review criteria", "criteria"], ["Optional hints", "hints"], ["Missing information to resolve before publication", "missingInformation"]] as const) {
    await expect(page.getByLabel(label, { exact: true })).toHaveValue("");
    await page.getByLabel(label, { exact: true }).fill(content[key]);
  }
}

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
  await fillTask(lead, energyTask);
  await lead.getByRole("button", { name: "Save task draft" }).click();
  await expect(lead.getByRole("checkbox", { name: /I have reviewed/ })).toBeVisible();
  await lead.getByRole("checkbox", { name: /I have reviewed/ }).check();
  await lead.getByRole("button", { name: "Approve & publish task" }).click();
  await expect(lead.getByText("Owner-approved task published.", { exact: true })).toBeVisible();
  data = await (await lead.request.get("/api/data")).json(); const task = data.tasks.find((t: { project_id: string }) => t.project_id === projectId);

  await register(student, "Demo Student", `student-${suffix}@example.test`);
  await student.goto(`/?view=workspace&id=${task.id}`);
  await expect(student.getByRole("radio")).toHaveCount(0);
  const explanation = "At 20:00 the fictional building uses 79 kW while closed, compared with 46 kW at noon while open. Equipment scheduling or meter errors could explain this, but neither is proven by this table.";
  await student.getByRole("textbox", { name: "Your response", exact: true }).fill(explanation);
  await student.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(student.getByText("Draft saved. You can pick up right here later.")).toBeVisible();
  await student.reload();
  await expect(student.getByRole("textbox", { name: "Your response", exact: true })).toHaveValue(explanation);
  await student.getByRole("button", { name: "Submit contribution", exact: true }).click();
  await expect(student.getByText("Awaiting human feedback on this revision")).toBeVisible();
  data = await (await student.request.get("/api/data")).json(); const submission = data.submissions.find((s: { task_id: string }) => s.task_id === task.id);
  await lead.goto(`/?view=review&id=${submission.id}`);
  await lead.getByLabel("Feedback on revision 1", { exact: false }).fill("Thoughtful obstacle comparison. Please explain how you would verify path width before testing.");
  await lead.getByRole("button", { name: "Request a revision", exact: true }).click();
  await expect(lead.getByText("Revision requested. Your feedback is saved.", { exact: true })).toBeVisible();
  await student.reload();
  await student.getByRole("link", { name: "Revise your contribution", exact: false }).click();
  await student.getByRole("textbox", { name: "Your response", exact: true }).fill(`${explanation} I would compare equipment logs, meter checks, and historical baselines before making a recommendation.`);
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
  await expect(lead.getByText("No profile interests shared.")).toBeVisible();
  await student.goto("/?view=profile");
  await student.getByLabel("Interests", { exact: true }).fill("Robotics, Sustainable design");
  await student.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(student.getByText("Profile updated.", { exact: true })).toBeVisible();
  await lead.reload();
  await expect(lead.getByText("Profile interests · current", { exact: true })).toBeVisible();
  await expect(lead.getByText("Robotics, Sustainable design")).toBeVisible();
  await expect(lead.getByText("I want to learn how robotics teams test route assumptions responsibly.")).toBeVisible();
  await student.goto("/?view=applications");
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
  const publicData = await (await page.request.get("/api/data")).json();
  await expect(page.locator(".preview-chip")).toHaveCount(publicData.projects.filter((p: { preview: number; status: string }) => p.preview && p.status === "published").length);
  await page.getByRole("textbox", { name: "Search projects" }).fill("Robot Route Rescue");
  await expect(page.locator(".project-card")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Search projects" }).fill("");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("link", { name: "My contributions", exact: false })).toBeVisible();
});

test("core views stay within small screens and navigation and filters remain usable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Search projects" }).fill("no such project");
  await expect(page.getByRole("heading", { name: "Nothing here just yet" })).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page.locator(".project-card").first()).toBeVisible();

  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    for (const view of ["/", "/?view=project&id=robot-route-rescue", "/?view=workspace&id=robot-first-route", "/?view=contributions", "/?view=applications"]) {
      await page.goto(view);
      await expect(page.locator("main")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${view} overflows at ${width}px`).toBe(true);
    }
  }

  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open navigation" });
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "Project lead space", exact: false })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();

  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Try as lead", exact: true }).click();
  for (const view of ["lead", "editor", "task-editor&id=campus-energy-detective", "profile", "applicants"]) {
    await page.goto(`/?view=${view}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${view} overflows at 390px`).toBe(true);
  }
});

test("AI-assisted energy demo publishes synthetic materials and accepts a student text contribution", async ({ page, request, browser }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Try as lead", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/?view=task-editor&id=campus-energy-detective");
  await expect(page.getByLabel("Task title", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Instructions", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Generate starter task", exact: true }).click();
  await expect(page.getByText("SIMULATED OUTPUT — preset example, not live AI. Review and edit before publication.", { exact: true })).toBeVisible();
  const taskId = new URL(page.url()).searchParams.get("id");
  const data = await (await page.request.get("/api/data")).json();
  const task = data.tasks.find((t: { id: string }) => t.id === taskId);
  expect(task.status).toBe("draft"); expect(task.source).toBe("simulated");
  expect(task.content.format).toBe("written-response");
  expect(task.content.title).toMatch(/energy/i);
  expect(task.content.instructions).not.toContain("A small delivery robot");
  expect(task.content.missingInformation).toBe("");
  expect(task.content.materialsOrigin).toBe("simulated-synthetic");
  expect(task.content.materials).toContain("79");
  await page.reload();
  await expect(page.getByText("SIMULATED OUTPUT — preset example, not live AI. Review and edit before publication.", { exact: true })).toBeVisible();
  const publicResponse = await (await request.get("/api/data")).json();
  expect(publicResponse.tasks.some((t: { id: string }) => t.id === taskId)).toBe(false);
  await expect(page.getByText("Simulated fictional demo data (preset, not live AI)", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: /I have reviewed/ }).check();
  await page.getByRole("button", { name: "Approve & publish task", exact: true }).click();
  await expect(page.getByText("Owner-approved task published.", { exact: true })).toBeVisible();
  const studentContext = await browser.newContext();
  const student = await studentContext.newPage();
  const studentName = `Energy Demo Student ${Date.now()}`;
  await register(student, studentName, `energy-${Date.now()}@example.test`);
  await student.goto(`/?view=workspace&id=${taskId}`);
  await expect(student.getByText("Simulated fictional demo data (preset, not live AI)", { exact: true })).toBeVisible();
  await expect(student.locator(".task-materials")).toContainText("79");
  await expect(student.getByRole("radio")).toHaveCount(0);
  await expect(student.getByRole("button", { name: "Submit contribution", exact: true })).toBeDisabled();
  await student.getByRole("textbox", { name: "Your response", exact: true }).fill("   ");
  await expect(student.getByRole("button", { name: "Submit contribution", exact: true })).toBeDisabled();
  await student.getByRole("textbox", { name: "Your response", exact: true }).fill("20:00");
  await student.getByRole("button", { name: "Submit contribution", exact: true }).click();
  await expect(student.getByText("Awaiting human feedback on this revision")).toBeVisible();
  const submissionId = new URL(student.url()).searchParams.get("id");
  await page.goto(`/?view=review&id=${submissionId}`);
  await expect(page.getByText("20:00", { exact: true })).toBeVisible();
  await page.getByLabel("Feedback on revision 1", { exact: true }).fill("You identified the time with the highest power reading. Approved!");
  await page.getByRole("button", { name: "Approve contribution", exact: true }).click();
  await expect(page.getByText("Contribution approved and credited in the shared artifact.")).toBeVisible();
  await student.reload();
  await expect(student.getByRole("heading", { name: "You helped build that." })).toBeVisible();
  await student.goto("/?view=project&id=campus-energy-detective");
  await expect(student.getByText(`Contributed by ${studentName}`, { exact: false })).toBeVisible();
  const publicApproved = await (await request.get("/api/data")).json();
  expect(publicApproved.artifacts.find((a: { id: string }) => a.id === submissionId).content.materialsOrigin).toBe("simulated-synthetic");
  expect(publicApproved.submissions).toEqual([]);
  await studentContext.close();
});

test("generated task fills every editor field, persists, and rejects invalid responses without losing edits", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Try as lead", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/?view=task-editor&id=campus-energy-detective");
  const content = energyTask;
  await page.route("**/api/generate", route => {
    expect(route.request().postDataJSON().format).toBe("written-response");
    return route.fulfill({ json: { simulated: false, content } });
  });
  await page.getByRole("button", { name: "Generate starter task", exact: true }).click();
  await expect(page).not.toHaveURL(/id=campus-energy-detective$/);
  await expect(page.getByLabel("Task title", { exact: true })).toHaveValue(content.title);
  await expect(page.getByLabel("Instructions", { exact: true })).toHaveValue(content.instructions);
  await expect(page.getByLabel("Human review criteria", { exact: true })).toHaveValue(content.criteria);
  const taskId = new URL(page.url()).searchParams.get("id");
  const saved = (await (await page.request.get("/api/data")).json()).tasks.find((task: { id: string }) => task.id === taskId);
  expect(saved.content).toEqual(content); expect(saved.source).toBe("ai"); expect(saved.status).toBe("draft");
  await page.reload();
  await expect(page.getByLabel("Task title", { exact: true })).toHaveValue(content.title);
  await page.getByLabel("Task title", { exact: true }).fill("My unsaved energy task edits");
  await page.unroute("**/api/generate");
  await page.route("**/api/generate", route => route.fulfill({ json: { simulated: false, content: { title: "Invalid draft" } } }));
  await page.getByRole("button", { name: "Generate starter task", exact: true }).click();
  await expect(page.getByText("AI returned an incomplete or unsupported draft. Your editor is unchanged; try again or continue manually.")).toBeVisible();
  await expect(page.getByLabel("Task title", { exact: true })).toHaveValue("My unsaved energy task edits");
  const unchanged = (await (await page.request.get("/api/data")).json()).tasks.find((task: { id: string }) => task.id === taskId);
  expect(unchanged.content).toEqual(content);
});

test("the predefined robot task preserves its interactive map and route submissions", async ({ page, browser }) => {
  await register(page, "Robot Demo Student", `robot-${Date.now()}@example.test`);
  await page.goto("/?view=workspace&id=robot-first-route");
  await expect(page.getByRole("heading", { name: "Find a better way across campus", exact: true })).toBeVisible();
  await expect(page.locator(".route-map")).toBeVisible();
  await page.getByRole("radio", { name: "B", exact: false }).check();
  const explanation = "I recommend the garden loop because it avoids the known stairs and construction. The longer distance is a reasonable trade-off, but I would verify path conditions before testing.";
  await page.getByLabel("Walk us through your thinking", { exact: true }).fill(explanation);
  await page.getByLabel("What would you need to check?", { exact: true }).fill("I would measure path width and check pedestrian traffic before a test.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("Draft saved. You can pick up right here later.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("radio", { name: "B", exact: false })).toBeChecked();
  await expect(page.getByLabel("Walk us through your thinking", { exact: true })).toHaveValue(explanation);
  await page.getByRole("button", { name: "Submit contribution", exact: true }).click();
  await expect(page.getByText("Proposed route B", { exact: true })).toBeVisible();
  const id = new URL(page.url()).searchParams.get("id");
  const context = await browser.newContext(); const lead = await context.newPage();
  await lead.goto("/"); await lead.getByRole("button", { name: "Sign in", exact: true }).click();
  await lead.getByRole("button", { name: "Try as lead", exact: true }).click();
  await expect(lead.getByRole("dialog")).toHaveCount(0);
  await lead.goto(`/?view=review&id=${id}`);
  await expect(lead.locator(".route-map")).toBeVisible();
  await lead.getByLabel("Feedback on revision 1", { exact: true }).fill("Good route comparison and sensible checks for uncertainty. Approved for the demo notebook.");
  await lead.getByRole("button", { name: "Approve contribution", exact: true }).click();
  await expect(lead.getByText("Contribution approved and credited in the shared artifact.")).toBeVisible();
  await context.close();
});
