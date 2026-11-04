// Fails if a secret-looking value is committed, or if the service-role key name/value could reach the browser bundle.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const JWT = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;
const SB_SECRET = /sb_secret_[A-Za-z0-9_-]{10,}/;
const problems = [];

const files = execSync("git ls-files -co --exclude-standard", { encoding: "utf8" }).split("\n").filter(Boolean);
for (const f of files) {
  if (f.endsWith("package-lock.json") || f === "scripts/check-secrets.mjs" || !existsSync(f)) continue;
  if (/^\.env($|\.)/.test(f.split("/").pop()) && !f.endsWith(".env.example")) problems.push(`${f}: env file must not be committed`);
  const text = readFileSync(f, "utf8");
  if (JWT.test(text) || SB_SECRET.test(text)) problems.push(`${f}: looks like a committed key or token`);
}

function walk(dir) {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
}
if (existsSync(".next/static")) {
  for (const f of walk(".next/static").filter((p) => /\.(js|html|json)$/.test(p))) {
    const t = readFileSync(f, "utf8");
    if (t.includes("SUPABASE_SERVICE_ROLE_KEY") || t.includes("serviceClient")) problems.push(`${f}: server-only code or key name found in browser bundle`);
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && t.includes(process.env.SUPABASE_SERVICE_ROLE_KEY)) problems.push(`${f}: service role key value in browser bundle`);
  }
} else console.log("note: .next/static not found; bundle check skipped (run after `npm run build`)");

if (problems.length) { console.error("Secret check FAILED:\n" + problems.map((p) => " - " + p).join("\n")); process.exit(1); }
console.log(`Secret check passed (${files.length} files scanned).`);
