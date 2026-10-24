import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateStarterTask, generationInputSchema } from "@/lib/task-generation";
import { consumeAiBudget } from "@/lib/ai-request";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin && origin !== process.env.BETTER_AUTH_URL) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Please sign in." }, { status: 401 });
  const parsed = generationInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Provide a project brief, beginner level, target time, and responsible reviewer. Materials may be omitted when synthetic demo data is enabled." }, { status: 400 });
  const input = parsed.data;
  if (!db.prepare("SELECT 1 FROM memberships WHERE project_id=? AND user_id=? AND role='lead'").get(input.project, session.user.id)) return Response.json({ error: "You do not manage this project." }, { status: 403 });
  if (!db.prepare("SELECT 1 FROM memberships WHERE project_id=? AND user_id=? AND role IN ('lead','reviewer')").get(input.project, input.reviewer)) return Response.json({ error: "Choose an assigned project reviewer." }, { status: 400 });
  const project = db.prepare("SELECT title,problem,goal FROM projects WHERE id=?").get(input.project) as { title: string; problem: string; goal: string };
  const allowed = !process.env.OPENROUTER_API_KEY || consumeAiBudget(session.user.id);
  if (!allowed) return Response.json({ error: "You’ve requested several drafts. Please wait a minute, or continue with the manual editor." }, { status: 429 });
  try {
    return Response.json(await generateStarterTask(input, project, { apiKey: process.env.OPENROUTER_API_KEY }));
  } catch (error) {
    console.error("Task generation failed", error instanceof Error ? error.message : "Unknown provider error");
    return Response.json({ error: "AI assistance is unavailable or returned an invalid draft. Your editor is unchanged. Please try again or continue manually." }, { status: 502 });
  }
}
