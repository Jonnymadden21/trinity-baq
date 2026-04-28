import { describe, it, expect } from "vitest";
import { renderQuoteEmail } from "../../api/_lib/email";

describe("renderQuoteEmail", () => {
  it("renders subject + html with quote details", () => {
    const r = renderQuoteEmail({
      quoteNumber: "Q-2026-0001",
      machineName: "AX2-16",
      totalPrice: "191495.50",
      customerName: "Jane Doe",
      customerEmail: "jane@example.com",
      customerCompany: "Acme",
      customerPhone: "555-0100",
      summaryUrl: "https://trinitybaq.com/quote/Q-2026-0001",
    });
    expect(r.subject).toMatch(/AX2-16/);
    expect(r.subject).toMatch(/\$191,?495\.50/);
    expect(r.html).toMatch(/Jane Doe/);
    expect(r.html).toMatch(/Q-2026-0001/);
    expect(r.html).toMatch(/jane@example\.com/);
    expect(r.text).toMatch(/Q-2026-0001/);
  });

  it("handles optional company/phone gracefully", () => {
    const r = renderQuoteEmail({
      quoteNumber: "Q-2026-0002",
      machineName: "Ai Part Loader",
      totalPrice: "115900.00",
      customerName: "Bob",
      customerEmail: "bob@example.com",
      customerCompany: null,
      customerPhone: null,
      summaryUrl: "https://trinitybaq.com/quote/Q-2026-0002",
    });
    expect(r.html).not.toMatch(/null/);
    expect(r.text).not.toMatch(/null/);
  });
});
