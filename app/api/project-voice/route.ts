import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { draftProject, MAX_AUDIO_BYTES, transcribeProject, validateVoiceAudio } from "@/lib/project-voice";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin && origin !== process.env.BETTER_AUTH_URL) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Please sign in." }, { status: 401 });
  if (!process.env.OPENROUTER_API_KEY) return Response.json({ error: "Voice assistance requires an OpenRouter API key. You can still complete the form manually." }, { status: 503 });
  // Share the existing persistent per-user AI budget across task and voice requests.
  const allowed = db.transaction(() => {
    const now = Date.now();
    const limit = db.prepare("SELECT window_start,count FROM generation_limits WHERE user_id=?").get(session.user.id) as { window_start: number; count: number } | undefined;
    if (limit && now - limit.window_start < 60000 && limit.count >= 5) return false;
    db.prepare("INSERT INTO generation_limits VALUES (?,?,1) ON CONFLICT(user_id) DO UPDATE SET window_start=CASE WHEN ? - window_start >= 60000 THEN ? ELSE window_start END,count=CASE WHEN ? - window_start >= 60000 THEN 1 ELSE count+1 END").run(session.user.id, now, now, now, now);
    return true;
  }).immediate();
  if (!allowed) return Response.json({ error: "Please wait a minute before requesting more AI assistance." }, { status: 429 });
  // Bound the actual streamed body, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "No recording or transcript supplied." }, { status: 400 });
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > MAX_AUDIO_BYTES) { await reader.cancel(); return Response.json({ error: "Recording exceeds the 60-second size limit." }, { status: 413 }); }
      chunks.push(value);
    }
  } catch { return Response.json({ error: "Could not read recording." }, { status: 400 }); }
  const body = Buffer.concat(chunks);
  const options = { apiKey: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL, transcriptionModel: process.env.OPENROUTER_TRANSCRIPTION_MODEL };
  let transcript: string;
  if (request.headers.get("content-type")?.startsWith("application/json")) {
    try {
      const input = JSON.parse(body.toString());
      if (typeof input.transcript !== "string" || input.transcript.trim().length < 20 || input.transcript.length > 12000) throw new Error();
      transcript = input.transcript.trim();
    } catch { return Response.json({ error: "Provide a description between 20 and 12000 characters." }, { status: 400 }); }
  } else {
    try { validateVoiceAudio(body); } catch { return Response.json({ error: "Invalid recording. Use a voice clip of up to 60 seconds." }, { status: 400 }); }
    try { transcript = await transcribeProject(body, options); }
    catch { return Response.json({ error: "Transcription failed. Retry the recording or type a description below." }, { status: 502 }); }
  }
  try { return Response.json({ transcript, ...await draftProject(transcript, options) }); }
  catch { return Response.json({ transcript, error: "Project drafting failed. Your form is unchanged. Edit the transcript and retry, or continue manually." }, { status: 502 }); }
}
