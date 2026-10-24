import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const path = process.env.DATABASE_PATH || resolve("data/test-drive.sqlite");
mkdirSync(dirname(path), { recursive: true });
const globalDb = globalThis as unknown as { testDriveDb?: Database.Database };
export const db = globalDb.testDriveDb ?? new Database(path);
globalDb.testDriveDb = db;
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

// Idempotent initial migration. Authentication tables belong to Better Auth.
db.exec(`
CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, emailVerified INTEGER NOT NULL DEFAULT 0, image TEXT, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL);
CREATE TABLE IF NOT EXISTS session (id TEXT PRIMARY KEY, expiresAt DATETIME NOT NULL, token TEXT UNIQUE NOT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, ipAddress TEXT, userAgent TEXT, userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS account (id TEXT PRIMARY KEY, accountId TEXT NOT NULL, providerId TEXT NOT NULL, userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, accessToken TEXT, refreshToken TEXT, idToken TEXT, accessTokenExpiresAt DATETIME, refreshTokenExpiresAt DATETIME, scope TEXT, password TEXT, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL);
CREATE TABLE IF NOT EXISTS verification (id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, expiresAt DATETIME NOT NULL, createdAt DATETIME, updatedAt DATETIME);
CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY REFERENCES user(id), display_name TEXT NOT NULL, interests TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS projects (
 id TEXT PRIMARY KEY, creator TEXT NOT NULL REFERENCES user(id), title TEXT NOT NULL, problem TEXT NOT NULL, goal TEXT NOT NULL, description TEXT NOT NULL,
 topic TEXT NOT NULL, disciplines TEXT NOT NULL, materials TEXT NOT NULL, team TEXT NOT NULL, roles TEXT NOT NULL, duration TEXT NOT NULL, commitment TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('draft','published','closed')), accepting INTEGER NOT NULL DEFAULT 1, preview INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS memberships (project_id TEXT NOT NULL REFERENCES projects(id), user_id TEXT NOT NULL REFERENCES user(id), role TEXT NOT NULL CHECK(role IN ('lead','reviewer','member')), PRIMARY KEY(project_id,user_id));
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), reviewer TEXT NOT NULL REFERENCES user(id), status TEXT NOT NULL CHECK(status IN ('draft','published','closed')), current_version INTEGER NOT NULL DEFAULT 1, content TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'manual');
CREATE TABLE IF NOT EXISTS task_versions (task_id TEXT NOT NULL REFERENCES tasks(id), version INTEGER NOT NULL, content TEXT NOT NULL, reviewer TEXT NOT NULL REFERENCES user(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(task_id,version));
CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), student TEXT NOT NULL REFERENCES user(id), task_version INTEGER NOT NULL, current_revision INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL CHECK(status IN ('draft','submitted','revision_requested','resubmitted','approved')), draft TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(task_id,student), FOREIGN KEY(task_id,task_version) REFERENCES task_versions(task_id,version));
CREATE TABLE IF NOT EXISTS revisions (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id), number INTEGER NOT NULL, answers TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(submission_id,number));
CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, revision_id TEXT UNIQUE NOT NULL REFERENCES revisions(id), reviewer TEXT NOT NULL REFERENCES user(id), decision TEXT NOT NULL CHECK(decision IN ('revision_requested','approved')), feedback TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS applications (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), student TEXT NOT NULL REFERENCES user(id), submission_id TEXT NOT NULL REFERENCES submissions(id), role TEXT NOT NULL, availability TEXT NOT NULL, interests TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','invited','accepted','declined','rejected','withdrawn')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(project_id,student));
CREATE TRIGGER IF NOT EXISTS immutable_revision_update BEFORE UPDATE ON revisions BEGIN SELECT RAISE(ABORT, 'Submitted revisions are immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_revision_delete BEFORE DELETE ON revisions BEGIN SELECT RAISE(ABORT, 'Submitted revisions are immutable'); END;
CREATE TRIGGER IF NOT EXISTS immutable_version_update BEFORE UPDATE ON task_versions BEGIN SELECT RAISE(ABORT, 'Published versions are immutable'); END;
CREATE INDEX IF NOT EXISTS submissions_student ON submissions(student);
CREATE INDEX IF NOT EXISTS tasks_project ON tasks(project_id);
CREATE TABLE IF NOT EXISTS generation_limits (user_id TEXT PRIMARY KEY REFERENCES user(id), window_start INTEGER NOT NULL, count INTEGER NOT NULL);
`);
if (!(db.pragma("table_info(tasks)") as { name: string }[]).some(c => c.name === "source")) db.exec("ALTER TABLE tasks ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'");
