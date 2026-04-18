// pdf-export.ts
// Fast, crisp, vector-based PDF export for Trinity quotes.
//
// Why this replaces html2pdf.js:
//   • html2pdf.js rasterizes the entire DOM with html2canvas → 5-10s freeze,
//     giant file sizes, blurry text, dark-mode backgrounds that look bad on paper.
//   • jsPDF draws vector text directly: <1s, selectable/searchable text, tiny file,
//     clean white print-ready layout, professional brand treatment.
//
// Bundle impact: jsPDF is ~150kb gzipped vs html2pdf (~600kb). Loaded lazily.

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
  laborSaving: number;
  opCost: number;
  netBenefit: number;
  paybackMonths: number;
  year1ROI: number;
  year3ROI: number;
  year5ROI: number;
  taxSavings: number;
  hourlyOperatingCost?: number;
  powerCostPerHr?: number;
  maintenanceCostPerHr?: number;
  consumablesCostPerHr?: number;
  amortizedCostPerHr?: number;
} | null;

export type ExportQuoteArgs = {
  quote: Quote;
  options: SelectedOption[];
  financing: FinancingParams;
  roi: RoiParams;
};

// Brand palette — print-optimized
const BRAND = {
  primary: [14, 116, 144] as [number, number, number],   // teal-ish
  ink:     [22, 28, 38]   as [number, number, number],
  muted:   [110, 118, 129] as [number, number, number],
  line:    [225, 228, 232] as [number, number, number],
  accent:  [16, 185, 129]  as [number, number, number],  // emerald
  surface: [248, 250, 252] as [number, number, number],
};

const USD = (n: number, frac = 0) =>
  "$" + n.toLocaleString("en-US", {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  });

export async function exportQuotePdf({ quote, options, financing, roi }: ExportQuoteArgs) {
  // Lazy-load jsPDF so it isn't in the initial bundle
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 48; // margin
  let y = M;

  // ---- helpers ----
  const setColor = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setStroke = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

  const text = (
    s: string,
    x: number,
    yy: number,
    opts: {
      size?: number;
      weight?: "normal" | "bold";
      color?: [number, number, number];
      align?: "left" | "right" | "center";
    } = {}
  ) => {
    doc.setFont("helvetica", opts.weight ?? "normal");
    doc.setFontSize(opts.size ?? 10);
    setColor(opts.color ?? BRAND.ink);
    doc.text(s, x, yy, { align: opts.align });
  };

  const hr = (yy: number) => {
    setStroke(BRAND.line);
    doc.setLineWidth(0.5);
    doc.line(M, yy, pageW - M, yy);
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - M - 40) {
      footer();
      doc.addPage();
      y = M;
      header(false);
    }
  };

  const header = (first: boolean) => {
    // Brand strip
    setFill(BRAND.primary);
    doc.rect(0, 0, pageW, 6, "F");

    if (first) {
      // Logo mark (vector triangle)
      setStroke(BRAND.primary);
      setFill(BRAND.primary);
      doc.setLineWidth(2);
      doc.triangle(M, M + 24, M + 13, M, M + 26, M + 24, "S");
      doc.triangle(M + 5, M + 22, M + 13, M + 8, M + 21, M + 22, "F");

      text("TRINITY", M + 34, M + 10, { size: 10, weight: "bold" });
      text("AUTOMATION", M + 34, M + 22, { size: 8, weight: "bold", color: BRAND.primary });

      // Right side: quote meta
      text("SYSTEM QUOTATION", pageW - M, M + 8, {
        size: 8, weight: "bold", color: BRAND.muted, align: "right",
      });
      text(`#${quote.quoteNumber}`, pageW - M, M + 22, {
        size: 14, weight: "bold", align: "right",
      });
      text(
        new Date(quote.createdAt).toLocaleDateString("en-US", {
          year: "numeric", month: "long", day: "numeric",
        }),
        pageW - M, M + 36, { size: 9, color: BRAND.muted, align: "right" }
      );

      y = M + 60;
      hr(y);
      y += 20;
    } else {
      text("TRINITY AUTOMATION", M, M + 14, { size: 8, weight: "bold", color: BRAND.muted });
      text(`Quote #${quote.quoteNumber}`, pageW - M, M + 14, {
        size: 8, color: BRAND.muted, align: "right",
      });
      y = M + 24;
    }
  };

  const footer = () => {
    const yy = pageH - M + 16;
    setStroke(BRAND.line);
    doc.setLineWidth(0.5);
    doc.line(M, yy - 10, pageW - M, yy - 10);

    text(
      "Trinity Robotics Automation, LLC · Ontario, CA · (800) 762-6864 · sales@trinityautomation.com",
      M, yy, { size: 8, color: BRAND.muted }
    );

    const pageCount = doc.getNumberOfPages();
    const currentPage = doc.getCurrentPageInfo().pageNumber;
    text(`Page ${currentPage} of ${pageCount}`, pageW - M, yy, {
      size: 8, color: BRAND.muted, align: "right",
    });
  };

  // =============== PAGE 1 ===============
  header(true);

  // ---- Customer + Total block ----
  const colW = (pageW - M * 2 - 20) / 2;

  // Prepared For
  text("PREPARED FOR", M, y, { size: 8, weight: "bold", color: BRAND.muted });
  y += 14;
  text(quote.customerName, M, y, { size: 11, weight: "bold" });
  y += 13;
  text(quote.customerEmail, M, y, { size: 9, color: BRAND.muted });
  if (quote.customerCompany) {
    y += 12; text(quote.customerCompany, M, y, { size: 9, color: BRAND.muted });
  }
  if (quote.customerPhone) {
    y += 12; text(quote.customerPhone, M, y, { size: 9, color: BRAND.muted });
  }

  // Total (right column, same top)
  const totalY = y - (quote.customerCompany ? 25 : 13) - (quote.customerPhone ? 12 : 0);
  const totalBoxY = M + 70;
  setFill(BRAND.surface);
  doc.roundedRect(M + colW + 20, totalBoxY, colW, 66, 6, 6, "F");

  text("TOTAL SYSTEM PRICE", M + colW + 32, totalBoxY + 16, {
    size: 8, weight: "bold", color: BRAND.muted,
  });
  text(USD(quote.totalPrice, 2), M + colW + 32, totalBoxY + 42, {
    size: 22, weight: "bold", color: BRAND.primary,
  });
  if (financing) {
    text(
      `Est. ${USD(Math.round(financing.monthlyPayment))}/mo · ${financing.termMonths} mo @ ${financing.interestRate}% APR`,
      M + colW + 32, totalBoxY + 58, { size: 8, color: BRAND.muted }
    );
  }

  y = totalBoxY + 66 + 24;

  // ---- System Configuration ----
  ensureSpace(40);
  text("SYSTEM CONFIGURATION", M, y, { size: 8, weight: "bold", color: BRAND.muted });
  y += 14;

  // Machine row
  setFill(BRAND.surface);
  doc.roundedRect(M, y, pageW - M * 2, 36, 4, 4, "F");
  text(quote.machineName, M + 14, y + 15, { size: 12, weight: "bold" });
  text("Base System", M + 14, y + 28, { size: 8, color: BRAND.muted });
  text(USD(quote.basePrice, 2), pageW - M - 14, y + 23, {
    size: 12, weight: "bold", align: "right",
  });
  y += 48;

  // ---- Line-item table ----
  // Group added options
  const grouped = new Map<string, SelectedOption[]>();
  const standardGrouped = new Map<string, SelectedOption[]>();
  for (const o of options) {
    if (o.isStandard) {
      const bucket = standardGrouped.get(o.category) ?? [];
      bucket.push(o);
      standardGrouped.set(o.category, bucket);
    } else if (o.price > 0) {
      const bucket = grouped.get(o.category) ?? [];
      bucket.push(o);
      grouped.set(o.category, bucket);
    }
  }

  // Added Options
  if (grouped.size > 0) {
    ensureSpace(30);
    text("SELECTED OPTIONS", M, y, { size: 8, weight: "bold", color: BRAND.muted });
    y += 12;

    // Header row
    setFill(BRAND.surface);
    doc.rect(M, y, pageW - M * 2, 18, "F");
    text("Item", M + 10, y + 12, { size: 8, weight: "bold", color: BRAND.muted });
    text("Part #", M + 300, y + 12, { size: 8, weight: "bold", color: BRAND.muted });
    text("Price", pageW - M - 10, y + 12, { size: 8, weight: "bold", color: BRAND.muted, align: "right" });
    y += 22;

    for (const [category, opts] of grouped) {
      ensureSpace(20 + opts.length * 18);
      // Category sub-header
      text(category.toUpperCase(), M, y, { size: 8, weight: "bold", color: BRAND.primary });
      const subtotal = opts.reduce((s, o) => s + o.price, 0);
      text(`Subtotal ${USD(subtotal)}`, pageW - M, y, {
        size: 8, color: BRAND.muted, align: "right",
      });
      y += 10;
      setStroke(BRAND.line);
      doc.line(M, y, pageW - M, y);
      y += 8;

      for (const o of opts) {
        ensureSpace(18);
        // zebra-stripe
        const rowIdx = opts.indexOf(o);
        if (rowIdx % 2 === 1) {
          setFill([252, 253, 254]);
          doc.rect(M, y - 10, pageW - M * 2, 18, "F");
        }
        // truncate name to ~55 chars
        const name = o.name.length > 55 ? o.name.slice(0, 52) + "…" : o.name;
        text(name, M + 10, y + 2, { size: 9 });
        if (o.partNumber) {
          text(o.partNumber, M + 300, y + 2, { size: 8, color: BRAND.muted });
        }
        text(USD(o.price), pageW - M - 10, y + 2, { size: 9, weight: "bold", align: "right" });
        y += 16;
      }
      y += 6;
    }
  }

  // Standard features (condensed)
  if (standardGrouped.size > 0) {
    ensureSpace(24);
    y += 6;
    text("STANDARD FEATURES INCLUDED", M, y, {
      size: 8, weight: "bold", color: BRAND.muted,
    });
    y += 12;
    for (const [category, opts] of standardGrouped) {
      ensureSpace(18);
      text(`${category}:`, M, y, { size: 8, weight: "bold" });
      const names = opts.map((o) => o.name).join(" · ");
      const wrapped = doc.splitTextToSize(names, pageW - M * 2 - 80);
      text(wrapped, M + 80, y, { size: 8, color: BRAND.muted });
      y += 12 * (Array.isArray(wrapped) ? wrapped.length : 1) + 4;
    }
  }

  // ---- Totals ----
  y += 8;
  ensureSpace(90);
  hr(y);
  y += 14;

  const rightCol = pageW - M;
  const labelCol = pageW - M - 160;

  text("Base System", labelCol, y, { size: 10, color: BRAND.muted });
  text(USD(quote.basePrice, 2), rightCol, y, { size: 10, weight: "bold", align: "right" });
  y += 16;

  if (quote.optionsTotal > 0) {
    text("Options Total", labelCol, y, { size: 10, color: BRAND.muted });
    text(USD(quote.optionsTotal, 2), rightCol, y, { size: 10, weight: "bold", align: "right" });
    y += 16;
  }
  text("Tax", labelCol, y, { size: 10, color: BRAND.muted });
  text("TBD", rightCol, y, { size: 10, color: BRAND.muted, align: "right" });
  y += 16;
  text("Freight / Rigging", labelCol, y, { size: 10, color: BRAND.muted });
  text("TBD", rightCol, y, { size: 10, color: BRAND.muted, align: "right" });
  y += 10;
  setStroke(BRAND.ink);
  doc.setLineWidth(1);
  doc.line(labelCol, y, rightCol, y);
  y += 16;
  text("SYSTEM TOTAL", labelCol, y, { size: 11, weight: "bold" });
  text(USD(quote.totalPrice, 2), rightCol, y, {
    size: 16, weight: "bold", color: BRAND.primary, align: "right",
  });
  y += 24;

  // =============== PAGE 2 — Financials ===============
  if (financing || roi) {
    doc.addPage();
    y = M;
    header(false);
    y += 10;

    if (financing) {
      text("FINANCING SUMMARY", M, y, { size: 10, weight: "bold" });
      y += 18;
      setFill(BRAND.surface);
      doc.roundedRect(M, y, pageW - M * 2, 56, 6, 6, "F");
      text("ESTIMATED MONTHLY PAYMENT", M + 14, y + 16, {
        size: 8, weight: "bold", color: BRAND.muted,
      });
      text(`${USD(Math.round(financing.monthlyPayment))}/mo`, M + 14, y + 42, {
        size: 20, weight: "bold", color: BRAND.primary,
      });
      y += 70;

      const rows: Array<[string, string]> = [
        [`Down Payment (${financing.downPaymentPct}%)`, USD(Math.round(financing.downPayment))],
        ["Financed Amount", USD(Math.round(financing.financedAmount))],
        ["Term / Rate", `${financing.termMonths} months @ ${financing.interestRate}% APR`],
        ["Total Cost of Financing", USD(Math.round(financing.totalCost))],
      ];
      for (const [l, v] of rows) {
        text(l, M, y, { size: 10, color: BRAND.muted });
        text(v, pageW - M, y, { size: 10, weight: "bold", align: "right" });
        y += 16;
      }
      y += 12;
    }

    if (roi) {
      ensureSpace(200);
      text("RETURN ON INVESTMENT", M, y, { size: 10, weight: "bold" });
      y += 18;

      // KPI strip (4 boxes)
      const kpiW = (pageW - M * 2 - 24) / 4;
      const kpiH = 54;
      const kpis: Array<[string, string, [number, number, number]]> = [
        [
          "PAYBACK",
          roi.paybackMonths > 0 && roi.paybackMonths < 999
            ? `${roi.paybackMonths.toFixed(1)} mo` : "—",
          BRAND.accent,
        ],
        ["NET / YEAR", USD(Math.round(roi.netBenefit)), BRAND.accent],
        ["YEAR 5 ROI", `${Math.round(roi.year5ROI)}%`, BRAND.accent],
        ["CAPACITY", `${roi.capacityMult.toFixed(1)}x`, BRAND.primary],
      ];
      kpis.forEach(([label, value, color], i) => {
        const x = M + i * (kpiW + 8);
        setFill(BRAND.surface);
        doc.roundedRect(x, y, kpiW, kpiH, 6, 6, "F");
        text(label, x + 10, y + 14, { size: 7, weight: "bold", color: BRAND.muted });
        text(value, x + 10, y + 38, { size: 14, weight: "bold", color });
      });
      y += kpiH + 20;

      const roiRows: Array<[string, string]> = [
        ["New Revenue (Utilization Gains)", USD(Math.round(roi.totalGainRev))],
        ["Labor Reallocation Value", USD(Math.round(roi.laborSaving))],
        ["Operating Costs", `-${USD(Math.round(roi.opCost))}`],
        ["Net Annual Benefit", USD(Math.round(roi.netBenefit))],
      ];
      for (const [l, v] of roiRows) {
        text(l, M, y, { size: 10, color: BRAND.muted });
        text(v, pageW - M, y, { size: 10, weight: "bold", align: "right" });
        y += 16;
      }
      y += 8;
      text(
        `${roi.mannedShifts} manned + ${roi.unmannedShifts} unmanned shifts · $${roi.shopRate}/hr shop rate · Sec. 179 savings ${USD(Math.round(roi.taxSavings))}`,
        M, y, { size: 8, color: BRAND.muted }
      );
      y += 24;

      // ===== HOURLY OPERATING COST — new, user-requested =====
      ensureSpace(170);
      text("HOURLY OPERATING COST", M, y, { size: 10, weight: "bold" });
      y += 18;

      const totalScheduledHrs =
        (roi.mannedShifts + roi.unmannedShifts) * roi.hrsPerShift * roi.workingDays;

      const power  = roi.powerCostPerHr        ?? 1.8;
      const maint  = roi.maintenanceCostPerHr  ?? 1.2;
      const consum = roi.consumablesCostPerHr  ?? 2.0;
      const amort  = roi.amortizedCostPerHr    ??
        (totalScheduledHrs > 0 ? quote.totalPrice / (totalScheduledHrs * 5) : 0);
      const total  = roi.hourlyOperatingCost   ?? power + maint + consum + amort;

      // Headline box
      setFill(BRAND.surface);
      doc.roundedRect(M, y, pageW - M * 2, 52, 6, 6, "F");
      text("TOTAL COST TO OPERATE", M + 14, y + 16, {
        size: 8, weight: "bold", color: BRAND.muted,
      });
      text(`${USD(total, 2)}/hr`, M + 14, y + 40, {
        size: 20, weight: "bold", color: BRAND.primary,
      });
      text(
        `Based on ${totalScheduledHrs.toLocaleString()} scheduled hours per year`,
        pageW - M - 14, y + 40, { size: 8, color: BRAND.muted, align: "right" }
      );
      y += 64;

      // Breakdown rows with bars
      const breakdown: Array<[string, number]> = [
        ["Power & Utilities", power],
        ["Scheduled Maintenance", maint],
        ["Consumables (grippers, jaws, filters)", consum],
        ["Amortized Capital (5-yr straight-line)", amort],
      ];
      for (const [label, val] of breakdown) {
        ensureSpace(24);
        text(label, M, y, { size: 9, color: BRAND.ink });
        text(`${USD(val, 2)}/hr`, pageW - M, y, {
          size: 9, weight: "bold", align: "right",
        });
        y += 6;
        // bar
        const barW = pageW - M * 2;
        setFill([235, 238, 242]);
        doc.roundedRect(M, y, barW, 4, 2, 2, "F");
        setFill(BRAND.primary);
        const pct = total > 0 ? Math.min(1, val / total) : 0;
        doc.roundedRect(M, y, barW * pct, 4, 2, 2, "F");
        y += 14;
      }

      y += 8;
      text(
        "Operating cost estimates are industry averages; actual costs depend on facility rates and utilization. Amortized capital assumes 5-year straight-line depreciation across scheduled runtime.",
        M, y, { size: 7, color: BRAND.muted }
      );
      const wrapped = doc.splitTextToSize(
        "Operating cost estimates are industry averages; actual costs depend on facility rates and utilization. Amortized capital assumes 5-year straight-line depreciation across scheduled runtime.",
        pageW - M * 2
      );
      doc.setFontSize(7);
      doc.text(wrapped, M, y);
      y += 10 * (Array.isArray(wrapped) ? wrapped.length : 1);
    }
  }

  // ---- Details page ----
  ensureSpace(100);
  y += 20;
  text("TERMS & DETAILS", M, y, { size: 10, weight: "bold" });
  y += 16;
  const details: Array<[string, string]> = [
    ["Lead Time", "8 Weeks from signed PO"],
    ["FOB", "Ontario, CA 91761"],
    ["Warranty", "1 Year Standard · Extended options available"],
    ["Quote Valid", "60 Days from issue date"],
    ["Payment Terms", "Net 30 · Financing available"],
  ];
  for (const [l, v] of details) {
    text(l, M, y, { size: 9, color: BRAND.muted });
    text(v, M + 140, y, { size: 9, weight: "bold" });
    y += 14;
  }

  // Stamp all pages with footer
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    footer();
  }

  // --- Merge product brochure if one exists for this machine ---
  const brochureMap: Record<string, string> = {
    "ax1-12": "ax1.pdf", "ax1-18": "ax1.pdf",
    "ax2-16": "ax2.pdf", "ax2-24": "ax2.pdf",
    "ax2-16-duo": "ax2-duo.pdf", "ax2-24-duo": "ax2-duo.pdf",
    "ax4-12": "ax4.pdf", "ax4-12-hd": "ax4.pdf",
    "ax5-20": "ax5.pdf",
    "ax5-20-hd": "ax5-hd.pdf",
  };

  const machineSlug = quote.machineName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const brochureFile = brochureMap[machineSlug];

  if (brochureFile) {
    try {
      const { PDFDocument } = await import("pdf-lib");
      const quoteBytes = doc.output("arraybuffer");
      const brochureBytes = await fetch(`/brochures/${brochureFile}`).then((r) => r.arrayBuffer());

      const merged = await PDFDocument.create();
      const quotePdf = await PDFDocument.load(quoteBytes);
      const brochurePdf = await PDFDocument.load(brochureBytes);

      const quotePages = await merged.copyPages(quotePdf, quotePdf.getPageIndices());
      for (const page of quotePages) merged.addPage(page);

      const brochurePages = await merged.copyPages(brochurePdf, brochurePdf.getPageIndices());
      for (const page of brochurePages) merged.addPage(page);

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
