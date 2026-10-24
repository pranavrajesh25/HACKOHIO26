import type { TaskContent } from "../../lib/content";

export const energyTask: TaskContent = {
  title: "Investigate an unusual building-energy pattern",
  learningGoal: "Learn to distinguish an unusual energy pattern from an unsupported explanation.",
  prerequisites: "Beginner; no coding experience needed.",
  duration: "15–20 minutes",
  instructions: "Compare the fictional readings below, flag one unusual pattern, and cite the relevant numbers and units. Explain two possible causes without claiming either is proven, and identify additional evidence that would help investigate them. Write your analysis as one textual response.",
  materials: "AI-generated fictional demo data\n\nCedar Hall, one fictional weekday. Average power in kW, sampled every four hours.\nTime | Power (kW) | Occupancy\n00:00 | 18 | Closed\n04:00 | 19 | Closed\n08:00 | 43 | Open\n12:00 | 46 | Open\n16:00 | 44 | Open\n20:00 | 79 | Closed\nEquipment schedules, weather, historical baselines, and meter accuracy are unknown. Closed does not mean all equipment is off. These are not real campus measurements.",
  deliverable: "One flagged energy pattern with an evidence-based explanation and questions for the project lead.",
  criteria: "Use only supplied energy readings, distinguish observations from hypotheses, and identify missing evidence.",
  hints: "Consider time of day and the building’s expected occupancy, if the lead supplies that context.",
  missingInformation: "",
  format: "written-response",
  materialsOrigin: "ai-synthetic",
};
