"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Clock3, HeartHandshake, Loader2, Save, Send } from "lucide-react";
import type { Data, Task } from "@/lib/types";
import { TaskMaterials } from "./task-content";

type Props = {
  task: Task; data: Data; busy: boolean; signIn: () => void;
  action: (action: string, id: string, payload?: unknown, message?: string) => Promise<{ id: string } | null>;
  navigate: (view: string, id?: string) => void;
};
export default function TextWorkspace({ task, data, action, busy, signIn, navigate }: Props) {
  const submission = data.submissions.find(s => s.task_id === task.id && s.student === data.user?.id);
  const content = submission?.content || task.content;
  const [response, setResponse] = useState(submission && "response" in submission.draft ? submission.draft.response : "");
  const [dirty, setDirty] = useState(false);
  const editable = !submission || ["draft", "revision_requested"].includes(submission.status);
  const complete = response.trim().length >= 60 && response.trim().split(/\s+/).length >= 12;
  useEffect(() => {
    const listener = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);
  async function save(submit: boolean) {
    const result = await action(submit ? "submit" : "save-draft", task.id, { answers: { response }, expectedRevision: submission?.current_revision || 0, expectedStatus: submission?.status || "draft", taskVersion: submission?.task_version || task.current_version }, submit ? "Your contribution is ready for human feedback." : "Draft saved. You can pick up right here later.");
    if (result) { setDirty(false); if (submit) navigate("contribution", result.id); }
  }
  return <>
    <Link className="back-link" href={`/?view=project&id=${encodeURIComponent(task.project_id)}`}><ArrowLeft size={15} /> Back to project</Link>
    <div className="page-title"><div><div className="eyebrow">YOUR SMALL WRITTEN CONTRIBUTION</div><h1>{content.title}</h1><p>{content.learningGoal}</p></div><span className="badge">{submission ? submission.status.replaceAll("_", " ") : "Draft"}</span></div>
    {submission?.status === "revision_requested" && <div className="notice revision-notice"><HeartHandshake size={20} /><div><strong>Your reviewer has feedback for you</strong><p>{submission.revisions.at(-1)?.review?.feedback}</p><p>Your earlier revision is preserved. Update your response and resubmit when ready.</p></div></div>}
    {!editable && <div className="notice"><CheckCircle2 size={20} /><div><strong>Your submitted response is saved and read-only.</strong><p>You can revise if your reviewer requests changes.</p><Link href={`/?view=contribution&id=${submission!.id}`}>View contribution and feedback →</Link></div></div>}
    <div className="workspace-grid">
      <div className="stack">
        <section className="panel instructions-panel"><div className="section-eyebrow">01 · READ THE TASK</div><h2>Your task</h2><p className="preserve-text">{content.instructions}</p><div className="task-meta"><span><Clock3 size={14} />{content.duration}</span><span>{content.prerequisites}</span></div><h3>Expected deliverable</h3><p>{content.deliverable}</p></section>
        <section className="panel"><TaskMaterials content={content} /></section>
        <section className="panel"><h3>What your reviewer will look for</h3><p className="preserve-text">{content.criteria}</p>{content.hints && <><h3>A helpful hint</h3><p className="preserve-text">{content.hints}</p></>}</section>
      </div>
      <section className="panel response-panel"><div className="section-eyebrow">02 · SHARE YOUR THINKING</div><h2>Your written response</h2><p>Use the supplied material, explain your reasoning, and acknowledge uncertainty. You do not need to upload anything.</p>
        <label className="field"><span>Your response</span><textarea aria-label="Your response" aria-describedby="response-help" rows={16} maxLength={10000} value={response} disabled={!editable || busy} onChange={e => { setResponse(e.target.value); setDirty(true); }} placeholder="Here’s what I noticed, the evidence that supports it, and what I would check next…" /><small id="response-help">{response.length}/10000 characters · at least 60 characters and 12 words to submit</small></label>
        <div className="save-state">{dirty ? <><Circle size={10} />Unsaved changes · save before leaving</> : submission ? <><CheckCircle2 size={13} />Saved to your account</> : <><Save size={13} />Save a draft to come back later</>}</div>
        {editable && (data.user ? <div className="response-actions"><button className="button secondary" disabled={busy} onClick={() => save(false)}><Save size={15} />Save draft</button><button className="button" disabled={busy || !complete} onClick={() => save(true)}>{busy ? <Loader2 size={15} className="spin" /> : <Send size={15} />}{submission?.status === "revision_requested" ? "Resubmit" : "Submit contribution"}</button></div> : <button className="button full-width" onClick={signIn}>Sign in to save & submit<ArrowRight size={15} /></button>)}
        <div className="human-note"><HeartHandshake size={17} /><span>Reviewed by <strong>{task.reviewer_name}</strong>, not an algorithm. Task version {submission?.task_version || task.current_version}.</span></div>
      </section>
    </div>
  </>;
}
