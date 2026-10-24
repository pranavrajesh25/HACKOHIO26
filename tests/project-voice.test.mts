import { test } from "node:test";
import assert from "node:assert/strict";
import { draftProject, MAX_AUDIO_BYTES, transcribeProject, validateVoiceAudio } from "../lib/project-voice";

function wav(seconds = 1) {
  const bytes = Buffer.alloc(44 + seconds * 32000);
  bytes.write("RIFF"); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22); bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write("data", 36); bytes.writeUInt32LE(bytes.length - 44, 40);
  return bytes;
}
const fields = { title: "Campus Garden", problem: "Students need more practice with gardening.", goal: "Help beginners investigate a small garden pilot.", description: "A student-led project exploring a small garden pilot and beginner contributions.", topic: "Environment", disciplines: "Suggested: Design, Biology", materials: "Suggested: Prepare a fictional garden scenario.", team: "Team details to be confirmed by the lead.", roles: "Suggested: Research assistant", duration: "Suggested: 4 weeks", commitment: "Suggested: 1 hour weekly" };

test("voice input enforces real PCM duration and canonical WAV structure", () => {
  validateVoiceAudio(wav(30)); validateVoiceAudio(wav(60));
  assert.equal(wav(60).length, MAX_AUDIO_BYTES);
  for (const bytes of [Buffer.alloc(0), Buffer.alloc(44), wav(61), Buffer.from("not audio"), (() => { const b = wav(); b.writeUInt32LE(1, 40); return b; })()]) assert.throws(() => validateVoiceAudio(bytes));
});
test("transcription uses the requested OpenRouter model and base64 WAV API", async () => {
  const result = await transcribeProject(wav(), { apiKey: "test", fetchImpl: async (url, options) => {
    assert.equal(url, "https://openrouter.ai/api/v1/audio/transcriptions");
    assert.equal((options?.headers as Record<string, string>)["X-Title"], "Project Test Drive");
    const body = JSON.parse(String(options?.body));
    assert.equal(body.model, "openai/whisper-large-v3-turbo"); assert.equal(body.input_audio.format, "wav");
    assert.deepEqual(Buffer.from(body.input_audio.data, "base64"), wav());
    return Response.json({ text: " We want to start a campus garden project. " });
  } });
  assert.equal(result, "We want to start a campus garden project.");
});
test("project generation validates all form fields and marks synthesized suggestions", async () => {
  const result = await draftProject("Start a campus garden project for students.", { apiKey: "test", fetchImpl: async (url, options) => {
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    assert.equal((options?.headers as Record<string, string>)["X-Title"], "Project Test Drive");
    const body = JSON.parse(String(options?.body)); assert.equal(body.model, "anthropic/claude-haiku-5.5"); assert.match(body.messages[0].content, /Never invent real people/);
    assert.equal(JSON.parse(body.messages[1].content).transcript, "Start a campus garden project for students.");
    return Response.json({ choices: [{ message: { content: JSON.stringify({ fields, suggestedFields: ["duration", "materials"] }) } }] });
  } });
  assert.deepEqual(result.fields, fields); assert.deepEqual(result.suggestedFields, ["duration", "materials"]);
  assert.equal("accepting" in result.fields, false);
});
test("provider failures, empty speech, and invalid project drafts fail safely", async () => {
  await assert.rejects(() => transcribeProject(wav(), { apiKey: "test", fetchImpl: async () => Response.json({ text: "" }) }));
  await assert.rejects(() => transcribeProject(wav(), { apiKey: "test", fetchImpl: async () => new Response("failed", { status: 502 }) }));
  for (const content of ["invalid json", JSON.stringify({ fields: { title: "Incomplete" }, suggestedFields: [] })]) await assert.rejects(() => draftProject("Campus garden project", { apiKey: "test", fetchImpl: async () => Response.json({ choices: [{ message: { content } }] }) }));
});
