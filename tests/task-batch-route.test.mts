import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { microtasks } from "./fixtures/task-batch";
import type { Project } from "../lib/types";

process.env.DATABASE_PATH = ":memory:";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.OPENROUTER_API_KEY = "test-key";
const { db } = await import("../lib/db");
const { auth } = await import("../lib/auth");
const { mutate, getData, publishTaskBatch } = await import("../lib/service");
const { POST } = await import("../app/api/generate-tasks/route");
const { consumeAiBudget } = await import("../lib/ai-request");
const originalFetch = globalThis.fetch;
let cookie = "", user = "", project = "", calls = 0;
const validProvider = async () => { calls++; return Response.json({ choices: [{ message: { content: JSON.stringify({ tasks: microtasks.slice(0, 2) }) } }] }); };
before(async () => {
  const signup = await auth.api.signUpEmail({ body: { name: "Batch Lead", email: "batch@example.test", password: "batch-test-password" }, asResponse: true });
  cookie = signup.headers.get("set-cookie")!.split(";")[0]; user = (await signup.json()).user.id;
  db.prepare("INSERT INTO user (id,name,email,createdAt,updatedAt) VALUES ('other','Other','other@example.test',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").run();
  project = String(mutate(user, { action: "save-project", payload: { title: "Campus Energy", problem: "Read energy readings in a tiny fictional table.", goal: "Help beginners read fictional energy data.", description: "A fictional student energy project for testing automatic microtasks.", topic: "Energy", disciplines: "Engineering", materials: "Fictional energy readings for practice.", team: "Batch Lead", roles: "Research", duration: "4 weeks", commitment: "1 hour per week", accepting: true } }).id);
  globalThis.fetch = validProvider;
});
after(() => { globalThis.fetch = originalFetch; });
function request(headers: Record<string, string> = {}) { return new Request("http://localhost:3000/api/generate-tasks", { method: "POST", headers: { cookie, "content-type": "application/json", ...headers }, body: JSON.stringify({ project }) }); }
function reset() { db.prepare("DELETE FROM generation_limits WHERE user_id=?").run(user); }
function snapshot() { return db.prepare("SELECT * FROM projects WHERE id=?").get(project) as Project; }
function count() { return (db.prepare("SELECT COUNT(*) n FROM tasks WHERE project_id=?").get(project) as { n: number }).n; }
test("batch endpoint requires authentication, same origin and lead permission", async () => {
  assert.equal((await POST(request({ cookie: "" }))).status, 401);
  assert.equal((await POST(request({ origin: "https://untrusted.example" }))).status, 403);
  db.prepare("UPDATE memberships SET role='reviewer' WHERE project_id=? AND user_id=?").run(project, user);
  assert.equal((await POST(request())).status, 403);
  db.prepare("UPDATE memberships SET role='lead' WHERE project_id=? AND user_id=?").run(project, user);
  assert.equal(calls, 0);
});
test("draft projects, missing API keys, and rate limits never create tasks", async () => {
  assert.equal((await POST(request())).status, 409);
  mutate(user, { action: "project-status", id: project, payload: "published" });
  process.env.OPENROUTER_API_KEY = "";
  assert.equal((await POST(request())).status, 503);
  process.env.OPENROUTER_API_KEY = "test-key";
  for (let i = 0; i < 5; i++) consumeAiBudget(user);
  assert.equal((await POST(request())).status, 429);
  assert.equal(count(), 0); assert.equal(calls, 0); reset();
});
test("invalid or failed AI batches create no partial tasks", async () => {
  for (const tasks of [[], [microtasks[0]], [microtasks[0], microtasks[0]], [microtasks[0], { ...microtasks[1], missingInformation: "Missing data" }]]) {
    reset(); globalThis.fetch = async () => Response.json({ choices: [{ message: { content: JSON.stringify({ tasks }) } }] });
    assert.equal((await POST(request())).status, 502); assert.equal(count(), 0);
  }
  reset(); globalThis.fetch = async () => new Response("private provider details", { status: 500 });
  const response = await POST(request());
  assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /private provider details/);
  assert.equal(count(), 0); globalThis.fetch = validProvider; reset();
});
test("publication rechecks project state and permission and rolls back every task on database failure", () => {
  const saved = snapshot();
  assert.throws(() => publishTaskBatch("other", saved, microtasks), /Only a lead/);
  db.prepare("UPDATE projects SET goal='Changed goal' WHERE id=?").run(project);
  assert.throws(() => publishTaskBatch(user, saved, microtasks), /project changed/);
  db.prepare("UPDATE projects SET goal=? WHERE id=?").run(saved.goal, project);
  db.prepare("UPDATE projects SET status='closed' WHERE id=?").run(project);
  assert.throws(() => publishTaskBatch(user, saved, microtasks), /closed projects/);
  db.prepare("UPDATE projects SET status='published' WHERE id=?").run(project);
  db.exec("CREATE TRIGGER fail_batch BEFORE INSERT ON task_versions WHEN (SELECT COUNT(*) FROM task_versions) > 0 BEGIN SELECT RAISE(ABORT,'test failure'); END");
  assert.throws(() => publishTaskBatch(user, saved, microtasks), /test failure/);
  db.exec("DROP TRIGGER fail_batch");
  assert.equal(count(), 0);
  assert.equal((db.prepare("SELECT COUNT(*) n FROM task_versions").get() as { n: number }).n, 0);
});
test("one call publishes all tasks and immutable versions with no human approval flag; students can submit", async () => {
  const response = await POST(request());
  assert.equal(response.status, 200);
  const result = await response.json(); assert.equal(result.count, 2); assert.equal(calls, 1);
  assert.equal(count(), 2);
  const publicTasks = getData().tasks.filter(t => t.project_id === project);
  assert.equal(publicTasks.length, 2);
  for (const task of publicTasks) {
    assert.equal(task.status, "published"); assert.equal(task.source, "ai-auto"); assert.equal(task.approved, 0);
    assert.equal(task.reviewer, user); assert.equal(task.content.materialsOrigin, "ai-synthetic");
    assert.ok(db.prepare("SELECT 1 FROM task_versions WHERE task_id=? AND version=1").get(task.id));
  }
  assert.throws(() => db.prepare("UPDATE task_versions SET content='{}' WHERE task_id=?").run(publicTasks[0].id), /immutable/);
  mutate("other", { action: "submit", id: publicTasks[0].id, payload: { answers: { response: "20:00" }, expectedRevision: 0, expectedStatus: "draft", taskVersion: 1 } });
  const repeat = await POST(request());
  assert.equal(repeat.status, 409); assert.equal(count(), 2);
});
