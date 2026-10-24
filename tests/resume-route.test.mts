import { before, after, test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_PATH = ":memory:";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.OPENROUTER_API_KEY = "test-key";
const { db } = await import("../lib/db");
const { auth } = await import("../lib/auth");
const { POST } = await import("../app/api/resume-interests/route");
const { consumeAiBudget, readBoundedBody, BodyTooLarge } = await import("../lib/ai-request");
const { MAX_RESUME_BYTES } = await import("../lib/resume-schema");
const originalFetch = globalThis.fetch;
let cookie = "", user = "", providerCalls = 0;
const pdf = Buffer.from("%PDF-1.4\nFictional résumé\n%%EOF");
const interests = ["Python", "Data analysis", "Robotics", "Design", "Sustainability"];

before(async () => {
  const signup = await auth.api.signUpEmail({ body: { name: "Résumé Tester", email: "resume@example.test", password: "resume-test-password" }, asResponse: true });
  assert.equal(signup.status, 200);
  cookie = signup.headers.get("set-cookie")!.split(";")[0];
  user = (await signup.json()).user.id;
  db.prepare("UPDATE profiles SET interests='Music' WHERE id=?").run(user);
  globalThis.fetch = async () => { providerCalls++; return Response.json({ choices: [{ message: { content: JSON.stringify({ interests }) } }] }); };
});
after(() => { globalThis.fetch = originalFetch; });
function request(body: Buffer = pdf, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/resume-interests", { method: "POST", headers: { cookie, "content-type": "application/pdf", ...headers }, body: new Uint8Array(body) });
}
function reset() { db.prepare("DELETE FROM generation_limits WHERE user_id=?").run(user); }

test("résumé endpoint requires authentication and same-origin requests", async () => {
  assert.equal((await POST(request(pdf, { cookie: "" }))).status, 401);
  assert.equal((await POST(request(pdf, { origin: "https://untrusted.example" }))).status, 403);
  assert.equal(providerCalls, 0);
});
test("résumé endpoint enforces MIME, byte size, and PDF signature", async () => {
  reset();
  assert.equal((await POST(request(pdf, { "content-type": "image/png" }))).status, 400);
  assert.equal((await POST(request(Buffer.from("not a pdf")))).status, 400);
  assert.equal((await POST(request(Buffer.alloc(MAX_RESUME_BYTES + 1)))).status, 413);
  assert.equal(providerCalls, 0);
});
test("successful analysis returns only suggestions and does not persist résumé or profile changes", async () => {
  reset();
  const response = await POST(request());
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { interests }); assert.equal(providerCalls, 1);
  assert.equal((db.prepare("SELECT interests FROM profiles WHERE id=?").get(user) as { interests: string }).interests, "Music");
});
test("all AI workflows share the persistent rate limit and reset after a minute", async () => {
  reset();
  const now = Date.now();
  for (let i = 0; i < 5; i++) assert.equal(consumeAiBudget(user, now), true);
  assert.equal((await POST(request())).status, 429);
  assert.equal(providerCalls, 1);
  assert.equal(consumeAiBudget(user, now + 60000), true);
});
test("provider failures and missing keys preserve interests and do not expose provider details", async () => {
  reset();
  globalThis.fetch = async () => Response.json({ error: { message: "Private document text" } }, { status: 502 });
  const response = await POST(request());
  assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /Private document text/);
  process.env.OPENROUTER_API_KEY = "";
  assert.equal((await POST(request())).status, 503);
  assert.equal((db.prepare("SELECT interests FROM profiles WHERE id=?").get(user) as { interests: string }).interests, "Music");
});
test("streamed size limits cannot be bypassed by omitting Content-Length", async () => {
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(5)); controller.enqueue(new Uint8Array(6)); controller.close(); } });
  const input = new Request("http://localhost", { method: "POST", body: stream, duplex: "half" } as RequestInit);
  await assert.rejects(() => readBoundedBody(input, 10), BodyTooLarge);
});
