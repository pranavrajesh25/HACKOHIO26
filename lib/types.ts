import type { Answers, TaskContent } from "./content";
export type Project = { id: string; creator: string; title: string; problem: string; goal: string; description: string; topic: string; disciplines: string; materials: string; team: string; roles: string; duration: string; commitment: string; status: string; accepting: number; preview: number };
export type Task = { id: string; project_id: string; reviewer: string; reviewer_name: string; status: string; current_version: number; content: TaskContent; approved: number; source: string };
export type Review = { id: string; reviewer_name: string; decision: string; feedback: string; created_at: string };
export type Revision = { id: string; number: number; answers: Answers; created_at: string; review?: Review };
export type Submission = { id: string; task_id: string; student: string; student_name: string; project_id: string; project_title: string; task_version: number; current_revision: number; status: string; draft: Answers; updated_at: string; content: TaskContent; reviewer: string; revisions: Revision[] };
export type Application = { id: string; project_id: string; student: string; student_name: string; submission_id: string; role: string; availability: string; interests: string; profile_interests: string; status: string };
export type Artifact = { id: string; project_id: string; student_name: string; title: string; answers: Answers; content: TaskContent };
export type Data = { user: { id: string; name: string; email: string; interests: string } | null; projects: Project[]; tasks: Task[]; submissions: Submission[]; applications: Application[]; artifacts: Artifact[]; managed: string[]; memberships: { project_id: string; role: string }[]; reviewers: { project_id: string; id: string; name: string }[] };
