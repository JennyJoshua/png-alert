import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const routes = walk("app/api").filter((f) => f.endsWith("route.ts"));

describe("static audit of app/api (fails if a future route skips a control)", () => {
  it("finds the expected routes", () => { expect(routes.length).toBeGreaterThanOrEqual(6); });

  it.each(routes)("%s exports only POST, runs the origin guard, reads the body safely and validates with zod", (f) => {
    const src = readFileSync(f, "utf8");
    expect([...src.matchAll(/export (?:async )?function ([A-Z]+)/g)].map((m) => m[1])).toEqual(["POST"]);
    expect(src).toMatch(/guard\(req/);
    expect(src).toMatch(/readForm\(req\)/);
    expect(src).not.toMatch(/req\.formData\(\)/);
    expect(src).toMatch(/safeParse\(/);
  });

  it("only server code touches the service-role client or key", () => {
    const offenders = walk(".").filter((f) => !f.startsWith("node_modules") && !f.startsWith(".next") && !f.startsWith(".git") && /\.(ts|tsx)$/.test(f))
      .filter((f) => !f.startsWith("tests") && !f.startsWith("lib") && /serviceClient|SERVICE_ROLE/.test(readFileSync(f, "utf8")))
      .filter((f) => !f.startsWith(join("app", "api")));
    expect(offenders).toEqual([]);
  });

  it("no client component exists that could import server-only modules", () => {
    const clients = walk(".").filter((f) => !f.startsWith("node_modules") && !f.startsWith(".next") && !f.startsWith(".git") && /\.(ts|tsx)$/.test(f))
      .filter((f) => /^\s*["']use client["']/m.test(readFileSync(f, "utf8")));
    for (const f of clients) expect(readFileSync(f, "utf8")).not.toMatch(/@\/lib\/(env|supabase|auth|repo)|server-only/);
  });

  it("the service-role key variable is never given a NEXT_PUBLIC_ name", () => {
    for (const f of walk(".").filter((f) => !f.startsWith("node_modules") && !f.startsWith(".next") && !f.startsWith(".git") && !f.endsWith("package-lock.json") && !f.startsWith("tests")))
      expect(readFileSync(f, "utf8"), f).not.toMatch(/NEXT_PUBLIC_\w*SERVICE/);
  });
});
