import { describe, it, expect } from "vitest";
import { validateQuotePayload } from "../../api/_lib/quotePayload";

describe("validateQuotePayload", () => {
  const base = {
    machineId: 1,
    selectedOptions: [{ id: 10, quantity: 16 }, { id: 11 }],
    customerName: "Jane Doe",
    customerEmail: "jane@example.com",
    customerCompany: null,
    customerPhone: null,
    cncMachineModel: "Haas VF-2",
    cncYear: 2023,
    cncSerialNumber: "1234567",
    voltage: "220 VAC",
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

  it("accepts empty selectedOptions", () => {
    const r = validateQuotePayload({ ...base, selectedOptions: [] });
    expect(r.success).toBe(true);
  });

  it("rejects non-string honeypot", () => {
    const r = validateQuotePayload({ ...base, website: 123 });
    expect(r.success).toBe(false);
  });

  it("accepts payload without optional CNC fields", () => {
    const { cncMachineModel: _a, cncYear: _b, cncSerialNumber: _c, voltage: _d, ...minimal } = base;
    void _a; void _b; void _c; void _d;
    const r = validateQuotePayload(minimal);
    expect(r.success).toBe(true);
  });

  it("rejects invalid voltage value", () => {
    const r = validateQuotePayload({ ...base, voltage: "110 VAC" });
    expect(r.success).toBe(false);
  });

  it("rejects negative quantity", () => {
    const r = validateQuotePayload({ ...base, selectedOptions: [{ id: 10, quantity: -1 }] });
    expect(r.success).toBe(false);
  });
});
