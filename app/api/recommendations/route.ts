import { auth } from "@/lib/auth";
import { consumeAiBudget } from "@/lib/ai-request";
import { keywordRecommendations, rankTasks, recommendationContext, shortlist } from "@/lib/task-recommendations";
import type { RecommendationResult } from "@/lib/recommendation-schema";

const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin && origin !== process.env.BETTER_AUTH_URL) return json({ error: "Invalid origin." }, 403);
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return json({ error: "Please sign in to find recommended tasks." }, 401);
  const context = recommendationContext(session.user.id);
  if (!context.interests) return json({ error: "Save some profile interests first." }, 400);
  if (!consumeAiBudget(session.user.id)) return json({ error: "Please wait a minute before requesting more AI assistance." }, 429);
  const candidates = shortlist(context.candidates, context.interests);
  if (!candidates.length) return json({ recommendations: [], source: "keyword", message: "No new tasks are available right now. You can continue saved work or browse projects below." });
  let result: RecommendationResult;
  try {
    if (!process.env.OPENROUTER_API_KEY) throw new Error("AI unavailable.");
    result = { recommendations: await rankTasks(candidates, context.interests, { apiKey: process.env.OPENROUTER_API_KEY }), source: "ai" };
  } catch {
    result = { recommendations: keywordRecommendations(candidates, context.interests), source: "keyword", message: "AI recommendations are unavailable. Showing simple keyword interest matches instead." };
  }
  // Recheck availability and public context after inference; never return stale matches.
  const current = recommendationContext(session.user.id);
  if (current.interests !== context.interests) return json({ error: "Your interests changed. Please request fresh recommendations." }, 409);
  result.recommendations = result.recommendations.filter(item => current.candidates.some(candidate => candidate.taskId === item.taskId && JSON.stringify(candidate) === JSON.stringify(candidates.find(previous => previous.taskId === item.taskId))));
  return json(result);
}
