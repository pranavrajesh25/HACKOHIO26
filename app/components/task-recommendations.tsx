"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, Loader2, Sparkles } from "lucide-react";
import type { Data } from "@/lib/types";
import type { RecommendationResult } from "@/lib/recommendation-schema";

export default function TaskRecommendations({ data }: { data: Data }) {
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  if (!data.user) return null;
  const user = data.user;
  const active = data.submissions.filter(s => s.student === user.id && ["draft", "revision_requested"].includes(s.status) && data.tasks.some(t => t.id === s.task_id && t.status === "published" && data.projects.some(p => p.id === t.project_id && p.status === "published" && p.accepting)));
  async function recommend() {
    if (controller.current) return;
    const request = new AbortController(); controller.current = request;
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/recommendations", { method: "POST", signal: request.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not find recommendations. Please retry.");
      setResult(body);
    } catch (error) {
      if (!request.signal.aborted) setError(error instanceof Error ? error.message : "Could not find recommendations.");
    } finally { controller.current = null; setBusy(false); }
  }
  const recommendations = result?.recommendations.flatMap(item => {
    const task = data.tasks.find(t => t.id === item.taskId && t.status === "published" && t.reviewer !== user.id);
    const project = task && data.projects.find(p => p.id === task.project_id && p.status === "published" && p.accepting);
    return task && project && !data.submissions.some(s => s.student === user.id && s.task_id === task.id) ? [{ ...item, task, project }] : [];
  }) || [];
  return <section className="explore-section" aria-labelledby="recommendations-heading">
    <div className="panel stack">
      <div className="section-heading"><div><h2 id="recommendations-heading">Recommended for you</h2><p>Small tasks matched to what you want to learn—not a skills assessment.</p></div><Sparkles size={22} /></div>
      {user.interests.trim() ? <><p className="small-print">Selecting Find tasks for me sends your saved interests and public task details to OpenRouter and its model provider. Their retention policies apply. Your name, email, résumé, and answers are not sent.</p><div><button className="button" disabled={busy} onClick={recommend}>{busy ? <><Loader2 className="spin" size={16} /> Finding matches…</> : <>Find tasks for me <ArrowRight size={16} /></>}</button></div></> : <p><Link className="text-link" href="/?view=profile">Add your interests</Link> to discover tasks you might enjoy.</p>}
      {error && <p role="alert">{error}</p>}
      <div aria-live="polite" aria-busy={busy}>
        {result && <><h3>{result.source === "ai" ? "AI recommendations" : "Interest matches"}</h3>{result.message && <p className="small-print">{result.message}</p>}{recommendations.length ? <div className="task-detail-list">{recommendations.map(item => <article className="task-detail" key={item.taskId}><small>{item.project.title}</small><h3>{item.task.content.title}</h3><p>{item.reason}</p><div className="task-meta"><Clock3 size={14} />{item.task.content.duration}</div><Link className="button" href={`/?view=workspace&id=${encodeURIComponent(item.taskId)}`}>Start task <ArrowRight size={16} /></Link></article>)}</div> : <p>No strong matches are available right now. Edit your interests or browse all projects below.</p>}</>}
      </div>
      {active.length > 0 && <div><h3>Continue your work</h3>{active.map(s => <p key={s.id}><Link className="text-link" href={`/?view=workspace&id=${encodeURIComponent(s.task_id)}`}>{s.content.title} · {s.status === "draft" ? "Saved draft" : "Revision requested"} <ArrowRight size={14} /></Link></p>)}</div>}
    </div>
  </section>;
}
