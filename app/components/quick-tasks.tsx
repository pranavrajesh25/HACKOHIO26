"use client";

import { useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

export default function QuickTasks({ project, disabled, onPublished }: { project: string; disabled: boolean; onPublished: () => Promise<void> }) {
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function generate() {
    if (inFlight.current) return;
    inFlight.current = true; setWorking(true); setError(""); setStatus("");
    try {
      const response = await fetch("/api/generate-tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not generate tasks.");
      setStatus(`${result.count} tasks published. Students can start now; you’ll review their submissions.`);
      try { await onPublished(); }
      catch { setError("Tasks were published, but the list could not refresh. Reload the page to see them; do not generate again to retry the refresh."); }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not generate tasks. Reload to check the project before trying again."); }
    finally { inFlight.current = false; setWorking(false); }
  }
  return <div className="quick-tasks">
    <div className="quick-tasks-header">
      <button type="button" className="button secondary small" disabled={disabled || working} onClick={generate}>{working ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}{working ? "Generating & publishing…" : "Generate & publish 2–3 tasks"}</button>
      <span className="small-print">AI chooses 2 or 3 distinct, simple short-answer tasks and publishes them immediately—no review step. May use labeled fictional demo materials.</span>
    </div>
    {working && <p className="status-note" role="status">Preparing small project-specific tasks…</p>}
    {status && <p className="status-note" role="status">{status}</p>}{error && <p className="inline-error" role="alert">{error}</p>}
  </div>;
}
