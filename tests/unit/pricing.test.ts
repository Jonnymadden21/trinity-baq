import { describe, it, expect } from "vitest";
import { computeQuoteTotals } from "@server/pricing";

describe("computeQuoteTotals", () => {
  const machine = { id: 1, basePrice: "189245.00" };
  const options = [
    { id: 10, machineId: 1, price: "1500.00" },
    { id: 11, machineId: 1, price: "750.50" },
    { id: 12, machineId: 1, price: "0.00" },
  ];

  it("sums basePrice + selected option prices into a numeric-precise string", () => {
    const r = computeQuoteTotals({ machine, allOptions: options, selectedOptionIds: [10, 11] });
    expect(r.basePrice).toBe("189245.00");
    expect(r.optionsTotal).toBe("2250.50");
    expect(r.totalPrice).toBe("191495.50");
  });

  it("returns optionsTotal '0.00' when no options selected", () => {
    const r = computeQuoteTotals({ machine, allOptions: options, selectedOptionIds: [] });
    expect(r.optionsTotal).toBe("0.00");
    expect(r.totalPrice).toBe("189245.00");
  });

  it("throws when a selected option id is not in allOptions", () => {
    expect(() =>
      computeQuoteTotals({ machine, allOptions: options, selectedOptionIds: [10, 999] })
    ).toThrow(/unknown option/i);
  });

  it("throws when a selected option belongs to a different machine", () => {
    const wrong = [...options, { id: 99, machineId: 2, price: "100.00" }];
    expect(() =>
      computeQuoteTotals({ machine, allOptions: wrong, selectedOptionIds: [99] })
    ).toThrow(/wrong machine/i);
  });

  it("rejects duplicate option ids", () => {
    expect(() =>
      computeQuoteTotals({ machine, allOptions: options, selectedOptionIds: [10, 10] })
    ).toThrow(/duplicate/i);
  });
});
