# Project Test Drive

A hackathon prototype that takes university students from “that looks interesting” to “I helped build that.” Built with Next.js 16, React, Better Auth, and shared server-side SQLite (`better-sqlite3`). Seeded projects, people, organizations, and mentor roles are fictional demo content.

## Run locally

Requires Node.js 22 or newer and npm. SQLite’s native dependency may need a C++ build toolchain if a prebuilt binary is unavailable.

```bash
npm ci
cp .env.example .env.local
# Set BETTER_AUTH_SECRET to a random string of at least 32 characters.
npm run dev
```

Open http://localhost:3000. The database schema, three fictional projects, shared demo accounts, and predefined robot task initialize automatically on the first data request. Default database: `data/test-drive.sqlite`.

Use **Sign in → Try as student** and **Try as lead** in separate browser profiles or a normal/private window. These are real authenticated but deliberately shared demo accounts; do not enter private information. Alternatively, register separate accounts. Any authenticated user can create a project and becomes its project-scoped lead.

## Featured demo: generate, publish, contribute

1. **Lead session:** open **Project lead space**, find **Campus Energy Detective**, and select **Add task**. New custom task fields are blank.
2. Review the project brief, beginner level, completion time, and responsible reviewer. Leave **Allow AI to create labeled fictional demo data or source passages when needed** checked.
3. Click **Generate starter task**. With OpenRouter configured, live AI creates an editable text task and can include a small fictional energy dataset. Without a key, a clearly labeled simulated example provides a complete synthetic table, units, occupancy context, instructions, and criteria. Both paths save only a draft.
4. In the manual task editor, review all fields and the synthetic-data notice. Edit and save if necessary. Check the human approval checkbox, then **Approve & publish task**. The task becomes publicly available and the project is no longer a preview. Alternatively, use the lead-dashboard quick-generation flow below for automatic publication.
5. **Separate student session:** open that project and try the published task. Read the text/table and submit a written explanation. Save a draft and refresh to demonstrate persistence.
6. **Lead:** inspect the captured instructions, dataset, criteria, and response. Give specific written feedback and request a revision.
7. **Student:** revise and resubmit. **Lead:** approve the new revision. Submitted revisions and feedback remain immutable.
8. The shared project notebook displays the approved response with the student’s name and synthetic-material provenance. Credit remains even if the student never joins.
9. Optionally, the student applies with their approved contribution linked. The lead invites them through **Team applications**. The student accepts under **My teams**; only then is membership created.

**Publishing a new project:** create and save a private project draft, explicitly publish the project, then either generate and auto-publish tasks from its dashboard card or use the manual task editor. Project publication and task publication are separate actions.

## Voice-to-project drafts

On **Create a project**, record a browser microphone description (around 30 seconds; automatically stopped at 60), play it back, and select **Generate project draft from recording**. HTTPS or localhost and microphone permission are required. Browser recordings are converted locally to 16 kHz mono WAV before being sent to OpenRouter's speech-to-text API using `openai/whisper-large-v3-turbo`. Haiku 5.5 then turns the transcript into validated, editable project fields.

Voice assistance requires `OPENROUTER_API_KEY`; there is no simulated transcription. You may also type/edit the transcript and generate from text, including retrying after a drafting failure. Inferred details are marked as suggestions; real partnerships, people, resources, and availability must not be invented. Existing form edits require confirmation before replacement. Contributor acceptance settings are never AI-controlled. Generation neither saves nor publishes: review all fields, save a private draft, and explicitly publish separately.

Audio is processed transiently and is not stored by this application; it is sent to an external provider, whose retention policies apply. Transcripts are not stored separately (only reviewed project fields are saved). Requests require authentication, share the task-generation rate limit, and enforce actual audio byte/duration limits server-side. No audio uploads or recording library are added.

## Task formats

- **Predefined Robot Route Rescue:** the only newly publishable interactive task. It retains its illustrated map, three predefined routes, reasoning/missing-information fields, and safety disclaimer.
- **Every custom task:** `written-response`. Students read textual instructions/materials and submit one free-text response. No uploads, custom maps, custom engines, or code execution are needed.
- **Legacy planning drafts:** open the saved draft, use **Convert to text task**, review/edit materials and instructions, resolve missing information, save, and explicitly approve publication. Regenerating also produces a text task. Existing saved work is never silently overwritten.

Previously published route-task snapshots and submitted route answers remain readable for compatibility. New custom interactive tasks are rejected on the server. The predefined task and old immutable revisions are not migrated or changed.

Text submissions accept any nonempty answer (up to 10000 characters), including a short phrase or number; empty drafts can still be saved. Human reviewers check the task’s requested deliverable, not a minimum word count. Route submissions retain their original route, explanation, and missing-information validation. No answer receives an automatic correctness score. Draft saving is explicit, not autosave: sign in before writing and save before navigation.

## Optional OpenRouter assistance

New generated tasks are minimal project-relevant microtasks: one simple question or action, roughly 2–5 minutes, answered with a few words, a number, or one short sentence. The prompt asks for tiny self-contained materials and simple review criteria, not essays or multi-part analysis. Offline preset examples follow the same scope. Existing saved tasks are not rewritten. The manual editor retains draft review/publication; quick generation bypasses that step.

### One-click task generation and publication

In **Project lead space**, each lead-owned project card has **Generate & publish 2–3 tasks**. Publish the project first to enable it. One live AI request chooses two tasks for a focused project or three for a broader one, with distinct independent steps and no per-task approval screen. The batch is validated and published atomically; failures add no partial tasks. Existing tasks are preserved, included as context to discourage repetition, and exact normalized title/instruction duplicates are rejected. Semantic distinctness and project relevance are prompted, not guaranteed by an AI correctness checker.

The clicking lead is assigned as the human reviewer for student submissions. These tasks are marked `ai-auto`, not human-approved (`approved=0`), and immutable task versions are created at publication. Synthetic materials remain labeled fictional through submission/review/credit. Only leads can use this endpoint; closed/draft projects are rejected, and permission, project status and context are rechecked after inference. This workflow requires a live API key with no simulated auto-publication fallback. It shares the existing per-user AI budget. The UI refreshes the card with published tasks and reports failures without a confirmation/review modal.

Set this **server-only** environment variable:

```dotenv
OPENROUTER_API_KEY=your-key-here
```

Models are hardcoded in `lib/openrouter.ts`: `anthropic/claude-haiku-5.5` for every text/PDF call and `openai/whisper-large-v3-turbo` for transcription. The old `OPENROUTER_MODEL` and `OPENROUTER_TRANSCRIPTION_MODEL` environment variables are no longer read. Every request includes `X-Title: Project Test Drive` for OpenRouter app attribution. Single-task generation, auto-published batches, voice drafting, and résumé imports share a persistent budget of five assisted requests per user per minute (a batch counts as one workflow, as does voice transcription + drafting).

The generator uses the selected project’s title, problem, goal, project brief, materials, beginner level, and target duration. It creates complete editable text-task drafts, not robot exercises for unrelated projects. Live task calls time out after 25 seconds; voice calls after 45 seconds per stage; résumé calls after 60 seconds. Invalid responses leave existing editor content unchanged. Manual authoring works without AI.

### Résumé-to-interests import

On **Your profile**, choose a CV/résumé PDF (up to 5 MB), consent to external processing, and select **Suggest interests from PDF**. The authenticated server sends it as a base64 PDF attachment to Haiku using OpenRouter's native PDF parser, without a local extraction library or separate OCR service. Native vision can handle clear scanned pages, but unreadable, encrypted, overly long PDFs, or documents with insufficient evidence may fail. Manual interest editing always remains available; no-key imports are not simulated.

Review 5–10 grounded keyword suggestions, edit/remove any, then **Merge suggestions into interests**. Merging preserves current interests, deduplicates case-insensitively, and respects the profile's 1000-character limit without truncation. You must still select **Save profile** to persist changes. Failures never change saved interests. Suggestions are possible learning interests, not verified skills; the prompt prohibits invented interests, sensitive-trait inference, identifying details, and instructions embedded in the document.

The application does not store or log the PDF or extracted text, and does not log provider responses. Only reviewed interests are saved through the existing profile workflow. The PDF is sent to OpenRouter and its model provider, whose retention policies apply. Requests validate actual streamed size and the PDF signature server-side; file-picker restrictions alone are not trusted. No database migration is required.

### Synthetic demo materials

The lead may allow AI to synthesize small datasets, short source passages, or scenarios to make a self-contained demo task. It must not invent real partnerships, people, reviewer availability, or claim that fictional measurements are real.

- Live model-authored exercise facts are labeled **AI-generated fictional demo data**.
- Offline preset exercise data is labeled **Simulated fictional demo data (preset, not live AI)**. Simulation is never presented as a live inference call.
- Provenance is saved with the task content and immutable task-version snapshot. Notices are visible in the editor, published student workspace, contribution history, review screen, and credited artifact.
- With synthesis disabled, generation uses only supplied material and identifies missing evidence. Required missing information blocks publication.
- Complete synthetic materials remove the need for a real dataset. Manual task drafts still require human approval; dashboard quick-generation batches publish automatically at the lead’s request.

AI-generated tasks can be auto-published through the dashboard or reviewed as drafts through the manual editor. Feedback, revision requests, contribution approval, application decisions, and invitations remain human actions.

## Persistence, permissions, and state

- SQLite persists authentication, profiles, projects, project memberships, tasks, published task versions, submissions, immutable revisions, human reviews, and applications. Saved records survive refresh, navigation, sign-out, and server restart. Application records are not browser-only.
- Better Auth stores password hashes in its account table, not profile records. Profiles store only the authentication ID, display name, and interests.
- Server authorization scopes management/review to assigned projects. Only the captured assigned reviewer can decide a submitted revision, never their own work.
- Drafts are private. Anonymous responses do not include private submissions, reviewer feedback, application availability, or learning interests. Approved answers and attribution are public in the notebook.
- Published instructions, materials, format, and provenance are captured in immutable task versions. Submitted revisions are immutable; feedback references an exact revision. Stale review decisions are rejected.
- Submission validation uses the captured task format; route answers cannot be substituted for a text response or vice versa.
- Public artifacts are derived from approved submissions, never copied to a second contribution table.
- Applications must link an approved contribution owned by the applicant in the same project. Applications and memberships are unique per student/project. Invitations do not create membership; acceptance does, atomically and idempotently.
- SQLite foreign keys, WAL, busy timeout, uniqueness constraints, and `BEGIN IMMEDIATE` transactions protect related updates. Schema initialization is idempotent in `lib/db.ts`; new task formats and provenance use existing versioned JSON fields.

State flows:

```text
Project/task: draft → published → closed
Submission: draft → submitted → revision requested → resubmitted → approved
            (approval may also follow the first submission)
Application: pending → invited → accepted or declined
             rejection and withdrawal are also supported
```

Published tasks are read-only; create another task for a new exercise. Closing a project/task preserves records but stops further work, including requested revisions. There is no reopen action. The UI exposes withdrawal while pending; the server also permits withdrawal while invited. Reapplication after rejection/withdrawal/decline is not implemented.

## Verification

```bash
npm test
npm run lint
npx tsc --noEmit
npx playwright install chromium
npm run test:e2e
npm run build
```

Database tests run in memory. Browser tests use independent student/lead sessions, an isolated server on :3100, and `data/test-drive.e2e.sqlite`. They exercise résumé consent/review/edit/merge/save and failure handling, voice project drafting, manual text authoring/publication, AI-assisted synthetic energy-task publication, saved-draft persistence, text feedback/revision/approval, public credit, applications/invitations/acceptance, provenance, malformed-provider responses, and the original robot map/submission/review flow. Provider calls are mocked in automated tests; unit/integration tests also check authentication, shared rate limits, streamed size enforcement, hardcoded model selection, and app-name headers.

## Deployment and limitations

Deploy **one Node.js instance with a persistent writable volume**. Do not put SQLite on ephemeral serverless storage or share it between independent replicas. Use a SQLite/WAL-aware backup procedure.

Set `DATABASE_PATH` to the persistent volume, `BETTER_AUTH_URL` to the public origin, and a strong `BETTER_AUTH_SECRET` before production build/start. Demo sign-in works in development regardless of `ENABLE_DEMO_AUTH`; in production it requires `ENABLE_DEMO_AUTH=true`. Disabling it does not revoke existing sessions or old passwords in a reused demo database. Use separate demo and private-production databases.

Remaining prototype limits: no email verification/password-reset delivery setup, reviewer invitation/promotion workflow, team roster-management screen, task-material/submission uploads, automated migration CLI, notifications, chat, feeds, ranking, recommendations, or external repository integrations. Résumé PDFs are accepted only for transient profile-interest analysis. Updates are fetched after mutations, on reload, and when the window regains focus rather than pushed live. Newly created projects default to their creator as reviewer; reviewer selection is restricted to existing project leads/reviewers.
