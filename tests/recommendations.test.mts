import { before, after, test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_PATH = ":memory:";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.OPENROUTER_API_KEY = "test-key";
const { db } = await import("../lib/db");
const { auth } = await import("../lib/auth");
const { POST } = await import("../app/api/recommendations/route");
const { recommendationContext, keywordRecommendations, rankTasks, shortlist } = await import("../lib/task-recommendations");
const { routeTask } = await import("../lib/content");
const { TEXT_MODEL } = await import("../lib/openrouter");
const originalFetch = globalThis.fetch;
let cookie = "", user = "", reviewer = "", calls = 0;
function request(headers: Record<string, string> = {}) { return new Request("http://localhost:3000/api/recommendations", { method: "POST", headers: { cookie, ...headers } }); }
function reset() { db.prepare("DELETE FROM generation_limits").run(); process.env.OPENROUTER_API_KEY = "test-key"; }
function provider(value: unknown) { globalThis.fetch = async () => { calls++; return Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] }); }; }
before(async () => {
  const response = await auth.api.signUpEmail({ body: { name: "Private Name", email: "private@example.test", password: "recommend-test-password" }, asResponse: true });
  cookie = response.headers.get("set-cookie")!.split(";")[0]; user = (await response.json()).user.id;
  reviewer = (await auth.api.signUpEmail({ body: { name: "Reviewer", email: "reviewer@example.test", password: "recommend-test-password" } })).user.id;
  db.prepare("UPDATE profiles SET interests='Robotics' WHERE id=?").run(user);
  db.prepare("INSERT INTO projects (id,creator,title,problem,goal,description,topic,disciplines,materials,team,roles,duration,commitment,status) VALUES ('p',?,'Robotics','Problem','Goal','Build campus robots','Robotics','Engineering','','Team','Research','1 week','1 hour','published')").run(reviewer);
  for (const [id, status, assigned] of [["available", "published", reviewer], ["draft", "draft", reviewer], ["closed", "closed", reviewer], ["self", "published", user], ["started", "published", reviewer]]) {
    const content = JSON.stringify({ ...routeTask, title: `Robotics ${id}` });
    db.prepare("INSERT INTO tasks (id,project_id,reviewer,status,content) VALUES (?,'p',?,?,?)").run(id, assigned, status, content);
    db.prepare("INSERT INTO task_versions (task_id,version,content,reviewer) VALUES (?,1,?,?)").run(id, content, assigned);
  }
  db.prepare("INSERT INTO submissions (id,task_id,student,task_version,status) VALUES ('s','started',?,1,'draft')").run(user);
});
after(() => { globalThis.fetch = originalFetch; });

test("authentication, origin, and saved interests are required", async () => {
  assert.equal((await POST(request({ cookie: "" }))).status, 401);
  assert.equal((await POST(request({ origin: "https://evil.test" }))).status, 403);
  db.prepare("UPDATE profiles SET interests='' WHERE id=?").run(user);
  assert.equal((await POST(request())).status, 400);
  db.prepare("UPDATE profiles SET interests='Robotics' WHERE id=?").run(user);
  assert.equal(calls, 0);
});
test("candidate eligibility excludes drafts, closed tasks, own reviews, and started work", () => {
  assert.deepEqual(recommendationContext(user).candidates.map(c => c.taskId), ["available"]);
  for (const [status, accepting] of [["closed", 1], ["draft", 1], ["published", 0]]) {
    db.prepare("UPDATE projects SET status=?,accepting=? WHERE id='p'").run(status, accepting);
    assert.equal(recommendationContext(user).candidates.length, 0);
  }
  db.prepare("UPDATE projects SET status='published',accepting=1 WHERE id='p'").run();
});
test("AI uses configured model and public context without identifying fields", async () => {
  reset();
  globalThis.fetch = async (_url, init) => {
    calls++; const body = JSON.parse(String(init?.body));
    assert.equal(body.model, TEXT_MODEL);
    assert.equal(new Headers(init?.headers).get("X-Title"), "Project Test Drive");
    assert.doesNotMatch(String(init?.body), /Private Name|private@example|Reviewer|student_name/);
    const context = JSON.parse(body.messages[1].content);
    assert.equal(context.interests, "Robotics"); assert.equal(context.candidates.length, 1);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ recommendations: [{ taskId: "available", reason: "Explore your interest in robotics." }] }) } }] });
  };
  const response = await POST(request());
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).source, "ai");
});
test("invented IDs, duplicates, oversized reasons, and malformed JSON are rejected", async () => {
  const { candidates, interests } = recommendationContext(user);
  for (const recommendations of [[{ taskId: "invented", reason: "Match" }], [{ taskId: "available", reason: "Match" }, { taskId: "available", reason: "Match" }], [{ taskId: "available", reason: "x".repeat(241) }]]) {
    provider({ recommendations });
    await assert.rejects(() => rankTasks(candidates, interests, { apiKey: "key" }));
  }
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: "not json" } }] });
  await assert.rejects(() => rankTasks(candidates, interests, { apiKey: "key" }));
});
test("missing keys and provider failures return labeled keyword matches", async () => {
  reset(); process.env.OPENROUTER_API_KEY = "";
  const result = await (await POST(request())).json();
  assert.equal(result.source, "keyword"); assert.equal(result.recommendations[0].taskId, "available");
  process.env.OPENROUTER_API_KEY = "test-key";
  globalThis.fetch = async () => { throw new Error("private provider details"); };
  const failed = await (await POST(request())).json();
  assert.equal(failed.source, "keyword"); assert.doesNotMatch(JSON.stringify(failed), /private provider details/);
  assert.equal(recommendationContext(user).interests, "Robotics");
  assert.deepEqual(keywordRecommendations(recommendationContext(user).candidates, "Pottery"), []);
  assert.equal(shortlist(Array.from({ length: 60 }, (_, i) => ({ ...recommendationContext(user).candidates[0], taskId: String(i) })), "Robotics").length, 40);
});
test("post-inference recheck removes unavailable tasks and rejects changed interests", async () => {
  reset();
  globalThis.fetch = async () => {
    db.prepare("UPDATE tasks SET status='closed' WHERE id='available'").run();
    return Response.json({ choices: [{ message: { content: JSON.stringify({ recommendations: [{ taskId: "available", reason: "Robotics" }] }) } }] });
  };
  assert.deepEqual((await (await POST(request())).json()).recommendations, []);
  db.prepare("UPDATE tasks SET status='published' WHERE id='available'").run();
  globalThis.fetch = async () => {
    db.prepare("UPDATE profiles SET interests='Music' WHERE id=?").run(user);
    return Response.json({ choices: [{ message: { content: '{"recommendations":[]}' } }] });
  };
  assert.equal((await POST(request())).status, 409);
  db.prepare("UPDATE profiles SET interests='Robotics' WHERE id=?").run(user);
});
test("shared AI budget limits repeated requests", async () => {
  reset(); provider({ recommendations: [] });
  for (let i = 0; i < 5; i++) assert.equal((await POST(request())).status, 200);
  assert.equal((await POST(request())).status, 429);
});

test("weak AI matches remain empty, invalid AI results fall back, and no candidates skip inference", async () => {
  reset(); provider({ recommendations: [] });
  const weak = await (await POST(request())).json();
  assert.equal(weak.source, "ai"); assert.deepEqual(weak.recommendations, []);
  provider({ recommendations: [{ taskId: "invented", reason: "Unsupported" }] });
  const invalid = await (await POST(request())).json();
  assert.equal(invalid.source, "keyword"); assert.equal(invalid.recommendations[0].taskId, "available");
  const beforeCalls = calls;
  db.prepare("UPDATE projects SET accepting=0 WHERE id='p'").run();
  const empty = await (await POST(request())).json();
  assert.deepEqual(empty.recommendations, []); assert.equal(calls, beforeCalls);
  db.prepare("UPDATE projects SET accepting=1 WHERE id='p'").run();
});
