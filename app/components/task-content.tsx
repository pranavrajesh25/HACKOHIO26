import { BookOpen, Check, CheckCircle2 } from "lucide-react";
import { materialsLabel, type Answers, type TaskContent } from "@/lib/content";
import type { Artifact } from "@/lib/types";

export function MaterialNotice({ content }: { content: TaskContent }) {
  const label = materialsLabel(content.materialsOrigin);
  return label ? <div className="material-notice" role="note"><BookOpen size={16} /><span><strong>{label}</strong><br />For demonstration only—not observations from a real project.</span></div> : null;
}
export function TaskMaterials({ content }: { content: TaskContent }) {
  return <div className="task-materials"><MaterialNotice content={content} /><h3>Task materials</h3><pre>{content.materials}</pre></div>;
}
export function AnswerDisplay({ answers }: { answers: Answers }) {
  if ("response" in answers) return <div className="text-answer"><strong>Written contribution</strong><p>{answers.response}</p></div>;
  return <div className="answer-display"><span className={`route-letter route-${answers.route}`}>{answers.route}</span><div><strong>Proposed route {answers.route}</strong><p>{answers.explanation}</p><h4>Missing information</h4><p>{answers.missing}</p></div></div>;
}
export function ArtifactCard({ artifact: a }: { artifact: Artifact }) {
  return <div className="artifact"><div><span className="badge status-approved"><Check size={12} /> Approved contribution</span>{"route" in a.answers && <span className="muted-text">Route {a.answers.route}</span>}</div><h3>{a.title}</h3><MaterialNotice content={a.content} /><AnswerDisplay answers={a.answers} /><small><CheckCircle2 size={13} /> Contributed by {a.student_name}</small></div>;
}
