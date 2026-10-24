import { test } from "node:test";
import assert from "node:assert/strict";
import { generateTaskBatch, taskBatchSchema } from "../lib/task-batch";
import type { Project } from "../lib/types";
import { microtasks } from "./fixtures/task-batch";

const project = { id: "energy", title: "Campus Energy", problem: "Understand campus energy readings", goal: "Help beginners read energy data", materials: "Source preview", description: "A fictional energy project", topic: "Energy" } as Project;
test("batch uses one attributed Haiku call, complexity-based count and minimal independent tasks", async () => {
  let calls = 0;
  const result = await generateTaskBatch(project, [{ content: microtasks[0] }], { apiKey: "test", fetchImpl: async (_url, options) => {
    calls++;
    assert.equal((options?.headers as Record<string, string>)["X-Title"], "Project Test Drive");
    const body = JSON.parse(String(options?.body));
    assert.equal(body.model, "anthropic/claude-haiku-5.5");
    const prompt = body.messages[0].content;
    assert.match(prompt, /Choose 2 for a focused project/);
    assert.match(prompt, /choose 3 only when its complexity/);
    assert.match(prompt, /exactly one simple question/);
    assert.match(prompt, /few words, a number, or one short sentence/);
    assert.match(prompt, /independently answerable/);
    assert.match(prompt, /automatically published/);
    assert.match(prompt, /Avoid existing tasks/);
    assert.deepEqual(JSON.parse(body.messages[1].content).existingTasks, [{ title: microtasks[0].title, instructions: microtasks[0].instructions }]);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ tasks: microtasks }) } }] });
  } });
  assert.equal(calls, 1); assert.equal(result.length, 3);
  assert.equal(result[0].materialsOrigin, "ai-synthetic");
});
test("batch validates counts, distinctness, completeness and text-only format before publication", () => {
  assert.equal(taskBatchSchema.parse(microtasks.slice(0, 2)).length, 2);
  for (const batch of [[], microtasks.slice(0, 1), [...microtasks, microtasks[0]], [microtasks[0], microtasks[0]], [microtasks[0], { ...microtasks[1], title: microtasks[0].title.toUpperCase() }], [microtasks[0], { ...microtasks[1], instructions: microtasks[0].instructions }], [microtasks[0], { ...microtasks[1], missingInformation: "Need a file" }], [microtasks[0], { ...microtasks[1], format: "route-selection" }]]) assert.equal(taskBatchSchema.safeParse(batch).success, false);
});
test("batch relabels invented material even when provider claims provided provenance", async () => {
  const tasks = microtasks.slice(0, 2).map(t => ({ ...t, materialsOrigin: "provided" }));
  const result = await generateTaskBatch(project, [], { apiKey: "test", fetchImpl: async () => Response.json({ choices: [{ message: { content: JSON.stringify({ tasks }) } }] }) });
  assert.equal(result[0].materialsOrigin, "ai-synthetic");
  assert.match(result[0].materials, /fictional/i);
});
