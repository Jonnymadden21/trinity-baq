import { describe, it, expect } from "vitest";
import { isAllowedOrigin } from "../../api/_lib/origin";

describe("isAllowedOrigin", () => {
  const allowed = ["https://trinitybaq.com", "https://www.trinitybaq.com"];

  it("accepts an exact match in Origin", () => {
    expect(isAllowedOrigin({ origin: "https://trinitybaq.com" }, allowed)).toBe(true);
  });

  it("falls back to Referer prefix when Origin is missing", () => {
    expect(
      isAllowedOrigin({ referer: "https://trinitybaq.com/configure/ax2-16" }, allowed)
    ).toBe(true);
  });

  it("rejects any other origin", () => {
    expect(isAllowedOrigin({ origin: "https://evil.example" }, allowed)).toBe(false);
  });

  it("rejects empty headers", () => {
    expect(isAllowedOrigin({}, allowed)).toBe(false);
  });
});
