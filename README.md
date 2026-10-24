# Project Test Drive

A hackathon prototype that takes a university student from “that looks interesting” to “I helped build that.” Built with Next.js 16, React, Better Auth, and server-side SQLite (`better-sqlite3`). All seeded projects, people, organizations, maps, and mentor roles are fictional demo content.

## Run locally

Requires Node.js 22 or newer and npm. SQLite’s native dependency may need a C++ build toolchain if a prebuilt binary is unavailable.

```bash
npm install
cp .env.example .env.local
# Set BETTER_AUTH_SECRET to a random string of at least 32 characters.
npm run dev
```

Open http://localhost:3000. The database schema and fictional example projects initialize automatically on the first data request. Default database: `data/test-drive.sqlite`; records survive refresh, navigation, sign-out, and server restarts. No application records live in browser-only storage.

Use **Sign in → Try as student** and **Try as lead** in separate browser profiles or a normal/private window. These are real authenticated but deliberately shared demo accounts; do not enter private information. Alternatively, create separate accounts: any authenticated user can create a project and becomes its project-scoped lead.

## Complete demo journey

1. As a lead, open **Project lead space → Create a project**. Fill in the project fields. Use the bundled fictional campus map as starter material.
2. Save the private draft, explicitly **Publish project**, then **Add task**. The manual editor starts with a complete route-selection example.
3. Save the task draft, check the human-approval checkbox, and **Approve & publish task**.
4. In a separate student session, explore that project and **Try a small task**. Inspect routes, select one, explain trade-offs, and identify missing information. **Save draft**, refresh, then submit.
5. In the assigned reviewer’s session, inspect the submission and captured task criteria. Give written feedback and **Request a revision**.
6. The student opens their contribution, revises, and resubmits. The reviewer reviews revision 2 and approves it.
7. The public project notebook now derives an attributed artifact from the approved submission. Credit does not depend on team membership.
8. The student applies with their approved contribution automatically linked. The lead invites them through **Team applications**. The student accepts under **My teams**; only then is project membership created.

Robot Route Rescue also provides a ready-to-use published task. Campus Energy Detective and AI Answer Check are explicitly preview-only; no extra task engines are implemented.

## Optional OpenRouter assistance

Set these server environment variables:

```dotenv
OPENROUTER_API_KEY=your-key-here
OPENROUTER_MODEL=openai/gpt-4o-mini
```

The task editor accepts a project brief, supplied materials, beginner level, target time, supported format, and assigned reviewer. **Generate starter task** calls OpenRouter on the server, validates the structured result, preserves human-supplied material references, and saves an editable draft. The key is never sent to the browser. Five live requests per user per minute are allowed; provider calls time out after 25 seconds. Invalid responses leave the existing editor unchanged.

Without a key, the action returns a prominently labeled **simulated preset example**, including a blocking missing-information reminder. Task provenance is saved so the label survives navigation. Nothing is silently presented as live generation, and nothing is automatically published. Resolve missing information, save edits, then explicitly approve the task. The contribution/review flow never depends on AI.

## Persistence and safety

- Relational SQLite tables store authentication, profiles, projects, project memberships, tasks, immutable published task versions, submissions, immutable submitted revisions, reviews, and team applications.
- SQLite foreign keys, WAL, a busy timeout, uniqueness constraints, and `BEGIN IMMEDIATE` transactions protect related updates. Schema initialization is an idempotent initial migration in `lib/db.ts`; subsequent schema changes should be added as explicit migrations.
- Better Auth stores password hashes in its own account table, not profile records. Profiles store only the authentication ID, display name, and interests.
- Server-side authorization scopes lead and reviewer access to individual projects. Only the captured assigned reviewer can decide a revision, never on their own contribution.
- Drafts are private. Submission answers, private feedback, and application availability are absent from anonymous responses. The public artifact exposes only approved answers and attribution.
- Submitted revisions and published task snapshots cannot be updated. Feedback references an exact revision; stale review decisions are rejected.
- Applications must link an approved contribution owned by the applicant in the same project. Applications and memberships are unique per student/project. Invitations do not create membership; acceptance does, atomically and idempotently.
- Project and task closing preserves records while preventing new work. Published tasks are intentionally read-only; create a new task for a new exercise rather than altering students’ attempted instructions.
- All starter materials and illustrations are included. No arbitrary uploads, automatic student scoring, chat, ranking, feeds, or external repository integrations.

## Verification

```bash
npm test                  # isolated in-memory database integration tests
npm run lint
npx tsc --noEmit
npx playwright install chromium
npm run test:e2e          # independent browser sessions; isolated SQLite file/server on :3100
npm run build
```

Browser tests cover lead project creation/publication, task approval, saved-draft refresh, separate-account review, feedback/revision/approval, public attribution, private-response boundaries, application/invitation/acceptance, sign-out/sign-in persistence, search, previews, and mobile overflow. Database tests additionally cover self-review, unauthorized actions, invalid submissions and atomic rollback, immutable history, stale review decisions, duplicate approval effects, and idempotent memberships.

## Deployment

Deploy **one Node.js application instance with a persistent writable volume**. Do not put the SQLite database on ephemeral serverless storage or share it between independent multi-instance replicas. Back up the database using SQLite’s backup API or an appropriate WAL-aware backup procedure.

Set `DATABASE_PATH` to the persistent volume, `BETTER_AUTH_URL` to the public origin, and a strong `BETTER_AUTH_SECRET` before building/running production. Demo sign-in is disabled in production unless `ENABLE_DEMO_AUTH=true` is explicitly set. Use a separate database for a public demo; shared demo accounts are not a substitute for individual credentials. Do not reuse a local demo database as a private production deployment.

For a deliberately public hackathon demo:

```bash
# Configure environment first; explicitly enable demo auth only if desired.
npm run build
npm start
```

Prototype limitations: no email-verification/password-reset delivery setup, reviewer invitation workflow, automated migrations CLI, or production operations dashboard. An existing task’s reviewer must already be a project lead/reviewer; newly created projects default to their creator as reviewer. Live OpenRouter calls require your key and are not part of the offline test suite.
