import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { consumeAiBudget, readBoundedBody } from "@/lib/ai-request";
import { generateTaskBatch } from "@/lib/task-batch";
import { AppError, publishTaskBatch } from "@/lib/service";
import type { Project, Task } from "@/lib/types";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin && origin !== process.env.BETTER_AUTH_URL) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Please sign in." }, { status: 401 });
  let projectId: string;
  try { projectId = z.object({ project: z.string().min(1).max(200) }).parse(JSON.parse((await readBoundedBody(request, 2048)).toString())).project; }
  catch { return Response.json({ error: "Provide a project ID." }, { status: 400 }); }
  if (!db.prepare("SELECT 1 FROM memberships WHERE project_id=? AND user_id=? AND role='lead'").get(projectId, session.user.id)) return Response.json({ error: "Only this project’s leads can generate tasks." }, { status: 403 });
  const project = db.prepare("SELECT * FROM projects WHERE id=?").get(projectId) as Project;
  if (project.status !== "published") return Response.json({ error: "Publish the project first; closed projects cannot receive tasks." }, { status: 409 });
  if (!process.env.OPENROUTER_API_KEY) return Response.json({ error: "Automatic task publication requires an OpenRouter API key. Manual task creation still works." }, { status: 503 });
  if (!consumeAiBudget(session.user.id)) return Response.json({ error: "Please wait a minute before requesting more AI assistance." }, { status: 429 });
  try {
    const existing = (db.prepare("SELECT content FROM tasks WHERE project_id=? ORDER BY rowid").all(projectId) as { content: string }[]).map(t => ({ content: JSON.parse(t.content) })) as Pick<Task, "content">[];
    const tasks = await generateTaskBatch(project, existing, { apiKey: process.env.OPENROUTER_API_KEY });
    const ids = publishTaskBatch(session.user.id, project, tasks);
    return Response.json({ ids, count: ids.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof AppError ? error.message : "AI could not create a valid task batch. No tasks were added. Please try again or create tasks manually." }, { status: error instanceof AppError ? error.status : 502 });
  }
}
