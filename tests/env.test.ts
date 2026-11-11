import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
vi.mock("server-only", () => ({}));
import { serverEnv, isConfigured } from "@/lib/env";

afterEach(() => vi.unstubAllEnvs());

describe("environment defaults", () => {
  it("anonymous reporting is off unless the variable is exactly 'true'", () => {
    for (const v of [undefined, "", "false", "TRUE", "1", "yes"]) {
      vi.stubEnv("ALLOW_ANONYMOUS_REPORTS", v as string);
      expect(serverEnv().allowAnonymousReports, String(v)).toBe(false);
    }
    vi.stubEnv("ALLOW_ANONYMOUS_REPORTS", "true");
    expect(serverEnv().allowAnonymousReports).toBe(true);
  });
  it(".env.example ships with anonymous reporting disabled and no values", () => {
    const text = readFileSync(".env.example", "utf8");
    expect(text).toMatch(/^ALLOW_ANONYMOUS_REPORTS=false$/m);
    expect(text).toMatch(/^SUPABASE_SERVICE_ROLE_KEY=$/m);
  });
  it("is not 'configured' until all three Supabase values exist", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.test"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "a");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(isConfigured()).toBe(false);
  });
});
