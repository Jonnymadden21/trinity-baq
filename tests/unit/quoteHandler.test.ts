import { describe, it, expect } from "vitest";
import { validateQuotePayload } from "../../api/_lib/quotePayload";

describe("validateQuotePayload", () => {
  const base = {
    machineId: 1,
    selectedOptionIds: [10, 11],
    customerName: "Jane Doe",
    customerEmail: "jane@example.com",
    customerCompany: null,
    customerPhone: null,
    financingParams: null,
    roiParams: null,
    website: "",
  };

  it("accepts a valid payload", () => {
    const r = validateQuotePayload(base);
    expect(r.success).toBe(true);
  });

  it("rejects bad email", () => {
    const r = validateQuotePayload({ ...base, customerEmail: "not-an-email" });
    expect(r.success).toBe(false);
  });

  it("rejects missing machineId", () => {
    const r = validateQuotePayload({ ...base, machineId: undefined });
    expect(r.success).toBe(false);
  });

  it("accepts empty selectedOptionIds (an empty array is valid)", () => {
    const r = validateQuotePayload({ ...base, selectedOptionIds: [] });
    expect(r.success).toBe(true);
  });

  it("rejects non-string honeypot", () => {
    const r = validateQuotePayload({ ...base, website: 123 });
    expect(r.success).toBe(false);
  });
});
