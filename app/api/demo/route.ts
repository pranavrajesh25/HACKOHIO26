import { auth } from "@/lib/auth";
import { demoPassword, ensureSeed } from "@/lib/seed";
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEMO_AUTH !== "true") return Response.json({ error: "Demo sign-in is disabled. Create an account instead." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin && origin !== process.env.BETTER_AUTH_URL) return Response.json({ error: "Invalid origin." }, { status: 403 });
  await ensureSeed();
  const body = await request.json();
  if (!["student", "lead"].includes(body.role)) return Response.json({ error: "Choose a demo role." }, { status: 400 });
  return auth.api.signInEmail({ body: { email: `${body.role}@testdrive.demo`, password: demoPassword }, headers: request.headers, asResponse: true });
}
