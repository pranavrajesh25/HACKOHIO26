import { test } from "node:test";
import assert from "node:assert/strict";
import { generateStarterTask } from "../lib/task-generation";
import { emptyTask, routeTask } from "../lib/content";
import { energyTask } from "./fixtures/energy-task";

const input = { project: "energy", brief: "Investigate unusual energy usage in a fictional campus building.", materials: "Fictional energy dataset preview; no actual dataset is supplied.", level: "Beginner", time: "15 minutes", reviewer: "lead", format: "written-response" as const };
const project = { title: "Campus Energy Detective", problem: "Investigate unusual energy patterns.", goal: "Learn to examine energy evidence." };
test("new custom task fields are empty written-response fields; seeded robot is unchanged", () => {
  for (const [field, value] of Object.entries(emptyTask())) assert.equal(value, field === "format" ? "written-response" : "");
  assert.equal(routeTask.format, "route-selection");
});
test("offline demo generation produces a complete publishable energy task with labeled synthetic data", async () => {
  const result = await generateStarterTask(input, project);
  assert.equal(result.simulated, true);
  assert.match(result.content.title, /energy/i);
  assert.match(result.content.materials, /Simulated fictional demo data/);
  assert.match(result.content.materials, /79/);
  assert.match(result.content.materials, /kW/);
  assert.equal(result.content.missingInformation, "");
  assert.equal(result.content.materialsOrigin, "simulated-synthetic");
  assert.equal(result.content.format, "written-response");
  assert.doesNotMatch(result.content.instructions, /route|robot/i);
});
test("live generation sends project context, permits synthesis, and preserves generated material with provenance", async () => {
  const result = await generateStarterTask(input, project, { apiKey: "test-key", fetchImpl: async (url, options) => {
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    assert.equal((options?.headers as Record<string, string>).Authorization, "Bearer test-key");
    assert.equal((options?.headers as Record<string, string>)["X-Title"], "Project Test Drive");
    const body = JSON.parse(String(options?.body));
    assert.match(body.messages[0].content, /MAY synthesize/);
    assert.equal(body.model, "anthropic/claude-haiku-5.5");
    const supplied = JSON.parse(body.messages[1].content);
    assert.deepEqual(supplied.projectContext, project);
    assert.equal(supplied.format, "written-response");
    return Response.json({ choices: [{ message: { content: `\`\`\`json\n${JSON.stringify(energyTask)}\n\`\`\`` } }] });
  } });
  assert.equal(result.simulated, false);
  assert.deepEqual(result.content, energyTask);
  assert.notEqual(result.content.materials, input.materials);
});
test("opting out of synthesis preserves supplied material and blocks missing-material publication", async () => {
  const result = await generateStarterTask({ ...input, allowSynthetic: false }, project, { apiKey: "test", fetchImpl: async () => Response.json({ choices: [{ message: { content: JSON.stringify(energyTask) } }] }) });
  assert.equal(result.content.materials, input.materials);
  assert.equal(result.content.materialsOrigin, "provided");
  const missing = await generateStarterTask({ ...input, materials: "", allowSynthetic: false }, project);
  assert.notEqual(missing.content.missingInformation, "");
});
test("legacy format requests still generate text tasks, and unrelated or unsupported output fails", async () => {
  const legacy = await generateStarterTask({ ...input, format: "route-selection" }, project);
  assert.equal(legacy.content.format, "written-response");
  for (const draft of [routeTask, { ...energyTask, instructions: routeTask.instructions }]) {
    await assert.rejects(() => generateStarterTask(input, project, { apiKey: "test", fetchImpl: async () => Response.json({ choices: [{ message: { content: JSON.stringify(draft) } }] }) }));
  }
});
test("provider errors, timeouts, invalid JSON and unsupported formats fail without fake live generation", async () => {
  for (const fetchImpl of [
    async () => new Response("Provider unavailable", { status: 503 }),
    async () => { throw new DOMException("Timed out", "TimeoutError"); },
    async () => Response.json({ choices: [{ message: { content: "Not JSON" } }] }),
    async () => Response.json({ choices: [] }),
  ]) await assert.rejects(() => generateStarterTask(input, project, { apiKey: "test", fetchImpl }));
});
