import { z } from "zod";

export const recommendationSchema = z.object({
  recommendations: z.array(z.object({ taskId: z.string().min(1).max(200), reason: z.string().trim().min(1).max(240) }).strict()).max(3),
}).strict().refine(value => new Set(value.recommendations.map(item => item.taskId)).size === value.recommendations.length, "Duplicate task IDs.");

export type Recommendation = z.infer<typeof recommendationSchema>["recommendations"][number];
export type RecommendationResult = { recommendations: Recommendation[]; source: "ai" | "keyword"; message?: string };
