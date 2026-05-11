import { describe, it, expect } from "vitest";
import { computeQuoteTotals } from "@server/pricing";

describe("computeQuoteTotals", () => {
  const machine = { id: 1, basePrice: "170500.00" };
  const opts = [
    { id: 10, machineId: 1, price: "825.00", quantity: 16, allowQuantityAdjustment: true, minQuantity: 2, maxQuantity: null },
    { id: 11, machineId: 1, price: "4995.00", quantity: 1, allowQuantityAdjustment: false, minQuantity: null, maxQuantity: null },
    { id: 12, machineId: 1, price: "0.00", quantity: 1, allowQuantityAdjustment: false, minQuantity: null, maxQuantity: null },
    { id: 13, machineId: 1, price: "695.00", quantity: 0, allowQuantityAdjustment: true, minQuantity: 0, maxQuantity: null },
  ];

  it("uses stored quantity when no override (pallets default 16 → $13,200)", () => {
    const r = computeQuoteTotals({
      machine,
      allOptions: opts,
      selectedOptions: [{ id: 10 }],
    });
    expect(r.optionsTotal).toBe("13200.00");
    expect(r.totalPrice).toBe("183700.00");
    expect(r.resolvedQuantities[10]).toBe(16);
  });

  it("honors client quantity override on adjustable options", () => {
    const r = computeQuoteTotals({
      machine,
      allOptions: opts,
      selectedOptions: [{ id: 10, quantity: 20 }, { id: 13, quantity: 8 }],
    });
    expect(r.optionsTotal).toBe("22060.00");
    expect(r.resolvedQuantities[10]).toBe(20);
    expect(r.resolvedQuantities[13]).toBe(8);
  });

  it("rejects quantity override on non-adjustable options", () => {
    expect(() =>
      computeQuoteTotals({
        machine,
        allOptions: opts,
        selectedOptions: [{ id: 11, quantity: 5 }],
      })
    ).toThrow(/quantity override not permitted/i);
  });

  it("rejects below-minimum quantity", () => {
    expect(() =>
      computeQuoteTotals({
        machine,
        allOptions: opts,
        selectedOptions: [{ id: 10, quantity: 1 }],
      })
    ).toThrow(/out of range/i);
  });

  it("returns optionsTotal '0.00' when no options selected", () => {
    const r = computeQuoteTotals({ machine, allOptions: opts, selectedOptions: [] });
    expect(r.optionsTotal).toBe("0.00");
    expect(r.totalPrice).toBe("170500.00");
  });

  it("throws when a selected option id is not in allOptions", () => {
    expect(() =>
      computeQuoteTotals({ machine, allOptions: opts, selectedOptions: [{ id: 999 }] })
    ).toThrow(/unknown option/i);
  });

  it("throws when a selected option belongs to a different machine", () => {
    const wrong = [...opts, { id: 99, machineId: 2, price: "100.00", quantity: 1, allowQuantityAdjustment: false, minQuantity: null, maxQuantity: null }];
    expect(() =>
      computeQuoteTotals({ machine, allOptions: wrong, selectedOptions: [{ id: 99 }] })
    ).toThrow(/wrong machine/i);
  });

  it("rejects duplicate option ids", () => {
    expect(() =>
      computeQuoteTotals({ machine, allOptions: opts, selectedOptions: [{ id: 10 }, { id: 10 }] })
    ).toThrow(/duplicate/i);
  });

  it("treats quantity 0 as $0 contribution but still includes the option", () => {
    const r = computeQuoteTotals({
      machine,
      allOptions: opts,
      selectedOptions: [{ id: 13, quantity: 0 }],
    });
    expect(r.optionsTotal).toBe("0.00");
    expect(r.resolvedQuantities[13]).toBe(0);
  });
});
