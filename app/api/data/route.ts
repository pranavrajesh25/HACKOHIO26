import { auth } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import { AppError, getData, mutate } from "@/lib/service";

export async function GET(request: Request) {
  await ensureSeed();
  const session = await auth.api.getSession({ headers: request.headers });
  return Response.json(getData(session?.user), { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin && origin !== process.env.BETTER_AUTH_URL) throw new AppError("Cross-origin requests are not allowed.", 403);
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new AppError("Sign in to save your work.", 401);
    const input = await request.json();
    return Response.json(mutate(session.user.id, input));
  } catch (error) {
    if (error instanceof AppError) return Response.json({ error: error.message }, { status: error.status });
    console.error(error);
    return Response.json({ error: "We couldn’t save that change. Your current input is still here; please try again." }, { status: 500 });
  }
}
