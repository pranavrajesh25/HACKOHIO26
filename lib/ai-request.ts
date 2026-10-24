import { db } from "./db";

// One persistent budget shared across all AI-assisted workflows.
export function consumeAiBudget(user: string, now = Date.now()) {
  return db.transaction(() => {
    const limit = db.prepare("SELECT window_start,count FROM generation_limits WHERE user_id=?").get(user) as { window_start: number; count: number } | undefined;
    if (limit && now - limit.window_start < 60000 && limit.count >= 5) return false;
    db.prepare("INSERT INTO generation_limits VALUES (?,?,1) ON CONFLICT(user_id) DO UPDATE SET window_start=CASE WHEN ? - window_start >= 60000 THEN ? ELSE window_start END,count=CASE WHEN ? - window_start >= 60000 THEN 1 ELSE count+1 END").run(user, now, now, now, now);
    return true;
  }).immediate();
}

export class BodyTooLarge extends Error {}
export async function readBoundedBody(request: Request, maxBytes: number) {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > maxBytes) { await reader.cancel(); throw new BodyTooLarge(); }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally { reader.releaseLock(); }
}
