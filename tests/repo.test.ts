import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ results: [] as any[], calls: 0 }));
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({
    from: () => {
      const result = state.results[state.calls++] ?? { data: [], error: null };
      const query: any = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        then: (resolve: (value: any) => unknown, reject: (reason: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return query;
    },
  }),
}));

import { moderationData, listRegistry } from "@/lib/repo";

beforeEach(() => { state.results = []; state.calls = 0; });

describe("moderation repository failures", () => {
  it("distinguishes six successful empty queries from failures", async () => {
    state.results = Array.from({ length: 6 }, () => ({ data: [], error: null }));
    await expect(moderationData()).resolves.toEqual({
      reports: [], sources: [], active: [], registry: [], flags: [], audit: [],
    });
    expect(state.calls).toBe(6);
  });

  it("propagates a partial query failure instead of returning a misleading empty queue", async () => {
    state.results = [
      { data: [], error: null },
      { data: null, error: { message: "source query unavailable" } },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ];
    await expect(moderationData()).rejects.toMatchObject({ message: "source query unavailable" });
  });

  it("propagates a full query failure", async () => {
    state.results = Array.from({ length: 6 }, () => ({ data: null, error: { message: "database offline" } }));
    await expect(moderationData()).rejects.toMatchObject({ message: "database offline" });
  });

  it("propagates source registry query errors", async () => {
    state.results = [{ data: null, error: { message: "registry unavailable" } }];
    await expect(listRegistry()).rejects.toMatchObject({ message: "registry unavailable" });
  });
});
