import { z } from "zod";

const text = (min = 1, max = 8000) => z.string().trim().min(min).max(max);
export const projectFieldsSchema = z.object({ title: text(4, 120), problem: text(15), goal: text(15), description: text(30), topic: text(), disciplines: text(), materials: text(10), team: text(), roles: text(), duration: text(), commitment: text() });
export const projectSchema = projectFieldsSchema.extend({ accepting: z.boolean() });
export type ProjectFields = z.infer<typeof projectFieldsSchema>;
export const projectSuggestionSchema = z.object({ fields: projectFieldsSchema, suggestedFields: z.array(z.enum(["title", "problem", "goal", "description", "topic", "disciplines", "materials", "team", "roles", "duration", "commitment"])) });
