import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import type { Project, Task, Submission, Application, Data, Revision, Artifact } from "./types";
import { routeTask } from "./content";

export class AppError extends Error { constructor(message: string, public status = 400) { super(message); } }
const text = (min = 1, max = 8000) => z.string().trim().min(min).max(max);
export const taskSchema = z.object({
  title: text(5, 160), learningGoal: text(10), prerequisites: text(), duration: text(), instructions: text(40), materials: text(10), deliverable: text(10), criteria: text(15), hints: z.string().max(4000), missingInformation: z.string().max(4000), format: z.literal("route-selection"),
});
const answerSchema = z.object({ route: z.enum(["A", "B", "C"]), explanation: text(60, 5000).refine(s => s.split(/\s+/).length >= 12, "Explain your choice in at least 12 words."), missing: text(20, 3000) });
const projectSchema = z.object({ title: text(4, 120), problem: text(15), goal: text(15), description: text(30), topic: text(), disciplines: text(), materials: text(10), team: text(), roles: text(), duration: text(), commitment: text(), accepting: z.boolean() });
type Row = Record<string, string | number>;
const row = (sql: string, ...args: (string | number)[]) => db.prepare(sql).get(...args) as Row | undefined;
function requireRow(value: Row | undefined, message = "This record could not be found.") { if (!value) throw new AppError(message, 404); return value; }
export function manages(user: string, project: string) { return !!row("SELECT 1 FROM memberships WHERE project_id=? AND user_id=? AND role IN ('lead','reviewer')", project, user); }
function requireLead(user: string, project: string) { if (!row("SELECT 1 FROM memberships WHERE project_id=? AND user_id=? AND role='lead'", project, user)) throw new AppError("Only a lead assigned to this project can do that.", 403); }
function parse<T>(schema: z.ZodType<T>, value: unknown): T { const result = schema.safeParse(value); if (!result.success) throw new AppError(result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(" · ")); return result.data; }

export function getData(user?: { id: string; name: string; email: string }): Data {
  const uid = user?.id ?? "";
  const memberships = db.prepare("SELECT project_id,role FROM memberships WHERE user_id=?").all(uid) as Data["memberships"];
  const managed = memberships.filter(m => m.role !== "member").map(m => m.project_id);
  const projects = db.prepare("SELECT p.* FROM projects p WHERE p.status IN ('published','closed') OR EXISTS (SELECT 1 FROM memberships m WHERE m.project_id=p.id AND m.user_id=? AND m.role IN ('lead','reviewer')) ORDER BY p.created_at,p.rowid").all(uid) as Project[];
  const tasks = (db.prepare("SELECT t.*,u.name reviewer_name FROM tasks t JOIN user u ON u.id=t.reviewer JOIN projects p ON p.id=t.project_id WHERE (t.status IN ('published','closed') AND p.status IN ('published','closed')) OR EXISTS (SELECT 1 FROM memberships m WHERE m.project_id=p.id AND m.user_id=? AND m.role IN ('lead','reviewer'))").all(uid) as (Omit<Task, "content"> & { content: string })[]).map(t => ({ ...t, content: JSON.parse(t.content) }));
  const submissions = (db.prepare(`SELECT s.*,t.project_id,t.reviewer,p.title project_title,u.name student_name,v.content FROM submissions s JOIN tasks t ON t.id=s.task_id JOIN projects p ON p.id=t.project_id JOIN user u ON u.id=s.student JOIN task_versions v ON v.task_id=s.task_id AND v.version=s.task_version WHERE s.student=? OR (s.status!='draft' AND EXISTS (SELECT 1 FROM memberships m WHERE m.project_id=t.project_id AND m.user_id=? AND m.role IN ('lead','reviewer'))) ORDER BY s.updated_at DESC`).all(uid, uid) as (Omit<Submission, "content" | "draft" | "revisions"> & { content: string; draft: string })[]).map(s => ({ ...s, content: JSON.parse(s.content), draft: s.student === uid ? JSON.parse(s.draft) : {}, revisions: (db.prepare("SELECT * FROM revisions WHERE submission_id=? ORDER BY number").all(s.id) as (Omit<Revision, "answers"> & { answers: string })[]).map(r => ({ ...r, answers: JSON.parse(r.answers), review: db.prepare("SELECT r.*,u.name reviewer_name FROM reviews r JOIN user u ON u.id=r.reviewer WHERE revision_id=?").get(r.id) as Revision["review"] })) }));
  const applications = db.prepare("SELECT a.*,u.name student_name FROM applications a JOIN user u ON u.id=a.student WHERE a.student=? OR EXISTS (SELECT 1 FROM memberships m WHERE m.project_id=a.project_id AND m.user_id=? AND m.role='lead') ORDER BY a.created_at DESC").all(uid, uid) as Application[];
  const artifacts = (db.prepare("SELECT s.id,t.project_id,u.name student_name,v.content,r.answers FROM submissions s JOIN tasks t ON t.id=s.task_id JOIN projects p ON p.id=t.project_id JOIN user u ON u.id=s.student JOIN task_versions v ON v.task_id=s.task_id AND v.version=s.task_version JOIN revisions r ON r.submission_id=s.id AND r.number=s.current_revision WHERE s.status='approved' AND p.status IN ('published','closed')").all() as { id: string; project_id: string; student_name: string; content: string; answers: string }[]).map(a => ({ id: a.id, project_id: a.project_id, student_name: a.student_name, title: JSON.parse(a.content).title, answers: JSON.parse(a.answers) })) as Artifact[];
  const reviewers = db.prepare("SELECT m.project_id,u.id,u.name FROM memberships m JOIN user u ON u.id=m.user_id WHERE m.role IN ('lead','reviewer') AND EXISTS (SELECT 1 FROM memberships own WHERE own.project_id=m.project_id AND own.user_id=? AND own.role='lead')").all(uid) as Data["reviewers"];
  const profile = row("SELECT interests FROM profiles WHERE id=?", uid);
  return { user: user ? { ...user, interests: String(profile?.interests ?? "") } : null, projects, tasks, submissions, applications, artifacts, managed, memberships, reviewers };
}

export function mutate(user: string, input: unknown) {
  const body = parse(z.object({ action: text(), id: z.string().optional(), payload: z.unknown().optional() }), input);
  return db.transaction(() => {
    const id = body.id ?? "";
    const p = body.payload;
    if (body.action === "profile") {
      const data = parse(z.object({ name: text(2, 100), interests: z.string().max(1000) }), p);
      db.prepare("UPDATE user SET name=?,updatedAt=CURRENT_TIMESTAMP WHERE id=?").run(data.name, user);
      db.prepare("INSERT INTO profiles VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,interests=excluded.interests").run(user, data.name, data.interests);
      return { id: user };
    }
    if (body.action === "save-project") {
      const data = parse(projectSchema, p);
      const projectId = id || randomUUID();
      if (id) {
        requireLead(user, id);
        const project = requireRow(row("SELECT * FROM projects WHERE id=?", id));
        if (project.status === "closed") throw new AppError("Closed projects cannot be edited.");
        db.prepare("UPDATE projects SET title=?,problem=?,goal=?,description=?,topic=?,disciplines=?,materials=?,team=?,roles=?,duration=?,commitment=?,accepting=? WHERE id=?").run(data.title, data.problem, data.goal, data.description, data.topic, data.disciplines, data.materials, data.team, data.roles, data.duration, data.commitment, +data.accepting, id);
      } else {
        db.prepare("INSERT INTO projects (id,creator,title,problem,goal,description,topic,disciplines,materials,team,roles,duration,commitment,status,accepting) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?)").run(projectId, user, data.title, data.problem, data.goal, data.description, data.topic, data.disciplines, data.materials, data.team, data.roles, data.duration, data.commitment, +data.accepting);
        db.prepare("INSERT INTO memberships VALUES (?,?,'lead')").run(projectId, user);
      }
      return { id: projectId };
    }
    if (body.action === "project-status") {
      requireLead(user, id);
      const target = parse(z.enum(["published", "closed"]), p);
      const project = requireRow(row("SELECT * FROM projects WHERE id=?", id));
      if (project.status === target) return { id };
      if ((target === "published" && project.status !== "draft") || (target === "closed" && project.status !== "published")) throw new AppError("The project status changed. Refresh and try again.", 409);
      db.prepare("UPDATE projects SET status=?,accepting=CASE WHEN ?='closed' THEN 0 ELSE accepting END WHERE id=?").run(target, target, id);
      return { id };
    }
    if (body.action === "save-task") {
      const data = parse(z.object({ project: text(), reviewer: text(), content: taskSchema, expectedVersion: z.number().int().optional(), source: z.enum(["manual", "ai", "simulated"]).optional() }), p);
      requireLead(user, data.project);
      const project = requireRow(row("SELECT * FROM projects WHERE id=?", data.project));
      if (project.status === "closed") throw new AppError("This project is closed.");
      if (!manages(data.reviewer, data.project)) throw new AppError("Choose a reviewer assigned to this project.");
      const taskId = id || randomUUID();
      if (id) {
        const task = requireRow(row("SELECT * FROM tasks WHERE id=? AND project_id=?", id, data.project));
        if (task.status !== "draft" || task.current_version !== data.expectedVersion) throw new AppError("This task changed or is already published. Refresh before editing.", 409);
        db.prepare("UPDATE tasks SET content=?,reviewer=?,current_version=current_version+1,approved=0,source=? WHERE id=?").run(JSON.stringify(data.content), data.reviewer, data.source || task.source, id);
      } else db.prepare("INSERT INTO tasks (id,project_id,reviewer,status,content,source) VALUES (?,?,?,'draft',?,?)").run(taskId, data.project, data.reviewer, JSON.stringify(data.content), data.source || "manual");
      return { id: taskId };
    }
    if (body.action === "publish-task" || body.action === "close-task") {
      const task = requireRow(row("SELECT * FROM tasks WHERE id=?", id));
      requireLead(user, String(task.project_id));
      if (body.action === "close-task") {
        if (task.status !== "published") throw new AppError("Only a published task can be closed.");
        db.prepare("UPDATE tasks SET status='closed' WHERE id=?").run(id);
      } else {
        if (task.status === "published") return { id };
        if (task.status !== "draft") throw new AppError("This task cannot be published.");
        parse(z.object({ approved: z.literal(true), expectedVersion: z.literal(Number(task.current_version)) }), p);
        const content = parse(taskSchema, JSON.parse(String(task.content)));
        if (content.missingInformation.trim()) throw new AppError("Resolve the missing information field before publishing.");
        const project = requireRow(row("SELECT * FROM projects WHERE id=?", String(task.project_id)));
        if (project.status !== "published") throw new AppError("Publish the project before its task.");
        db.prepare("INSERT INTO task_versions (task_id,version,content,reviewer) VALUES (?,?,?,?)").run(id, task.current_version, task.content, task.reviewer);
        db.prepare("UPDATE tasks SET status='published',approved=1 WHERE id=?").run(id);
        db.prepare("UPDATE projects SET preview=0 WHERE id=?").run(task.project_id);
      }
      return { id };
    }
    if (body.action === "save-draft" || body.action === "submit") {
      const data = parse(z.object({ answers: z.object({ route: z.string().max(1), explanation: z.string().max(5000), missing: z.string().max(3000) }), expectedRevision: z.number().int().min(0), expectedStatus: z.string(), taskVersion: z.number().int().positive() }), p);
      const task = requireRow(row("SELECT t.*,p.status project_status,p.accepting FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.id=?", id));
      if (task.status !== "published" || task.project_status !== "published" || !task.accepting) throw new AppError("This project is not accepting new task work right now.");
      if (task.reviewer === user) throw new AppError("You cannot submit a task assigned to you for review.", 403);
      let submission = row("SELECT * FROM submissions WHERE task_id=? AND student=?", id, user);
      if (!submission) {
        if (data.taskVersion !== task.current_version) throw new AppError("The task changed. Reload the latest instructions.", 409);
        const submissionId = randomUUID();
        db.prepare("INSERT INTO submissions (id,task_id,student,task_version,status) VALUES (?,?,?,?,'draft')").run(submissionId, id, user, task.current_version);
        submission = requireRow(row("SELECT * FROM submissions WHERE id=?", submissionId));
      }
      if (submission.current_revision !== data.expectedRevision || submission.status !== data.expectedStatus) throw new AppError("Your work changed in another session. Reload before saving.", 409);
      if (!["draft", "revision_requested"].includes(String(submission.status))) throw new AppError("Submitted work is read-only until a reviewer requests a revision.", 409);
      if (body.action === "submit") {
        const answers = parse(answerSchema, data.answers);
        const revision = Number(submission.current_revision) + 1;
        db.prepare("INSERT INTO revisions (id,submission_id,number,answers) VALUES (?,?,?,?)").run(randomUUID(), submission.id, revision, JSON.stringify(answers));
        db.prepare("UPDATE submissions SET current_revision=?,status=?,draft=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(revision, revision === 1 ? "submitted" : "resubmitted", JSON.stringify(answers), submission.id);
      } else db.prepare("UPDATE submissions SET draft=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(JSON.stringify(data.answers), submission.id);
      return { id: submission.id };
    }
    if (body.action === "review") {
      const data = parse(z.object({ revision: z.number().int().positive(), decision: z.enum(["approved", "revision_requested"]), feedback: text(20, 5000) }), p);
      const submission = requireRow(row("SELECT s.*,v.reviewer,t.project_id FROM submissions s JOIN tasks t ON t.id=s.task_id JOIN task_versions v ON v.task_id=s.task_id AND v.version=s.task_version WHERE s.id=?", id));
      if (!manages(user, String(submission.project_id)) || submission.reviewer !== user || submission.student === user) throw new AppError("Only the assigned human reviewer can review this contribution, and never their own work.", 403);
      const revision = requireRow(row("SELECT * FROM revisions WHERE submission_id=? AND number=?", id, data.revision));
      const previous = row("SELECT * FROM reviews WHERE revision_id=?", String(revision.id));
      if (previous && previous.decision === data.decision && previous.feedback === data.feedback) return { id };
      if (submission.current_revision !== data.revision || !["submitted", "resubmitted"].includes(String(submission.status))) throw new AppError("This revision has already been reviewed or changed. Reload to see the latest work.", 409);
      db.prepare("INSERT INTO reviews (id,revision_id,reviewer,decision,feedback) VALUES (?,?,?,?,?)").run(randomUUID(), revision.id, user, data.decision, data.feedback);
      db.prepare("UPDATE submissions SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(data.decision, id);
      return { id };
    }
    if (body.action === "apply") {
      const data = parse(z.object({ submission: text(), role: text(), availability: text(5, 2000), interests: text(15, 3000) }), p);
      const project = requireRow(row("SELECT * FROM projects WHERE id=?", id));
      if (project.status !== "published" || !project.accepting || project.preview) throw new AppError("This project is not accepting applications.");
      if (row("SELECT 1 FROM memberships WHERE project_id=? AND user_id=?", id, user)) throw new AppError("You are already on this project’s team.");
      if (!String(project.roles).split("\n").map(s => s.trim()).includes(data.role)) throw new AppError("Choose an available project role.");
      if (!row("SELECT 1 FROM submissions s JOIN tasks t ON t.id=s.task_id WHERE s.id=? AND s.student=? AND s.status='approved' AND t.project_id=?", data.submission, user, id)) throw new AppError("Link your own approved contribution from this project.", 403);
      const existing = row("SELECT id FROM applications WHERE project_id=? AND student=?", id, user);
      if (existing) return { id: existing.id };
      const applicationId = randomUUID();
      db.prepare("INSERT INTO applications (id,project_id,student,submission_id,role,availability,interests,status) VALUES (?,?,?,?,?,?,?,'pending')").run(applicationId, id, user, data.submission, data.role, data.availability, data.interests);
      return { id: applicationId };
    }
    if (body.action === "application-status") {
      const target = parse(z.enum(["invited", "rejected", "accepted", "declined", "withdrawn"]), p);
      const application = requireRow(row("SELECT * FROM applications WHERE id=?", id));
      if (["invited", "rejected"].includes(target)) requireLead(user, String(application.project_id));
      else if (application.student !== user) throw new AppError("Only the applicant can respond.", 403);
      if (application.status === target) return { id };
      const allowed = target === "withdrawn" ? ["pending", "invited"] : ["accepted", "declined"].includes(target) ? ["invited"] : ["pending"];
      if (!allowed.includes(String(application.status))) throw new AppError("This application changed. Reload to see its current status.", 409);
      if (target === "accepted") db.prepare("INSERT INTO memberships (project_id,user_id,role) VALUES (?,?,'member') ON CONFLICT(project_id,user_id) DO NOTHING").run(application.project_id, user);
      db.prepare("UPDATE applications SET status=? WHERE id=?").run(target, id);
      return { id };
    }
    throw new AppError("Unknown action.");
  }).immediate();
}

export const manualTask = routeTask;
