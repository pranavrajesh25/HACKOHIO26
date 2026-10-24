import { z } from "zod";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const interestKeywordSchema = z.string().trim().min(1).max(60).refine(value => !/[\r\n,;\u0000-\u001f]/.test(value), "Use one short keyword or phrase.");

export function uniqueInterests(values: string[]) {
  const seen = new Set<string>();
  return values.map(value => value.trim()).filter(value => {
    const key = value.normalize("NFKC").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
export const resumeSuggestionsSchema = z.object({
  interests: z.array(interestKeywordSchema).min(5).max(10).transform(uniqueInterests).refine(values => values.length >= 5, "Not enough distinct interests were found."),
});

export function mergeInterests(existing: string, suggestions: string[]) {
  const merged = uniqueInterests([...existing.split(/[,;\n]+/), ...suggestions]).join(", ");
  if (merged.length > 1000) throw new Error("Combined interests exceed 1000 characters. Shorten your interests or remove some suggestions first.");
  return merged;
}
