// Model IDs and application identity are code configuration, not secrets.
export const TEXT_MODEL = "anthropic/claude-haiku-5.5";
export const TRANSCRIPTION_MODEL = "openai/whisper-large-v3-turbo";
export const OPENROUTER_APP_NAME = "Project Test Drive";
export type OpenRouterOptions = { apiKey: string; fetchImpl?: typeof fetch };

export async function openRouterRequest(path: "chat/completions" | "audio/transcriptions", body: unknown, options: OpenRouterOptions, timeout = 45000) {
  const response = await (options.fetchImpl || fetch)(`https://openrouter.ai/api/v1/${path}`, {
    method: "POST", signal: AbortSignal.timeout(timeout),
    headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json", "X-Title": OPENROUTER_APP_NAME },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("AI provider unavailable.");
  const output = await response.json();
  if (output.error) throw new Error("AI provider returned an error.");
  return output;
}
