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
4. Review all fields and the synthetic-data notice. Edit and save if necessary. Check the human approval checkbox, then **Approve & publish task**. The task becomes publicly available and the project is no longer a preview. There is no automatic publication.
5. **Separate student session:** open that project and try the published task. Read the text/table and submit a written explanation. Save a draft and refresh to demonstrate persistence.
6. **Lead:** inspect the captured instructions, dataset, criteria, and response. Give specific written feedback and request a revision.
7. **Student:** revise and resubmit. **Lead:** approve the new revision. Submitted revisions and feedback remain immutable.
8. The shared project notebook displays the approved response with the student’s name and synthetic-material provenance. Credit remains even if the student never joins.
9. Optionally, the student applies with their approved contribution linked. The lead invites them through **Team applications**. The student accepts under **My teams**; only then is membership created.

**Publishing a new project:** create and save a private project draft, explicitly publish the project, then add, save, approve, and publish its task. Project publication and task publication are separate actions.

## Voice-to-project drafts

On **Create a project**, record a browser microphone description (around 30 seconds; automatically stopped at 60), play it back, and select **Generate project draft from recording**. HTTPS or localhost and microphone permission are required. Browser recordings are converted locally to 16 kHz mono WAV before being sent to OpenRouter's speech-to-text API using `openai/whisper-large-v3-turbo` (override with `OPENROUTER_TRANSCRIPTION_MODEL`). The existing `OPENROUTER_MODEL` then turns the transcript into validated, editable project fields.

Voice assistance requires `OPENROUTER_API_KEY`; there is no simulated transcription. You may also type/edit the transcript and generate from text, including retrying after a drafting failure. Inferred details are marked as suggestions; real partnerships, people, resources, and availability must not be invented. Existing form edits require confirmation before replacement. Contributor acceptance settings are never AI-controlled. Generation neither saves nor publishes: review all fields, save a private draft, and explicitly publish separately.

Audio is processed transiently and is not stored by this application; it is sent to an external provider, whose retention policies apply. Transcripts are not stored separately (only reviewed project fields are saved). Requests require authentication, share the task-generation rate limit, and enforce actual audio byte/duration limits server-side. No audio uploads or recording library are added.

## Task formats

- **Predefined Robot Route Rescue:** the only newly publishable interactive task. It retains its illustrated map, three predefined routes, reasoning/missing-information fields, and safety disclaimer.
- **Every custom task:** `written-response`. Students read textual instructions/materials and submit one free-text response. No uploads, custom maps, custom engines, or code execution are needed.
- **Legacy planning drafts:** open the saved draft, use **Convert to text task**, review/edit materials and instructions, resolve missing information, save, and explicitly approve publication. Regenerating also produces a text task. Existing saved work is never silently overwritten.

Previously published route-task snapshots and submitted route answers remain readable for compatibility. New custom interactive tasks are rejected on the server. The predefined task and old immutable revisions are not migrated or changed.

Text submissions require at least 60 characters and 12 words; incomplete drafts can be saved. Route submissions retain their original route, explanation, and missing-information validation. No answer receives an automatic correctness score. Draft saving is explicit, not autosave: sign in before writing and save before navigation.

## Optional OpenRouter assistance

Set these **server-only** environment variables:

```dotenv
OPENROUTER_API_KEY=your-key-here
OPENROUTER_MODEL=openai/gpt-4o-mini
```

The generator uses the selected project’s title, problem, goal, project brief, materials, beginner level, and target duration. It creates complete editable text-task drafts, not robot exercises for unrelated projects. Live calls time out after 25 seconds and are limited to five per user per minute. Invalid responses leave existing editor content unchanged. Manual authoring works without AI.

### Synthetic demo materials

The lead may allow AI to synthesize small datasets, short source passages, or scenarios to make a self-contained demo task. It must not invent real partnerships, people, reviewer availability, or claim that fictional measurements are real.

- Live model-authored exercise facts are labeled **AI-generated fictional demo data**.
- Offline preset exercise data is labeled **Simulated fictional demo data (preset, not live AI)**. Simulation is never presented as a live inference call.
- Provenance is saved with the task content and immutable task-version snapshot. Notices are visible in the editor, published student workspace, contribution history, review screen, and credited artifact.
- With synthesis disabled, generation uses only supplied material and identifies missing evidence. Required missing information blocks publication.
- Complete synthetic materials remove the need for a real dataset, but do not bypass explicit human approval of the saved task.

All AI-authored decisions are suggestions about task content. Feedback, revision requests, contribution approval, application decisions, and invitations are always human actions.

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

Database tests run in memory. Browser tests use independent student/lead sessions, an isolated server on :3100, and `data/test-drive.e2e.sqlite`. They exercise manual text authoring/publication, AI-assisted synthetic energy-task publication, saved-draft persistence, text feedback/revision/approval, public credit, applications/invitations/acceptance, provenance, malformed-provider responses, and the original robot map/submission/review flow.

## Deployment and limitations

Deploy **one Node.js instance with a persistent writable volume**. Do not put SQLite on ephemeral serverless storage or share it between independent replicas. Use a SQLite/WAL-aware backup procedure.

Set `DATABASE_PATH` to the persistent volume, `BETTER_AUTH_URL` to the public origin, and a strong `BETTER_AUTH_SECRET` before production build/start. Demo sign-in works in development regardless of `ENABLE_DEMO_AUTH`; in production it requires `ENABLE_DEMO_AUTH=true`. Disabling it does not revoke existing sessions or old passwords in a reused demo database. Use separate demo and private-production databases.

Remaining prototype limits: no email verification/password-reset delivery setup, reviewer invitation/promotion workflow, team roster-management screen, custom uploads, automated migration CLI, notifications, chat, feeds, ranking, recommendations, or external repository integrations. Updates are fetched after mutations, on reload, and when the window regains focus rather than pushed live. Newly created projects default to their creator as reviewer; reviewer selection is restricted to existing project leads/reviewers.
