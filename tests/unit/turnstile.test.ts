import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyTurnstile } from "../../api/_lib/turnstile";

// vi.spyOn(globalThis, "fetch") is broken in Vitest 4.x — use vi.stubGlobal instead
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => fetchMock.mockReset());
afterEach(() => fetchMock.mockReset());

describe("verifyTurnstile", () => {
  it("returns true when Cloudflare returns success", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
    expect(await verifyTurnstile("secret", "token", "1.2.3.4")).toBe(true);
  });

  it("returns false when Cloudflare returns success:false", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, "error-codes": ["timeout-or-duplicate"] }), {
        status: 200,
      })
    );
    expect(await verifyTurnstile("secret", "token", "1.2.3.4")).toBe(false);
  });

  it("returns false when secret is empty (dev fallback)", async () => {
    expect(await verifyTurnstile("", "token", "1.2.3.4")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false when token is empty", async () => {
    expect(await verifyTurnstile("secret", "", "1.2.3.4")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false on network/parse error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    expect(await verifyTurnstile("secret", "token", "1.2.3.4")).toBe(false);
  });
});
