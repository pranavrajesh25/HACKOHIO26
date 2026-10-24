import { betterAuth } from "better-auth";
import { db } from "./db";

export const auth = betterAuth({
  database: db,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET || (process.env.NODE_ENV === "production" ? undefined : "test-drive-development-only-secret-change-before-deploying"),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  databaseHooks: {
    user: { create: { after: async (user) => {
      db.prepare("INSERT OR IGNORE INTO profiles (id,display_name,interests) VALUES (?,?,'')").run(user.id, user.name);
    } } },
  },
});
