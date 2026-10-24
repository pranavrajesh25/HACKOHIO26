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

export type TaskContent = typeof routeTask;
export type Answers = { route: string; explanation: string; missing: string };
