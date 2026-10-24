export const routeTask = {
  title: "Find a better way across campus",
  learningGoal: "Compare route trade-offs and communicate uncertainty, like a robotics teammate.",
  prerequisites: "No coding needed. Just curiosity and a little critical thinking.",
  duration: "15–20 minutes",
  instructions: "A small delivery robot needs to travel from the Campus Hub to the Library. It cannot use stairs or enter construction areas. Compare the three predefined routes. Recommend one, explain the trade-offs, and tell us what you would check before a real-world test.",
  materials: "Campus route map v1 (included). Route A: 240 m, stairs at the courtyard. Route B: 390 m, level path via the garden; path width and pedestrian traffic unverified. Route C: 310 m, construction blocks the east path. This is a fictional campus scenario.",
  deliverable: "One selected route, a reasoned explanation, and at least one missing piece of information.",
  criteria: "Identify obstacles; compare candidate routes; explain your choice using the supplied map; acknowledge at least one uncertainty. There is no AI score.",
  hints: "A shorter route is not always a usable route. What else would you need to know about a level path?",
  missingInformation: "",
  format: "route-selection" as const,
};

export type TaskFormat = "route-selection" | "written-response" | "planning-only";
export type MaterialsOrigin = "provided" | "ai-synthetic" | "simulated-synthetic";
export type TaskContent = Omit<typeof routeTask, "format"> & { format: TaskFormat; materialsOrigin?: MaterialsOrigin };
export function emptyTask(format: TaskFormat = "written-response"): TaskContent {
  return { title: "", learningGoal: "", prerequisites: "", duration: "", instructions: "", materials: "", deliverable: "", criteria: "", hints: "", missingInformation: "", format };
}
export type RouteAnswers = { route: string; explanation: string; missing: string };
export type TextAnswers = { response: string };
export type Answers = RouteAnswers | TextAnswers;

export function materialsLabel(origin?: MaterialsOrigin) {
  return origin === "ai-synthetic" ? "AI-generated fictional demo data" : origin === "simulated-synthetic" ? "Simulated fictional demo data (preset, not live AI)" : "";
}
export function labelSyntheticMaterials(content: TaskContent): TaskContent {
  const label = materialsLabel(content.materialsOrigin);
  return label && !content.materials.startsWith(label) ? { ...content, materials: `${label}\n\n${content.materials}` } : content;
}
