import { z } from "zod";

const text = (min = 1, max = 8000) => z.string().trim().min(min).max(max);
export const taskSchema = z.object({
  title: text(5, 160), learningGoal: text(10), prerequisites: text(), duration: text(), instructions: text(40), materials: text(10, 16200), deliverable: text(10), criteria: text(15), hints: z.string().max(4000), missingInformation: z.string().max(4000), format: z.enum(["route-selection", "written-response", "planning-only"]), materialsOrigin: z.enum(["provided", "ai-synthetic", "simulated-synthetic"]).optional(),
});
export const generatedTaskSchema = z.object({ simulated: z.boolean(), content: taskSchema });
