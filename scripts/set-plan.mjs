// Sets an account's plan. There's no billing yet, so this is how an account gets Starter or Pro.
//
//   node scripts/set-plan.mjs someone@example.com starter
//   node scripts/set-plan.mjs someone@example.com pro
//   node scripts/set-plan.mjs someone@example.com free
//
// Run it on the server, from the project folder. It uses the same database as the app
// (DATABASE_PATH from .env.local, or data/app.db), and takes effect immediately.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const PLANS = ["free", "starter", "pro"];
const [email, plan] = process.argv.slice(2);

if (!email || !PLANS.includes(plan)) {
  console.error(`Usage: node scripts/set-plan.mjs <email> <${PLANS.join("|")}>`);
  process.exit(1);
}

// Pick up DATABASE_PATH from .env.local the same way the app does, unless it's already set.
let dbPath = process.env.DATABASE_PATH;
if (!dbPath && existsSync(".env.local")) {
  const line = readFileSync(".env.local", "utf8").split("\n").find((l) => l.startsWith("DATABASE_PATH="));
  if (line) dbPath = line.slice("DATABASE_PATH=".length).trim().replace(/^["']|["']$/g, "");
}
dbPath ??= path.join(process.cwd(), "data", "app.db");

if (!existsSync(dbPath)) {
  console.error(`No database at ${dbPath}. Run this from the project folder on the server.`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
const user = db.prepare("SELECT id, email, plan FROM users WHERE email = ?").get(email.trim().toLowerCase());
if (!user) {
  console.error(`No account with the email ${email}.`);
  process.exit(1);
}
if (user.plan === plan) {
  console.log(`${user.email} is already on the ${plan} plan. Nothing changed.`);
} else {
  db.prepare("UPDATE users SET plan = ? WHERE id = ?").run(plan, user.id);
  console.log(`${user.email}: ${user.plan} -> ${plan}`);
}
