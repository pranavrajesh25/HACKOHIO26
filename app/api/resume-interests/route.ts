import { auth } from "@/lib/auth";
import { BodyTooLarge, consumeAiBudget, readBoundedBody } from "@/lib/ai-request";
import { analyzeResume, validateResume } from "@/lib/resume-analysis";
import { MAX_RESUME_BYTES } from "@/lib/resume-schema";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin && origin !== process.env.BETTER_AUTH_URL) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Please sign in to import interests." }, { status: 401 });
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/pdf") return Response.json({ error: "Choose a PDF résumé." }, { status: 400 });
  // Apply the budget before reading the body, including invalid/oversized attempts.
  if (!consumeAiBudget(session.user.id)) return Response.json({ error: "Please wait a minute before requesting more AI assistance." }, { status: 429 });
  let bytes: Buffer;
  try { bytes = await readBoundedBody(request, MAX_RESUME_BYTES); }
  catch (error) { return Response.json({ error: error instanceof BodyTooLarge ? "Choose a PDF no larger than 5 MB." : "Could not read the PDF. Please retry." }, { status: error instanceof BodyTooLarge ? 413 : 400 }); }
  try { validateResume(bytes); }
  catch { return Response.json({ error: "Choose a valid PDF résumé no larger than 5 MB." }, { status: 400 }); }
  if (!process.env.OPENROUTER_API_KEY) return Response.json({ error: "Résumé analysis requires an OpenRouter API key. You can still edit interests manually." }, { status: 503 });
  try {
    const result = await analyzeResume(bytes, { apiKey: process.env.OPENROUTER_API_KEY });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Never log provider responses, document bytes, or extracted personal data.
    return Response.json({ error: "Could not analyze this résumé. It may be unreadable, encrypted, too long, or contain too little evidence. Retry with a clear PDF or edit interests manually. Your profile is unchanged." }, { status: 502 });
  }
}
