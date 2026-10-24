import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeResume, validateResume } from "../lib/resume-analysis";
import { MAX_RESUME_BYTES, mergeInterests, resumeSuggestionsSchema } from "../lib/resume-schema";

const pdf = Buffer.from("%PDF-1.4\nFictional résumé fixture\n%%EOF");
const interests = ["Python", "Data analysis", "Robotics", "Design", "Sustainability"];

test("résumé analysis uses native PDF input, hardcoded Haiku, and app attribution", async () => {
  const result = await analyzeResume(pdf, { apiKey: "test-key", fetchImpl: async (url, options) => {
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    const headers = options?.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer test-key"); assert.equal(headers["X-Title"], "Project Test Drive");
    const body = JSON.parse(String(options?.body));
    assert.equal(body.model, "anthropic/claude-haiku-5.5");
    assert.deepEqual(body.plugins, [{ id: "file-parser", pdf: { engine: "native" } }]);
    assert.match(body.messages[0].content, /untrusted data/); assert.match(body.messages[0].content, /Do not invent/);
    assert.match(body.messages[0].content, /sensitive personal traits/);
    const file = body.messages[1].content[1].file;
    assert.equal(file.filename, "resume.pdf");
    assert.deepEqual(Buffer.from(file.file_data.split(",")[1], "base64"), pdf);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ interests }) } }] });
  } });
  assert.deepEqual(result, { interests });
});

test("PDF checks reject empty, disguised, and oversized documents before provider access", async () => {
  validateResume(pdf);
  for (const input of [Buffer.alloc(0), Buffer.from("not a PDF"), Buffer.alloc(MAX_RESUME_BYTES + 1)]) {
    assert.throws(() => validateResume(input));
    await assert.rejects(() => analyzeResume(input, { apiKey: "test", fetchImpl: async () => { assert.fail("Invalid documents must not reach OpenRouter"); } }));
  }
});

test("interest suggestions validate counts, lengths, distinctness, and single keywords", () => {
  for (const values of [[], ["Python"], Array(11).fill("Python"), ["Python", "python", "PYTHON", "Design", "AI"], [...interests.slice(0, 4), "x".repeat(61)], [...interests.slice(0, 4), "bad,keyword"]]) assert.equal(resumeSuggestionsSchema.safeParse({ interests: values }).success, false);
  assert.deepEqual(resumeSuggestionsSchema.parse({ interests: [...interests, "python"] }).interests, interests);
});

test("merging preserves current interests, deduplicates case-insensitively, and never truncates", () => {
  assert.equal(mergeInterests("Python; Music\nDesign", ["python", "Robotics", "Design"]), "Python, Music, Design, Robotics");
  assert.equal(mergeInterests("", ["Robotics", "robotics"]), "Robotics");
  assert.throws(() => mergeInterests("x".repeat(1000), ["Robotics"]), /1000 characters/);
});

test("unreadable PDFs, malformed responses, provider failures, and timeouts fail without fabricated interests", async () => {
  for (const content of ["not JSON", JSON.stringify({ interests: [] }), JSON.stringify({ interests: ["Python"] })]) await assert.rejects(() => analyzeResume(pdf, { apiKey: "test", fetchImpl: async () => Response.json({ choices: [{ message: { content } }] }) }));
  for (const fetchImpl of [async () => new Response("provider error", { status: 502 }), async () => Response.json({ error: { message: "private provider details" } }), async () => { throw new DOMException("Timed out", "TimeoutError"); }]) await assert.rejects(() => analyzeResume(pdf, { apiKey: "test", fetchImpl }));
});
