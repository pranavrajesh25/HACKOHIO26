import { auth } from "./auth";
import { db } from "./db";
import { routeTask } from "./content";
import { randomUUID } from "node:crypto";

export const demoPassword = process.env.NODE_ENV === "production" && process.env.ENABLE_DEMO_AUTH !== "true" ? randomUUID() : "TestDrive-Demo-2026!";
let pending: Promise<void> | undefined;
export function ensureSeed() {
  return pending ??= seed().catch(error => { pending = undefined; throw error; });
}
async function seed() {
  const users: Record<string, string> = {};
  for (const [key, name] of [["lead", "Alex Morgan"], ["student", "Jamie Chen"]]) {
    const email = `${key}@testdrive.demo`;
    let user = db.prepare("SELECT id FROM user WHERE email = ?").get(email) as { id: string } | undefined;
    if (!user) {
      try {
        const result = await auth.api.signUpEmail({ body: { name, email, password: demoPassword } });
        user = result.user;
      } catch (error) {
        user = db.prepare("SELECT id FROM user WHERE email = ?").get(email) as { id: string } | undefined;
        if (!user) throw error;
      }
    }
    users[key] = user.id;
    db.prepare("INSERT OR IGNORE INTO profiles (id,display_name,interests) VALUES (?,?,?)").run(user.id, name, key === "student" ? "Robotics, design, learning by doing" : "Helping beginners build confidence");
  }
  db.transaction(() => {
    const projects = [
      ["robot-route-rescue", "Robot Route Rescue", "Help a campus delivery robot find a clear path.", "Make campus deliveries more accessible, one thoughtful route at a time.", "We’re exploring how small delivery robots could navigate a fictional university campus. Right now, we’re comparing routes around everyday obstacles. Your fresh perspective can help us spot what we’ve missed.", "Robotics", "Engineering, Design, Computer science", "Campus route map v1 — bundled with the route workspace. All locations and measurements are fictional.", "Alex Morgan · Project lead (demo)\nSam Rivera · Robotics student (demo)\nTaylor Park · Demo mentor role; no real mentor participation", "Route research\nInteraction design\nRobotics development", "6 weeks", "2–3 hours / week", 0],
      ["campus-energy-detective", "Campus Energy Detective", "Find the story hiding in a building’s energy use.", "Learn to spot unusual energy patterns.", "A fictional campus building has some surprising energy habits. Help a demo team investigate what the numbers might mean. Interactive tasks are coming later.", "Climate & Data", "Data science, Sustainability", "Fictional energy dataset preview; no interactive dataset is available yet.", "Morgan Lee · Project lead (demo)", "Data exploration\nData visualization", "4 weeks", "2 hours / week", 1],
      ["ai-answer-check", "AI Answer Check", "Help separate a confident answer from a supported one.", "Make AI answers easier to verify.", "Practice checking claims against source material with a fictional student research team. Interactive tasks are coming later.", "AI & Society", "Research, Writing, Computer science", "Source-checking task preview; no interactive answer set is available yet.", "Casey Ellis · Project lead (demo)", "Source research\nContent design", "4 weeks", "1–2 hours / week", 1],
    ];
    for (const p of projects) {
      db.prepare("INSERT OR IGNORE INTO projects (id,creator,title,problem,goal,description,topic,disciplines,materials,team,roles,duration,commitment,preview,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'published')").run(p[0], users.lead, ...p.slice(1));
      db.prepare("INSERT OR IGNORE INTO memberships VALUES (?,?,'lead')").run(p[0], users.lead);
    }
    const content = JSON.stringify(routeTask);
    db.prepare("INSERT OR IGNORE INTO tasks (id,project_id,reviewer,status,content,approved) VALUES ('robot-first-route','robot-route-rescue',?,'published',?,1)").run(users.lead, content);
    db.prepare("INSERT OR IGNORE INTO task_versions (task_id,version,content,reviewer) VALUES ('robot-first-route',1,?,?)").run(content, users.lead);
  })();
}
