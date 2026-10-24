import { energyTask } from "./energy-task";

export const microtasks = [
  { title: "Find the highest power reading", instructions: "Read the fictional table. Which time has the highest power reading? Answer with just the time.", deliverable: "One time label.", criteria: "The time matches the largest supplied power reading." },
  { title: "Find the lowest power reading", instructions: "Read the fictional table. Which time has the lowest power reading? Answer with just the time.", deliverable: "One time label.", criteria: "The time matches the smallest supplied power reading." },
  { title: "Identify the measurement unit", instructions: "Look at the fictional table heading. What unit is used for the power readings? Answer with only the unit.", deliverable: "One unit abbreviation.", criteria: "The unit matches the heading in the supplied table." },
].map(fields => ({ ...energyTask, ...fields, learningGoal: "Practice reading a small energy table.", duration: "2 minutes", hints: "Answer only the question asked." }));
