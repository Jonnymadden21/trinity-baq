import { describe, it, expect, vi } from "vitest";
import { checkRateLimit } from "../../api/_lib/rateLimit";

describe("checkRateLimit", () => {
  function fakeClient(initial = 0) {
    let count = initial;
    return {
      incr: vi.fn(async () => ++count),
      expire: vi.fn(async () => 1),
    };
  }

  it("allows the first request", async () => {
    const client = fakeClient();
    const r = await checkRateLimit(client, "1.2.3.4", 5, 60);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
    expect(client.incr).toHaveBeenCalledOnce();
  });

  it("rejects when count exceeds the limit", async () => {
    const client = fakeClient(5);
    const r = await checkRateLimit(client, "1.2.3.4", 5, 60);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("only sets expire on the first hit", async () => {
    const client = fakeClient();
    await checkRateLimit(client, "1.2.3.4", 5, 60);
    await checkRateLimit(client, "1.2.3.4", 5, 60);
    expect(client.expire).toHaveBeenCalledOnce();
  });

  it("fails open when client is null (Upstash unconfigured)", async () => {
    const r = await checkRateLimit(null, "1.2.3.4", 5, 60);
    expect(r.allowed).toBe(true);
  });
});
