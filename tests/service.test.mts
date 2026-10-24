import { before, test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_PATH = ":memory:";
const { db } = await import("../lib/db");
const { mutate, getData, AppError } = await import("../lib/service");
const { routeTask } = await import("../lib/content");
const { energyTask } = await import("./fixtures/energy-task");
const lead = "test-lead", student = "test-student", stranger = "test-stranger";
let project = "", task = "", submission = "";
const answers = { response: "The fictional building uses 79 kW at 20:00 while closed, compared with 46 kW at noon while open. I would check equipment schedules and meter accuracy before concluding why this happens." };
function act(user: string, action: string, id: string, payload?: unknown) { return mutate(user, { action, id: id || undefined, payload }); }
function rejects(fn: () => unknown, status?: number) { assert.throws(fn, error => error instanceof AppError && (!status || error.status === status)); }
before(() => {
  for (const [id, name] of [[lead, "Test Lead"], [student, "Test Student"], [stranger, "Other Student"]]) db.prepare("INSERT INTO user (id,name,email,createdAt,updatedAt) VALUES (?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").run(id, name, `${id}@example.test`);
});
test("a lead creates a private project and explicitly publishes an approved task", () => {
  project = String(act(lead, "save-project", "", { title: "Demo route project", problem: "A fictional robot needs help finding a route.", goal: "Learn to evaluate route trade-offs thoughtfully.", description: "A fictional project for testing the full human contribution flow.", topic: "Robotics", disciplines: "Engineering", materials: routeTask.materials, team: "Test Lead (demo)", roles: "Route research\nDesign", duration: "6 weeks", commitment: "2 hours per week", accepting: true }).id);
  assert.equal(getData().projects.length, 0);
  task = String(act(lead, "save-task", "", { project, reviewer: lead, content: energyTask }).id);
  rejects(() => act(stranger, "project-status", project, "published"), 403);
  rejects(() => act(lead, "publish-task", task, { approved: true, expectedVersion: 1 }));
  act(lead, "project-status", project, "published");
  rejects(() => act(lead, "publish-task", task, { approved: false, expectedVersion: 1 }));
  act(lead, "publish-task", task, { approved: true, expectedVersion: 1 });
  assert.equal(getData().tasks.length, 1);
});
test("drafts are private and incomplete submissions roll back atomically", () => {
  rejects(() => act(student, "submit", task, { answers: { response: "too short" }, expectedRevision: 0, expectedStatus: "draft", taskVersion: 1 }));
  rejects(() => act(student, "submit", task, { answers: { route: "B", explanation: "Wrong response type for this task.", missing: "Missing format validation" }, expectedRevision: 0, expectedStatus: "draft", taskVersion: 1 }));
  assert.equal(db.prepare("SELECT count(*) count FROM submissions").get() && (db.prepare("SELECT count(*) count FROM submissions").get() as { count: number }).count, 0);
  submission = String(act(student, "save-draft", task, { answers, expectedRevision: 0, expectedStatus: "draft", taskVersion: 1 }).id);
  assert.equal(getData({ id: student, name: "Student", email: "student@test.demo" }).submissions.length, 1);
  assert.equal(getData({ id: lead, name: "Lead", email: "lead@test.demo" }).submissions.length, 0);
  assert.equal(getData({ id: stranger, name: "Other", email: "other@test.demo" }).submissions.length, 0);
  assert.equal(getData().submissions.length, 0);
});
test("only the assigned human can review, never their own work", () => {
  rejects(() => act(lead, "submit", task, { answers, expectedRevision: 0, expectedStatus: "draft", taskVersion: 1 }), 403);
  act(student, "submit", task, { answers, expectedRevision: 0, expectedStatus: "draft", taskVersion: 1 });
  rejects(() => act(student, "review", submission, { revision: 1, decision: "approved", feedback: "I am approving my own work here." }), 403);
  rejects(() => act(stranger, "review", submission, { revision: 1, decision: "approved", feedback: "I do not manage this project at all." }), 403);
  rejects(() => act(student, "save-draft", task, { answers, expectedRevision: 1, expectedStatus: "submitted", taskVersion: 1 }), 409);
  act(lead, "review", submission, { revision: 1, decision: "revision_requested", feedback: "Please also explain how you would check the path width." });
  assert.equal(getData().artifacts.length, 0);
});
test("resubmission retains immutable history; stale decisions and duplicate effects are prevented", () => {
  const updated = { response: `${answers.response} I would also check weather and occupancy records; the synthetic table cannot establish causation.` };
  rejects(() => act(student, "submit", task, { answers: updated, expectedRevision: 0, expectedStatus: "draft", taskVersion: 1 }), 409);
  act(student, "submit", task, { answers: updated, expectedRevision: 1, expectedStatus: "revision_requested", taskVersion: 1 });
  assert.throws(() => db.prepare("UPDATE revisions SET answers='{}' WHERE submission_id=?").run(submission), /immutable/);
  assert.throws(() => db.prepare("UPDATE task_versions SET content='{}' WHERE task_id=?").run(task), /immutable/);
  rejects(() => act(lead, "review", submission, { revision: 1, decision: "approved", feedback: "This is a stale approval of an old revision." }), 409);
  const approval = { revision: 2, decision: "approved", feedback: "Clear trade-offs and a practical width check. Thank you for contributing!" };
  act(lead, "review", submission, approval);
  act(lead, "review", submission, approval);
  assert.equal(getData().artifacts.length, 1);
  const saved = getData({ id: student, name: "Student", email: "student@test.demo" }).submissions[0];
  assert.equal(saved.revisions.length, 2);
  assert.deepEqual(saved.revisions[0].answers, answers);
  assert.equal(saved.content.materialsOrigin, "ai-synthetic");
  assert.equal(saved.content.materials, energyTask.materials);
  assert.equal(getData().artifacts[0].content.materialsOrigin, "ai-synthetic");
  assert.equal(saved.revisions[0].review?.decision, "revision_requested");
  assert.equal(saved.revisions[1].review?.decision, "approved");
  assert.equal(getData().applications.length, 0);
});
test("an application must link an owned, same-project approved contribution", () => {
  rejects(() => act(stranger, "apply", project, { submission, role: "Route research", availability: "Tuesdays", interests: "Learning more about route planning" }), 403);
  rejects(() => act(student, "apply", project, { submission, role: "Invented role", availability: "Tuesdays", interests: "Learning more about route planning" }));
  const payload = { submission, role: "Route research", availability: "Tuesdays 2–4pm", interests: "Learning more about route planning" };
  const application = String(act(student, "apply", project, payload).id);
  assert.equal(act(student, "apply", project, payload).id, application);
  const viewer = (id: string) => getData({ id, name: id, email: `${id}@example.test` });
  assert.equal(viewer(lead).applications.find(a => a.id === application)?.profile_interests, "");
  act(student, "profile", "", { name: "Test Student", interests: "Robotics, Sustainable design" });
  assert.equal(viewer(lead).applications.find(a => a.id === application)?.profile_interests, "Robotics, Sustainable design");
  assert.equal(viewer(student).applications.find(a => a.id === application)?.profile_interests, "Robotics, Sustainable design");
  assert.equal(viewer(lead).applications.find(a => a.id === application)?.interests, payload.interests);
  assert.deepEqual(viewer(stranger).applications, []);
  assert.deepEqual(getData().applications, []);
  // Reviewing contributions does not grant access to private applications/profiles.
  db.prepare("INSERT INTO memberships (project_id,user_id,role) VALUES (?,?,'reviewer')").run(project, stranger);
  assert.deepEqual(viewer(stranger).applications, []);
  db.prepare("DELETE FROM memberships WHERE project_id=? AND user_id=?").run(project, stranger);
  act(student, "profile", "", { name: "Test Student", interests: "" });
  assert.equal(viewer(lead).applications.find(a => a.id === application)?.profile_interests, "");
  rejects(() => act(student, "application-status", application, "invited"), 403);
  rejects(() => act(stranger, "application-status", application, "accepted"), 403);
  rejects(() => act(student, "application-status", application, "accepted"), 409);
  act(lead, "application-status", application, "invited");
  assert.equal(db.prepare("SELECT 1 FROM memberships WHERE project_id=? AND user_id=?").get(project, student), undefined);
  act(student, "application-status", application, "accepted");
  act(student, "application-status", application, "accepted");
  assert.equal((db.prepare("SELECT count(*) count FROM memberships WHERE project_id=? AND user_id=?").get(project, student) as { count: number }).count, 1);
  assert.equal(getData().artifacts.length, 1);
  assert.equal(getData().applications.length, 0);
});
test("planning drafts cannot be published even when missing information is cleared", () => {
  const id = String(act(lead, "save-task", "", { project, reviewer: lead, content: { ...routeTask, title: "An unpublished planning draft", format: "planning-only", missingInformation: "" } }).id);
  rejects(() => act(lead, "publish-task", id, { approved: true, expectedVersion: 1 }));
  assert.equal((db.prepare("SELECT status FROM tasks WHERE id=?").get(id) as { status: string }).status, "draft");
  assert.equal(getData().tasks.some(t => t.id === id), false);
  act(lead, "save-task", id, { project, reviewer: lead, expectedVersion: 1, content: energyTask });
  act(lead, "publish-task", id, { approved: true, expectedVersion: 2 });
  assert.equal((db.prepare("SELECT status FROM tasks WHERE id=?").get(id) as { status: string }).status, "published");
});
test("custom tasks cannot add interactive engines and generated provenance cannot be silently dropped", () => {
  rejects(() => act(lead, "save-task", "", { project, reviewer: lead, content: routeTask }));
  const id = String(act(lead, "save-task", "", { project, reviewer: lead, content: { ...energyTask, materials: "Fictional supplied numbers: 18 kW, 19 kW, 79 kW." } }).id);
  const stored = JSON.parse((db.prepare("SELECT content FROM tasks WHERE id=?").get(id) as { content: string }).content);
  assert.match(stored.materials, /^AI-generated fictional demo data/);
  act(lead, "save-task", id, { project, reviewer: lead, expectedVersion: 1, content: { ...energyTask, materials: "Edited synthetic readings: 18 kW and 79 kW.", materialsOrigin: "provided" } });
  const edited = JSON.parse((db.prepare("SELECT content FROM tasks WHERE id=?").get(id) as { content: string }).content);
  assert.equal(edited.materialsOrigin, "ai-synthetic");
  assert.match(edited.materials, /^AI-generated fictional demo data/);
  act(lead, "save-task", id, { project, reviewer: lead, expectedVersion: 2, source: "simulated", content: { ...energyTask, materials: "New fictional preset data: 12 kW and 30 kW.", materialsOrigin: "simulated-synthetic" } });
  const regenerated = JSON.parse((db.prepare("SELECT content FROM tasks WHERE id=?").get(id) as { content: string }).content);
  assert.equal(regenerated.materialsOrigin, "simulated-synthetic");
  assert.match(regenerated.materials, /^Simulated fictional demo data/);
});
test("missing evidence still blocks text publication until the lead resolves it", () => {
  const id = String(act(lead, "save-task", "", { project, reviewer: lead, content: { ...energyTask, missingInformation: "Supply the missing units before publishing." } }).id);
  rejects(() => act(lead, "publish-task", id, { approved: true, expectedVersion: 1 }));
  assert.equal(db.prepare("SELECT 1 FROM task_versions WHERE task_id=?").get(id), undefined);
});
