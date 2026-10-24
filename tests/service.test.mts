import { before, test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_PATH = ":memory:";
const { db } = await import("../lib/db");
const { mutate, getData, AppError } = await import("../lib/service");
const { routeTask } = await import("../lib/content");
const lead = "test-lead", student = "test-student", stranger = "test-stranger";
let project = "", task = "", submission = "";
const answers = { route: "B", explanation: "The garden loop avoids the stairs on route A and the construction on route C. Its longer distance is a reasonable trade-off for a level route.", missing: "I would measure path width and check pedestrian traffic before any test." };
function act(user: string, action: string, id: string, payload?: unknown) { return mutate(user, { action, id: id || undefined, payload }); }
function rejects(fn: () => unknown, status?: number) { assert.throws(fn, error => error instanceof AppError && (!status || error.status === status)); }
before(() => {
  for (const [id, name] of [[lead, "Test Lead"], [student, "Test Student"], [stranger, "Other Student"]]) db.prepare("INSERT INTO user (id,name,email,createdAt,updatedAt) VALUES (?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").run(id, name, `${id}@example.test`);
});
test("a lead creates a private project and explicitly publishes an approved task", () => {
  project = String(act(lead, "save-project", "", { title: "Demo route project", problem: "A fictional robot needs help finding a route.", goal: "Learn to evaluate route trade-offs thoughtfully.", description: "A fictional project for testing the full human contribution flow.", topic: "Robotics", disciplines: "Engineering", materials: routeTask.materials, team: "Test Lead (demo)", roles: "Route research\nDesign", duration: "6 weeks", commitment: "2 hours per week", accepting: true }).id);
  assert.equal(getData().projects.length, 0);
  task = String(act(lead, "save-task", "", { project, reviewer: lead, content: routeTask }).id);
  rejects(() => act(stranger, "project-status", project, "published"), 403);
  rejects(() => act(lead, "publish-task", task, { approved: true, expectedVersion: 1 }));
  act(lead, "project-status", project, "published");
  rejects(() => act(lead, "publish-task", task, { approved: false, expectedVersion: 1 }));
  act(lead, "publish-task", task, { approved: true, expectedVersion: 1 });
  assert.equal(getData().tasks.length, 1);
});
test("drafts are private and incomplete submissions roll back atomically", () => {
  rejects(() => act(student, "submit", task, { answers: { route: "B", explanation: "too short", missing: "" }, expectedRevision: 0, expectedStatus: "draft", taskVersion: 1 }));
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
  const updated = { ...answers, missing: `${answers.missing} I would compare its narrowest point against the robot's required clearance.` };
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
  assert.equal(saved.revisions[0].answers.missing, answers.missing);
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
