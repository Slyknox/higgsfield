// Makes an existing user an admin, or back to a user. They must have signed in once.
// Usage: pnpm admin:role <email> [admin|user]
import pg from "pg";

const [email, role = "admin"] = process.argv.slice(2);
if (!email || !["admin", "user"].includes(role)) {
  console.error("Usage: pnpm admin:role <email> [admin|user]");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[admin] DATABASE_URL is not set");
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const { rowCount } = await client.query("update users set role = $2 where lower(email) = lower($1)", [email.trim(), role]);
  if (rowCount !== 1) {
    console.error(`[admin] No user with email ${email}. They need to sign in once first.`);
    process.exitCode = 1;
  } else console.log(`[admin] ${email} is now ${role === "admin" ? "an admin" : "a user"}.`);
} finally {
  await client.end();
}
