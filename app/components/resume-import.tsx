"use client";

import { useEffect, useRef, useState } from "react";
import { interestKeywordSchema, MAX_RESUME_BYTES, resumeSuggestionsSchema } from "@/lib/resume-schema";

export default function ResumeImport({ disabled, onApply }: { disabled: boolean; onApply: (values: string[]) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [working, setWorking] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const request = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function analyze() {
    if (!file || !consent) return;
    const controller = new AbortController(); request.current = controller;
    setWorking(true); setError(""); setSuggestions([]); setStatus("");
    try {
      if (file.size > MAX_RESUME_BYTES) throw new Error("Choose a PDF no larger than 5 MB.");
      const response = await fetch("/api/resume-interests", { method: "POST", headers: { "Content-Type": "application/pdf" }, body: file, signal: controller.signal });
      const output = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(output.error || "Résumé analysis failed. Your profile is unchanged.");
      const result = resumeSuggestionsSchema.safeParse(output);
      if (!result.success) throw new Error("AI returned incomplete interest suggestions. Retry with a clearer résumé or edit interests manually. Your profile is unchanged.");
      setSuggestions(result.data.interests); setStatus("Review, edit, or remove the suggested keywords. Your profile has not changed.");
      // Release the selected document after success; only suggestions remain.
      setFile(null); setConsent(false); if (input.current) input.current.value = "";
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Résumé analysis failed. Edit your interests manually.");
    } finally { if (!controller.signal.aborted) setWorking(false); }
  }
  function apply() {
    try {
      const values = suggestions.map(value => {
        const result = interestKeywordSchema.safeParse(value);
        if (!result.success) throw new Error("Use one short keyword or phrase per suggestion (1–60 characters; no commas or line breaks).");
        return result.data;
      });
      onApply(values); setSuggestions([]); setStatus("Suggestions merged into the Interests field. Review it and select Save profile to keep your changes."); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not merge suggestions. Your interests are unchanged."); }
  }
  return <section className="panel form-panel narrow-form" aria-label="Import interests from résumé">
    <h2>Import interests from your résumé</h2>
    <p>Choose a CV or résumé PDF (up to 5 MB). Haiku suggests interest keywords from your skills, studies, and projects—not verified credentials. You choose what to keep.</p>
    <label className="field"><span>CV or résumé PDF</span><input ref={input} type="file" accept="application/pdf,.pdf" disabled={working || disabled} onChange={event => {
      const selected = event.target.files?.[0] || null;
      setError(""); setStatus(""); setSuggestions([]); setConsent(false);
      if (selected && (selected.size > MAX_RESUME_BYTES || !/\.pdf$/i.test(selected.name))) { setFile(null); event.target.value = ""; setError("Choose a PDF no larger than 5 MB."); return; }
      setFile(selected);
    }} /></label>
    <label className="checkbox-label"><input type="checkbox" checked={consent} disabled={working || disabled} onChange={event => setConsent(event.target.checked)} /> I agree to send this PDF to OpenRouter and its model provider for analysis. This app does not store the PDF; external-provider retention policies apply.</label>
    <button type="button" className="button secondary" disabled={working || disabled || !file || !consent} onClick={analyze}>{working ? "Analyzing résumé…" : "Suggest interests from PDF"}</button>
    {suggestions.length > 0 && <div className="stack">
      <h3>Suggested interest keywords</h3>
      {suggestions.map((value, index) => <div className="response-actions" key={index}>
        <label className="field"><span>Suggested interest {index + 1}</span><input value={value} maxLength={60} disabled={disabled} onChange={event => setSuggestions(current => current.map((item, i) => i === index ? event.target.value : item))} /></label>
        <button type="button" className="button secondary" disabled={disabled} aria-label={`Remove suggested interest ${index + 1}`} onClick={() => setSuggestions(current => current.filter((_, i) => i !== index))}>Remove</button>
      </div>)}
      <button type="button" className="button secondary" disabled={disabled} onClick={apply}>Merge suggestions into interests</button>
    </div>}
    {status && <p role="status">{status}</p>}{error && <p className="inline-error" role="alert">{error}</p>}
  </section>;
}
