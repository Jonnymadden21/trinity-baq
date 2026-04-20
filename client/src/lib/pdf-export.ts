import type { Quote } from "@shared/schema";

type SelectedOption = {
  id: number;
  name: string;
  partNumber: string | null;
  price: number;
  isStandard: boolean;
  category: string;
};

type FinancingParams = {
  downPaymentPct: number;
  termMonths: number;
  interestRate: number;
  downPayment: number;
  financedAmount: number;
  monthlyPayment: number;
  totalCost: number;
} | null;

type RoiParams = {
  shopRate: number;
  hrsPerShift: number;
  operatorWage: number;
  workingDays: number;
  mannedShifts: number;
  unmannedShifts: number;
  capacityMult: number;
  totalGainRev: number;
  mannedGainRev: number;
  unmannedGainRev: number;
  mannedGainHrs: number;
  unmannedGainHrs: number;
  laborSaving: number;
  netBenefit: number;
  paybackMonths: number;
  year1ROI: number;
  year3ROI: number;
  year5ROI: number;
  taxSavings: number;
  effectiveCost: number;
} | null;

export type ExportQuoteArgs = {
  quote: Quote;
  options: SelectedOption[];
  financing: FinancingParams;
  roi: RoiParams;
};

const BRAND = {
  primary: [14, 116, 144] as [number, number, number],
  ink:     [22, 28, 38]   as [number, number, number],
  muted:   [110, 118, 129] as [number, number, number],
  line:    [225, 228, 232] as [number, number, number],
  accent:  [16, 185, 129]  as [number, number, number],
  surface: [248, 250, 252] as [number, number, number],
  red:     [220, 80, 80]   as [number, number, number],
};

const USD = (n: number, frac = 0) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: frac, maximumFractionDigits: frac });

export async function exportQuotePdf({ quote, options, financing, roi }: ExportQuoteArgs) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;

  const setColor = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setStroke = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

  const text = (
    s: string, x: number, yy: number,
    opts: { size?: number; weight?: "normal" | "bold"; color?: [number, number, number]; align?: "left" | "right" | "center" } = {}
  ) => {
    doc.setFont("helvetica", opts.weight ?? "normal");
    doc.setFontSize(opts.size ?? 10);
    setColor(opts.color ?? BRAND.ink);
    doc.text(s, x, yy, { align: opts.align });
  };

  const hr = (yy: number) => {
    setStroke(BRAND.line); doc.setLineWidth(0.5); doc.line(M, yy, pageW - M, yy);
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - M - 40) { footer(); doc.addPage(); y = M; header(false); }
  };

  const header = (first: boolean) => {
    setFill(BRAND.primary);
    doc.rect(0, 0, pageW, 6, "F");

    if (first) {
      text("TRINITY", M, M + 12, { size: 11, weight: "bold" });
      text("AUTOMATION", M, M + 24, { size: 9, weight: "bold", color: BRAND.primary });
      text("SYSTEM QUOTATION", pageW - M, M + 10, { size: 8, weight: "bold", color: BRAND.muted, align: "right" });
      text(`#${quote.quoteNumber}`, pageW - M, M + 24, { size: 14, weight: "bold", align: "right" });
      text(
        new Date(quote.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
        pageW - M, M + 38, { size: 9, color: BRAND.muted, align: "right" }
      );
      y = M + 54; hr(y); y += 20;
    } else {
      text("TRINITY AUTOMATION", M, M + 14, { size: 8, weight: "bold", color: BRAND.muted });
      text(`Quote #${quote.quoteNumber}`, pageW - M, M + 14, { size: 8, color: BRAND.muted, align: "right" });
      y = M + 28;
    }
  };

  const footer = () => {
    const yy = pageH - M + 16;
    hr(yy - 10);
    text("Trinity Robotics Automation, LLC · Ontario, CA · (800) 762-6864 · sales@trinityautomation.com", M, yy, { size: 7, color: BRAND.muted });
    const pageCount = doc.getNumberOfPages();
    const currentPage = doc.getCurrentPageInfo().pageNumber;
    text(`Page ${currentPage} of ${pageCount}`, pageW - M, yy, { size: 7, color: BRAND.muted, align: "right" });
  };

  // =============== PAGE 1 — QUOTE ===============
  header(true);

  // Customer info
  text("PREPARED FOR", M, y, { size: 8, weight: "bold", color: BRAND.muted });
  y += 14;
  text(quote.customerName, M, y, { size: 11, weight: "bold" });
  y += 13;
  text(quote.customerEmail, M, y, { size: 9, color: BRAND.muted });
  if (quote.customerCompany) { y += 12; text(quote.customerCompany, M, y, { size: 9, color: BRAND.muted }); }
  if (quote.customerPhone) { y += 12; text(quote.customerPhone, M, y, { size: 9, color: BRAND.muted }); }

  // Total price box (right)
  const colW = (pageW - M * 2 - 20) / 2;
  const boxY = M + 66;
  setFill(BRAND.surface);
  doc.roundedRect(M + colW + 20, boxY, colW, 60, 6, 6, "F");
  text("TOTAL SYSTEM PRICE", M + colW + 32, boxY + 16, { size: 8, weight: "bold", color: BRAND.muted });
  text(USD(quote.totalPrice, 2), M + colW + 32, boxY + 40, { size: 22, weight: "bold", color: BRAND.primary });
  if (financing) {
    text(`Est. ${USD(Math.round(financing.monthlyPayment))}/mo · ${financing.termMonths} mo @ ${financing.interestRate}% APR`, M + colW + 32, boxY + 54, { size: 8, color: BRAND.muted });
  }
  y = boxY + 76;

  // System configuration
  text("SYSTEM CONFIGURATION", M, y, { size: 8, weight: "bold", color: BRAND.muted });
  y += 14;
  setFill(BRAND.surface);
  doc.roundedRect(M, y, pageW - M * 2, 32, 4, 4, "F");
  text(quote.machineName, M + 12, y + 14, { size: 12, weight: "bold" });
  text("Base System", M + 12, y + 26, { size: 8, color: BRAND.muted });
  text(USD(quote.basePrice, 2), pageW - M - 12, y + 20, { size: 12, weight: "bold", align: "right" });
  y += 44;

  // Selected options table
  const grouped = new Map<string, SelectedOption[]>();
  const standardGrouped = new Map<string, SelectedOption[]>();
  for (const o of options) {
    const target = o.isStandard ? standardGrouped : (o.price > 0 ? grouped : null);
    if (!target) continue;
    const bucket = target.get(o.category) ?? [];
    bucket.push(o);
    target.set(o.category, bucket);
  }

  if (grouped.size > 0) {
    ensureSpace(30);
    text("SELECTED OPTIONS", M, y, { size: 8, weight: "bold", color: BRAND.muted });
    y += 14;
    for (const [category, opts] of grouped) {
      ensureSpace(20 + opts.length * 16);
      text(category.toUpperCase(), M, y, { size: 7, weight: "bold", color: BRAND.primary });
      y += 10;
      for (const o of opts) {
        ensureSpace(16);
        const name = o.name.length > 60 ? o.name.slice(0, 57) + "…" : o.name;
        text(name, M + 8, y, { size: 9 });
        if (o.partNumber) text(o.partNumber, M + 310, y, { size: 8, color: BRAND.muted });
        text(USD(o.price), pageW - M, y, { size: 9, weight: "bold", align: "right" });
        y += 14;
      }
      y += 4;
    }
  }

  // Standard features
  if (standardGrouped.size > 0) {
    ensureSpace(24);
    y += 4;
    text("STANDARD FEATURES INCLUDED", M, y, { size: 8, weight: "bold", color: BRAND.muted });
    y += 12;
    for (const [category, opts] of standardGrouped) {
      ensureSpace(16);
      const names = opts.map((o) => o.name).join(" · ");
      const wrapped = doc.splitTextToSize(`${category}: ${names}`, pageW - M * 2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setColor(BRAND.muted);
      doc.text(wrapped, M, y);
      y += 11 * (Array.isArray(wrapped) ? wrapped.length : 1) + 2;
    }
  }

  // Totals
  y += 8;
  ensureSpace(80);
  hr(y); y += 14;
  const rc = pageW - M;
  const lc = pageW - M - 160;
  text("Base System", lc, y, { size: 10, color: BRAND.muted });
  text(USD(quote.basePrice, 2), rc, y, { size: 10, weight: "bold", align: "right" }); y += 16;
  if (quote.optionsTotal > 0) {
    text("Options Total", lc, y, { size: 10, color: BRAND.muted });
    text(USD(quote.optionsTotal, 2), rc, y, { size: 10, weight: "bold", align: "right" }); y += 16;
  }
  text("Tax", lc, y, { size: 10, color: BRAND.muted });
  text("TBD", rc, y, { size: 10, color: BRAND.muted, align: "right" }); y += 16;
  text("Freight / Rigging", lc, y, { size: 10, color: BRAND.muted });
  text("TBD", rc, y, { size: 10, color: BRAND.muted, align: "right" }); y += 10;
  setStroke(BRAND.ink); doc.setLineWidth(1); doc.line(lc, y, rc, y); y += 16;
  text("SYSTEM TOTAL", lc, y, { size: 11, weight: "bold" });
  text(USD(quote.totalPrice, 2), rc, y, { size: 16, weight: "bold", color: BRAND.primary, align: "right" }); y += 24;

  // =============== PAGE 2 — FINANCING + ROI ===============
  if (financing || roi) {
    doc.addPage(); y = M; header(false); y += 10;

    if (financing) {
      text("FINANCING SUMMARY", M, y, { size: 10, weight: "bold" }); y += 18;
      setFill(BRAND.surface);
      doc.roundedRect(M, y, pageW - M * 2, 52, 6, 6, "F");
      text("ESTIMATED MONTHLY PAYMENT", M + 14, y + 14, { size: 8, weight: "bold", color: BRAND.muted });
      text(`${USD(Math.round(financing.monthlyPayment))}/mo`, M + 14, y + 38, { size: 20, weight: "bold", color: BRAND.primary });
      y += 66;

      const rows: [string, string][] = [
        [`Down Payment (${financing.downPaymentPct}%)`, USD(Math.round(financing.downPayment))],
        ["Financed Amount", USD(Math.round(financing.financedAmount))],
        ["Term / Rate", `${financing.termMonths} months @ ${financing.interestRate}% APR`],
        ["Total Cost of Financing", USD(Math.round(financing.totalCost))],
      ];
      for (const [l, v] of rows) {
        text(l, M, y, { size: 10, color: BRAND.muted });
        text(v, pageW - M, y, { size: 10, weight: "bold", align: "right" }); y += 16;
      }

      if (roi && roi.netBenefit > 0) {
        y += 8;
        setFill(BRAND.surface);
        doc.roundedRect(M, y, pageW - M * 2, 34, 6, 6, "F");
        const monthlyBenefit = Math.round(roi.netBenefit / 12);
        text(`Monthly payment ${USD(Math.round(financing.monthlyPayment))} vs. monthly benefit ${USD(monthlyBenefit)}`, M + 14, y + 14, { size: 9, color: BRAND.muted });
        if (monthlyBenefit > financing.monthlyPayment) {
          text("This system pays for itself from day one.", M + 14, y + 26, { size: 9, weight: "bold", color: BRAND.accent });
        }
        y += 46;
      } else {
        y += 16;
      }
    }

    if (roi) {
      ensureSpace(200);
      text("RETURN ON INVESTMENT", M, y, { size: 10, weight: "bold" }); y += 18;

      // KPI boxes
      const kpiW = (pageW - M * 2 - 24) / 4;
      const kpiH = 50;
      const kpis: [string, string, [number, number, number]][] = [
        ["NET ANNUAL BENEFIT", USD(Math.round(roi.netBenefit)), BRAND.accent],
        ["PAYBACK PERIOD", roi.paybackMonths > 0 && roi.paybackMonths < 120 ? `${roi.paybackMonths.toFixed(1)} mo` : "120+", BRAND.accent],
        ["YEAR 5 ROI", `${Math.round(roi.year5ROI)}%`, BRAND.accent],
        ["CAPACITY", `${roi.capacityMult.toFixed(1)}x`, BRAND.primary],
      ];
      kpis.forEach(([label, value, color], i) => {
        const x = M + i * (kpiW + 8);
        setFill(BRAND.surface);
        doc.roundedRect(x, y, kpiW, kpiH, 6, 6, "F");
        text(label, x + 8, y + 14, { size: 6, weight: "bold", color: BRAND.muted });
        text(value, x + 8, y + 36, { size: 14, weight: "bold", color });
      });
      y += kpiH + 16;

      // ROI timeline
      text("ROI TIMELINE", M, y, { size: 8, weight: "bold", color: BRAND.muted }); y += 14;
      const roiYears: [string, string][] = [
        ["Year 1", `${Math.round(roi.year1ROI)}%`],
        ["Year 3", `${Math.round(roi.year3ROI)}%`],
        ["Year 5", `${Math.round(roi.year5ROI)}%`],
      ];
      const tW = (pageW - M * 2 - 16) / 3;
      roiYears.forEach(([label, value], i) => {
        const x = M + i * (tW + 8);
        setFill(BRAND.surface);
        doc.roundedRect(x, y, tW, 32, 4, 4, "F");
        text(label, x + 10, y + 13, { size: 8, color: BRAND.muted });
        text(value, x + tW - 10, y + 13, { size: 14, weight: "bold", color: BRAND.accent, align: "right" });
      });
      y += 44;

      // Annual breakdown
      text("ANNUAL BENEFIT BREAKDOWN", M, y, { size: 8, weight: "bold", color: BRAND.muted }); y += 14;

      const breakdownRows: [string, string, string, [number, number, number]][] = [
        ["Manned Shift Improvement", `${roi.mannedGainHrs?.toFixed(1) ?? "—"} hrs/day × $${roi.shopRate} × ${roi.workingDays} days`, USD(Math.round(roi.mannedGainRev ?? 0)), BRAND.ink],
      ];
      if (roi.unmannedShifts > 0) {
        breakdownRows.push(
          ["Unmanned Shift — NEW Revenue", `${roi.unmannedGainHrs?.toFixed(1) ?? "—"} hrs/day × $${roi.shopRate} × ${roi.workingDays} days`, USD(Math.round(roi.unmannedGainRev ?? 0)), BRAND.ink]
        );
      }
      breakdownRows.push(
        ["Labor Reallocation Value", `${roi.mannedGainHrs?.toFixed(1) ?? "—"} hrs × $${roi.operatorWage} × ${roi.workingDays} days × 50%`, USD(Math.round(roi.laborSaving)), BRAND.ink]
      );

      for (const [label, detail, value, color] of breakdownRows) {
        ensureSpace(28);
        text(label, M, y, { size: 9, color });
        text(value, pageW - M, y, { size: 9, weight: "bold", color: BRAND.accent, align: "right" });
        y += 11;
        text(detail, M, y, { size: 7, color: BRAND.muted });
        y += 14;
      }

      // Net total
      y += 2;
      setStroke(BRAND.ink); doc.setLineWidth(0.75); doc.line(M, y, pageW - M, y); y += 14;
      text("NET ANNUAL BENEFIT", M, y, { size: 11, weight: "bold" });
      text(USD(Math.round(roi.netBenefit)), pageW - M, y, { size: 16, weight: "bold", color: BRAND.accent, align: "right" });
      y += 24;

      // Section 179
      ensureSpace(60);
      setFill(BRAND.surface);
      doc.roundedRect(M, y, pageW - M * 2, 44, 6, 6, "F");
      text("SECTION 179 TAX BENEFIT", M + 14, y + 14, { size: 8, weight: "bold", color: BRAND.muted });
      text(`Tax Savings: ${USD(Math.round(roi.taxSavings))}  ·  Effective Cost: ${USD(Math.round(roi.effectiveCost))}  ·  Adjusted Payback: ${roi.paybackMonths > 0 && roi.paybackMonths < 120 ? (roi.paybackMonths * 0.79).toFixed(1) + " mo" : "—"}`, M + 14, y + 32, { size: 9, color: BRAND.ink });
      y += 56;

      // Footnote
      text(`Based on ${roi.mannedShifts} manned + ${roi.unmannedShifts} unmanned shifts · ${roi.hrsPerShift} hrs/shift · $${roi.shopRate}/hr shop rate · ${roi.workingDays} working days/year`, M, y, { size: 7, color: BRAND.muted });
      y += 20;
    }
  }

  // Terms & Details
  ensureSpace(100);
  y += 10;
  text("TERMS & DETAILS", M, y, { size: 10, weight: "bold" }); y += 16;
  const details: [string, string][] = [
    ["Lead Time", "8 Weeks from signed PO"],
    ["FOB", "Ontario, CA 91761"],
    ["Warranty", "1 Year Standard · Extended options available"],
    ["Quote Valid", "60 Days from issue date"],
    ["Payment Terms", "Net 30 · Financing available"],
  ];
  for (const [l, v] of details) {
    text(l, M, y, { size: 9, color: BRAND.muted });
    text(v, M + 140, y, { size: 9, weight: "bold" }); y += 14;
  }

  // Stamp footers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) { doc.setPage(i); footer(); }

  // --- Merge brochures ---
  const brochureMap: Record<string, string[]> = {
    "ax1-12": ["ax1-spec.pdf"], "ax1-18": ["ax1-spec.pdf"],
    "ax2-16": ["ax2-brochure.pdf", "ax2-spec.pdf"], "ax2-24": ["ax2-brochure.pdf", "ax2-spec.pdf"],
    "ax2-16-duo": ["ax2-duo-brochure.pdf", "ax2-duo-spec.pdf"], "ax2-24-duo": ["ax2-duo-brochure.pdf", "ax2-duo-spec.pdf"],
    "ax4-12": ["ax4-spec.pdf"], "ax4-12-hd": ["ax4-spec.pdf"],
    "ax5-20": ["ax5-brochure.pdf", "ax5-spec.pdf"],
    "ax5-20-hd": ["ax5-hd-brochure.pdf"],
  };

  const machineSlug = quote.machineName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const brochureFiles = brochureMap[machineSlug];

  if (brochureFiles && brochureFiles.length > 0) {
    try {
      const { PDFDocument } = await import("pdf-lib");
      const quoteBytes = doc.output("arraybuffer");
      const merged = await PDFDocument.create();
      const quotePdf = await PDFDocument.load(quoteBytes);
      const quotePages = await merged.copyPages(quotePdf, quotePdf.getPageIndices());
      for (const page of quotePages) merged.addPage(page);
      for (const file of brochureFiles) {
        const bytes = await fetch(`/brochures/${file}`).then((r) => r.arrayBuffer());
        const brochurePdf = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(brochurePdf, brochurePdf.getPageIndices());
        for (const page of pages) merged.addPage(page);
      }
      const mergedBytes = await merged.save();
      const blob = new Blob([mergedBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Trinity-Quote-${quote.quoteNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    } catch (err) {
      console.warn("Brochure merge failed, saving quote only:", err);
    }
  }

  doc.save(`Trinity-Quote-${quote.quoteNumber}.pdf`);
}
