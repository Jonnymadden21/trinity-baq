import type { Quote } from "@shared/schema";

type SelectedOption = { id: number; name: string; partNumber: string | null; price: number; isStandard: boolean; category: string };
type FinancingParams = { downPaymentPct: number; termMonths: number; interestRate: number; downPayment: number; financedAmount: number; monthlyPayment: number; totalCost: number } | null;
type RoiParams = { shopRate: number; hrsPerShift: number; operatorWage: number; workingDays: number; mannedShifts: number; unmannedShifts: number; capacityMult: number; totalGainRev: number; mannedGainRev: number; unmannedGainRev: number; mannedGainHrs: number; unmannedGainHrs: number; laborSaving: number; netBenefit: number; paybackMonths: number; year1ROI: number; year3ROI: number; year5ROI: number; taxSavings: number; effectiveCost: number } | null;

export type ExportQuoteArgs = { quote: Quote; options: SelectedOption[]; financing: FinancingParams; roi: RoiParams };

const C = {
  gold:    [212, 168, 67]  as [number, number, number],
  ink:     [26, 28, 32]    as [number, number, number],
  dark:    [45, 45, 45]    as [number, number, number],
  muted:   [120, 120, 120] as [number, number, number],
  light:   [245, 245, 245] as [number, number, number],
  white:   [255, 255, 255] as [number, number, number],
  green:   [16, 160, 110]  as [number, number, number],
  hdrBg:   [75, 75, 75]    as [number, number, number],
  rowAlt:  [250, 250, 250] as [number, number, number],
};

const USD = (n: number, frac = 0) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: frac, maximumFractionDigits: frac });

export async function exportQuotePdf({ quote, options, financing, roi }: ExportQuoteArgs) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 50;
  let y = 0;

  const txt = (s: string, x: number, yy: number, o: { sz?: number; w?: "normal" | "bold"; c?: [number, number, number]; a?: "left" | "right" | "center" } = {}) => {
    doc.setFont("helvetica", o.w ?? "normal"); doc.setFontSize(o.sz ?? 10);
    doc.setTextColor(o.c?.[0] ?? 26, o.c?.[1] ?? 28, o.c?.[2] ?? 32);
    doc.text(s, x, yy, { align: o.a });
  };
  const fill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
  const hr = (yy: number) => { stroke(C.light); doc.setLineWidth(0.5); doc.line(M, yy, W - M, yy); };
  const cw = W - M * 2;

  const pageFooter = () => {
    const fy = H - 36;
    fill(C.gold); doc.triangle(W / 2 - 12, fy - 18, W / 2, fy - 30, W / 2 + 12, fy - 18, "F");
    txt("Trinity", W / 2, fy - 8, { sz: 10, w: "bold", c: C.dark, a: "center" });
    txt("Trinityautomation.com  •  Sales@trinityautomation.com  •  (800) 762-6864", W / 2, fy + 6, { sz: 7, c: C.muted, a: "center" });
    txt("NorCal - 431 Nelo Street Santa Clara, CA 95054  •  SoCal - 4582 Brickell Privado Ontario, CA 91761", W / 2, fy + 14, { sz: 7, c: C.muted, a: "center" });
    const pn = doc.getCurrentPageInfo().pageNumber;
    const pt = doc.getNumberOfPages();
    txt(`Page ${pn} | ${pt}`, W - M, fy + 14, { sz: 7, c: C.muted, a: "right" });
  };

  const ensureSpace = (need: number) => {
    if (y + need > H - 60) { pageFooter(); doc.addPage(); y = M; pageHeader(); }
  };

  const pageHeader = () => {
    fill(C.gold); doc.triangle(M, 28, M + 10, 14, M + 20, 28, "F");
    txt("Trinity", M + 24, 24, { sz: 11, w: "bold", c: C.dark });
    txt("Automated Pallet Systems", M + 24, 34, { sz: 7, c: C.muted });
    const series = quote.machineName.startsWith("Ai") ? "Ai" : "AX";
    txt(`${series} Automation Sales Quotation`, W - M, 18, { sz: 11, w: "bold", c: C.dark, a: "right" });
    txt(`Quotation: ${quote.quoteNumber}`, W - M, 30, { sz: 9, c: C.muted, a: "right" });
    txt(`Date: ${new Date(quote.createdAt).toLocaleDateString()}`, W - M, 40, { sz: 9, c: C.muted, a: "right" });
    hr(46);
    y = 58;
  };

  // ============ PAGE 1: COVER ============
  fill(C.gold); doc.triangle(M, 38, M + 16, 14, M + 32, 38, "F");
  txt("Trinity", M + 38, 30, { sz: 16, w: "bold", c: C.dark });
  txt("Automated Machine Tending", M, 48, { sz: 8, w: "bold", c: C.dark });
  const series = quote.machineName.startsWith("Ai") ? "Ai" : "AX";
  txt(`${series} Automation Sales Quotation`, W - M, 22, { sz: 14, w: "bold", c: C.dark, a: "right" });
  txt(`Quotation: ${quote.quoteNumber}`, W - M, 36, { sz: 10, c: C.muted, a: "right" });
  txt(`Date: ${new Date(quote.createdAt).toLocaleDateString()}`, W - M, 48, { sz: 10, c: C.muted, a: "right" });

  // Machine title area
  y = 100;
  fill(C.light); doc.roundedRect(M, y, cw, 100, 6, 6, "F");
  txt(`Trinity ${series} Series`, M + 20, y + 30, { sz: 22, w: "bold", c: C.dark });
  txt(quote.machineName, M + 20, y + 55, { sz: 16, w: "bold", c: C.gold });
  txt("Automated CNC Production Made Easy", M + 20, y + 75, { sz: 10, c: C.muted });

  // Prepared For / Trinity Contact
  y = 240;
  hr(y); y += 20;
  const halfW = cw / 2;

  txt("Prepared For:", M, y, { sz: 10, c: C.muted });
  y += 16;
  txt(quote.customerName, M + 10, y, { sz: 10, w: "bold" });
  if (quote.customerPhone) { y += 13; txt(quote.customerPhone, M + 10, y, { sz: 9, c: C.muted }); }
  txt(quote.customerEmail, M + 10, y + 13, { sz: 9, c: C.muted });
  if (quote.customerCompany) { txt(quote.customerCompany, M + 10, y + 26, { sz: 9, c: C.muted }); }

  const contactY = 256;
  txt("Trinity Contact:", M + halfW, contactY, { sz: 10, c: C.muted });
  txt("Trinity Automation", M + halfW + 10, contactY + 16, { sz: 10, w: "bold" });
  txt("(800) 762-6864", M + halfW + 10, contactY + 29, { sz: 9, c: C.muted });
  txt("sales@trinityautomation.com", M + halfW + 10, contactY + 42, { sz: 9, c: C.muted });
  txt("4582 Brickell Privado", M + halfW + 10, contactY + 55, { sz: 9, c: C.muted });
  txt("Ontario, CA 91761", M + halfW + 10, contactY + 68, { sz: 9, c: C.muted });

  pageFooter();

  // ============ PAGE 2: CONFIGURATION + STANDARD PRODUCTS ============
  doc.addPage(); y = M; pageHeader();

  txt("Configuration Details", M, y, { sz: 14, w: "bold" }); y += 4;
  fill(C.gold); doc.rect(M, y, 60, 2, "F"); y += 14;

  // 3-column config table
  const col3W = cw / 3;
  fill(C.hdrBg);
  doc.rect(M, y, col3W, 18, "F"); doc.rect(M + col3W, y, col3W, 18, "F"); doc.rect(M + col3W * 2, y, col3W, 18, "F");
  txt(`${series} Configuration`, M + 8, y + 12, { sz: 8, w: "bold", c: C.white });
  txt("CNC Machine Configuration", M + col3W + 8, y + 12, { sz: 8, w: "bold", c: C.white });
  txt("Logistics", M + col3W * 2 + 8, y + 12, { sz: 8, w: "bold", c: C.white });
  y += 20;

  stroke([200, 200, 200]); doc.setLineWidth(0.3);
  doc.rect(M, y, col3W, 80); doc.rect(M + col3W, y, col3W, 80); doc.rect(M + col3W * 2, y, col3W, 80);

  const configLeft = [
    `${series} – ${quote.machineName}`,
    `Voltage – 220 VAC, 3 Phase, 40 AMPS`,
  ];
  const configMid = [
    "CNC Machine Details",
    "Manufacturer – TBD",
    "Model – TBD",
    "Automation Entry – TBD",
  ];
  const configRight = [
    "Lead Time – 8 weeks",
    "FOB – Shipping Point",
    "Shipping – Customer Supplied",
    "Payment Terms:",
    "  20% Down",
    "  70% Shipment",
    "  10% Production",
  ];

  let cy = y + 12;
  for (const line of configLeft) { txt(`• ${line}`, M + 6, cy, { sz: 7, c: C.dark }); cy += 10; }
  cy = y + 12;
  for (const line of configMid) { txt(`• ${line}`, M + col3W + 6, cy, { sz: 7, c: C.dark }); cy += 10; }
  cy = y + 12;
  for (const line of configRight) { txt(`• ${line}`, M + col3W * 2 + 6, cy, { sz: 7, c: C.dark }); cy += 10; }
  y += 90;

  // Standard Products & Services Table
  y += 10;
  txt("Standard Products & Services", M, y, { sz: 14, w: "bold" }); y += 4;
  fill(C.gold); doc.rect(M, y, 60, 2, "F"); y += 14;

  // Table header
  const cols = [M, M + 80, M + 370, M + 430, M + 470];
  fill(C.hdrBg);
  doc.rect(M, y, cw, 18, "F");
  txt("Part Number", cols[0] + 6, y + 12, { sz: 8, w: "bold", c: C.white });
  txt("Description", cols[1] + 6, y + 12, { sz: 8, w: "bold", c: C.white });
  txt("Unit Price", cols[2] + 6, y + 12, { sz: 8, w: "bold", c: C.white });
  txt("Qty.", cols[3] + 6, y + 12, { sz: 8, w: "bold", c: C.white });
  txt("Sub-Total", cols[4] + 6, y + 12, { sz: 8, w: "bold", c: C.white });
  y += 20;

  const standardOpts = options.filter(o => o.isStandard);
  const addedOpts = options.filter(o => !o.isStandard && o.price > 0);

  // Standard items
  for (let i = 0; i < standardOpts.length; i++) {
    const o = standardOpts[i];
    ensureSpace(20);
    if (i % 2 === 1) { fill(C.rowAlt); doc.rect(M, y - 10, cw, 16, "F"); }
    const name = o.name.length > 45 ? o.name.slice(0, 42) + "…" : o.name;
    txt(o.partNumber || "—", cols[0] + 6, y, { sz: 8, c: C.dark });
    txt(name, cols[1] + 6, y, { sz: 8 });
    txt("Included", cols[2] + 6, y, { sz: 8, c: C.muted });
    txt("1", cols[3] + 6, y, { sz: 8 });
    txt("Included", cols[4] + 6, y, { sz: 8, c: C.muted });
    y += 16;
  }

  // Added options
  if (addedOpts.length > 0) {
    y += 10;
    ensureSpace(40);
    txt("Selected Options", M, y, { sz: 12, w: "bold" }); y += 4;
    fill(C.gold); doc.rect(M, y, 50, 2, "F"); y += 14;

    fill(C.hdrBg);
    doc.rect(M, y, cw, 18, "F");
    txt("Part Number", cols[0] + 6, y + 12, { sz: 8, w: "bold", c: C.white });
    txt("Description", cols[1] + 6, y + 12, { sz: 8, w: "bold", c: C.white });
    txt("Unit Price", cols[2] + 6, y + 12, { sz: 8, w: "bold", c: C.white });
    txt("Qty.", cols[3] + 6, y + 12, { sz: 8, w: "bold", c: C.white });
    txt("Sub-Total", cols[4] + 6, y + 12, { sz: 8, w: "bold", c: C.white });
    y += 20;

    for (let i = 0; i < addedOpts.length; i++) {
      const o = addedOpts[i];
      ensureSpace(20);
      if (i % 2 === 1) { fill(C.rowAlt); doc.rect(M, y - 10, cw, 16, "F"); }
      const name = o.name.length > 45 ? o.name.slice(0, 42) + "…" : o.name;
      txt(o.partNumber || "—", cols[0] + 6, y, { sz: 8, c: C.dark });
      txt(name, cols[1] + 6, y, { sz: 8 });
      txt(USD(o.price, 2), cols[2] + 6, y, { sz: 8, w: "bold" });
      txt("1", cols[3] + 6, y, { sz: 8 });
      txt(USD(o.price, 2), cols[4] + 6, y, { sz: 8, w: "bold" });
      y += 16;
    }
  }

  // Pricing summary
  y += 16; ensureSpace(100);
  hr(y); y += 16;
  const priceX = W - M - 120;
  txt(`${series} System Price:`, priceX, y, { sz: 10, a: "right" });
  txt(USD(quote.totalPrice, 2), W - M, y, { sz: 10, w: "bold", a: "right" }); y += 14;
  txt("Tax (%):", priceX, y, { sz: 10, c: C.muted, a: "right" });
  txt("TBD", W - M, y, { sz: 10, c: C.muted, a: "right" }); y += 14;
  txt(`Equipment Total`, priceX, y, { sz: 10, a: "right" });
  txt(USD(quote.totalPrice, 2), W - M, y, { sz: 10, w: "bold", a: "right" }); y += 14;
  txt("Approx. Freight:", priceX, y, { sz: 10, c: C.muted, a: "right" });
  txt("TBD", W - M, y, { sz: 10, c: C.muted, a: "right" }); y += 14;
  txt("Approx. Rigging:", priceX, y, { sz: 10, c: C.muted, a: "right" });
  txt("TBD", W - M, y, { sz: 10, c: C.muted, a: "right" }); y += 6;
  stroke(C.dark); doc.setLineWidth(1); doc.line(priceX - 40, y, W - M, y); y += 14;
  txt("Total:", priceX, y, { sz: 12, w: "bold", a: "right" });
  txt(USD(quote.totalPrice, 2), W - M, y, { sz: 12, w: "bold", a: "right" });

  pageFooter();

  // ============ PAGE: FINANCING ============
  if (financing) {
    doc.addPage(); y = M; pageHeader();
    txt("Financing Summary", M, y, { sz: 14, w: "bold" }); y += 4;
    fill(C.gold); doc.rect(M, y, 60, 2, "F"); y += 20;

    fill(C.light); doc.roundedRect(M, y, cw, 56, 6, 6, "F");
    txt("ESTIMATED MONTHLY PAYMENT", M + 16, y + 16, { sz: 8, w: "bold", c: C.muted });
    txt(`${USD(Math.round(financing.monthlyPayment))}/mo`, M + 16, y + 40, { sz: 22, w: "bold", c: C.gold });
    y += 70;

    const fRows: [string, string][] = [
      [`Down Payment (${financing.downPaymentPct}%)`, USD(Math.round(financing.downPayment))],
      ["Financed Amount", USD(Math.round(financing.financedAmount))],
      ["Term / Rate", `${financing.termMonths} months @ ${financing.interestRate}% APR`],
      ["Total Cost of Financing", USD(Math.round(financing.totalCost))],
    ];
    for (const [l, v] of fRows) {
      txt(l, M, y, { sz: 10, c: C.muted }); txt(v, W - M, y, { sz: 10, w: "bold", a: "right" }); y += 18;
    }

    if (roi && roi.netBenefit > 0) {
      y += 10;
      fill(C.light); doc.roundedRect(M, y, cw, 36, 6, 6, "F");
      const mb = Math.round(roi.netBenefit / 12);
      txt(`Monthly cost ${USD(Math.round(financing.monthlyPayment))} vs. monthly benefit ${USD(mb)}`, M + 16, y + 14, { sz: 9, c: C.muted });
      if (mb > financing.monthlyPayment) {
        txt("This system pays for itself from day one.", M + 16, y + 26, { sz: 9, w: "bold", c: C.green });
      }
      y += 48;
    }
    pageFooter();
  }

  // ============ PAGE: ROI ============
  if (roi) {
    doc.addPage(); y = M; pageHeader();
    txt("Return on Investment", M, y, { sz: 14, w: "bold" }); y += 4;
    fill(C.gold); doc.rect(M, y, 60, 2, "F"); y += 20;

    // KPI boxes
    const kW = (cw - 24) / 4;
    const kpis: [string, string][] = [
      ["NET ANNUAL BENEFIT", USD(Math.round(roi.netBenefit))],
      ["PAYBACK PERIOD", roi.paybackMonths > 0 && roi.paybackMonths < 120 ? `${roi.paybackMonths.toFixed(1)} mo` : "120+"],
      ["YEAR 5 ROI", `${Math.round(roi.year5ROI)}%`],
      ["CAPACITY", `${roi.capacityMult.toFixed(1)}x`],
    ];
    kpis.forEach(([label, value], i) => {
      const x = M + i * (kW + 8);
      fill(C.light); doc.roundedRect(x, y, kW, 50, 4, 4, "F");
      txt(label, x + 8, y + 14, { sz: 6, w: "bold", c: C.muted });
      txt(value, x + 8, y + 36, { sz: 14, w: "bold", c: i < 3 ? C.green : C.dark });
    });
    y += 62;

    // ROI timeline
    txt("ROI TIMELINE", M, y, { sz: 8, w: "bold", c: C.muted }); y += 14;
    const tW = (cw - 16) / 3;
    [["Year 1", roi.year1ROI], ["Year 3", roi.year3ROI], ["Year 5", roi.year5ROI]].forEach(([label, val], i) => {
      const x = M + i * (tW + 8);
      fill(C.light); doc.roundedRect(x, y, tW, 28, 4, 4, "F");
      txt(String(label), x + 10, y + 18, { sz: 9, c: C.muted });
      txt(`${Math.round(val as number)}%`, x + tW - 10, y + 18, { sz: 14, w: "bold", c: C.green, a: "right" });
    });
    y += 40;

    // Annual breakdown
    txt("ANNUAL BENEFIT BREAKDOWN", M, y, { sz: 8, w: "bold", c: C.muted }); y += 14;

    const bRows: [string, string, string][] = [
      ["Manned Shift Improvement", `${roi.mannedGainHrs?.toFixed(1) ?? "—"} hrs/day × $${roi.shopRate} × ${roi.workingDays} days`, USD(Math.round(roi.mannedGainRev ?? 0))],
    ];
    if (roi.unmannedShifts > 0) {
      bRows.push(["Unmanned Shift — NEW Revenue", `${roi.unmannedGainHrs?.toFixed(1) ?? "—"} hrs/day × $${roi.shopRate} × ${roi.workingDays} days`, USD(Math.round(roi.unmannedGainRev ?? 0))]);
    }
    bRows.push(["Labor Reallocation Value", `${roi.mannedGainHrs?.toFixed(1) ?? "—"} hrs × $${roi.operatorWage} × ${roi.workingDays} days × 50%`, USD(Math.round(roi.laborSaving))]);

    for (const [label, detail, value] of bRows) {
      ensureSpace(26);
      txt(label, M, y, { sz: 9 }); txt(value, W - M, y, { sz: 9, w: "bold", c: C.green, a: "right" }); y += 10;
      txt(detail, M, y, { sz: 7, c: C.muted }); y += 14;
    }

    y += 2; stroke(C.dark); doc.setLineWidth(0.75); doc.line(M, y, W - M, y); y += 14;
    txt("NET ANNUAL BENEFIT", M, y, { sz: 11, w: "bold" });
    txt(USD(Math.round(roi.netBenefit)), W - M, y, { sz: 16, w: "bold", c: C.green, a: "right" }); y += 24;

    // Section 179
    fill(C.light); doc.roundedRect(M, y, cw, 40, 6, 6, "F");
    txt("SECTION 179 TAX BENEFIT", M + 14, y + 14, { sz: 8, w: "bold", c: C.muted });
    txt(`Tax Savings: ${USD(Math.round(roi.taxSavings))}  ·  Effective Cost: ${USD(Math.round(roi.effectiveCost))}  ·  Adjusted Payback: ${roi.paybackMonths > 0 && roi.paybackMonths < 120 ? (roi.paybackMonths * 0.79).toFixed(1) + " mo" : "—"}`, M + 14, y + 30, { sz: 9 });
    y += 52;

    txt(`Based on ${roi.mannedShifts} manned + ${roi.unmannedShifts} unmanned shifts · ${roi.hrsPerShift} hrs/shift · $${roi.shopRate}/hr shop rate · ${roi.workingDays} working days/year`, M, y, { sz: 7, c: C.muted });
    pageFooter();
  }

  // ============ PAGE: TERMS & CONDITIONS ============
  doc.addPage(); y = M; pageHeader();

  const section = (title: string) => {
    ensureSpace(20); txt(title, M, y, { sz: 10, w: "bold" }); y += 2;
    stroke(C.dark); doc.setLineWidth(0.5); doc.line(M, y, M + 120, y); y += 10;
  };

  const bullet = (s: string) => {
    ensureSpace(24);
    const wrapped = doc.splitTextToSize(s, cw - 20);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(45, 45, 45);
    doc.text(wrapped, M + 16, y);
    y += 10 * (Array.isArray(wrapped) ? wrapped.length : 1) + 2;
  };

  section("General Assumptions");
  bullet("(1) Trinity will require Client to provide utility connections (including Electricity and Clean Dry Shop Air) to specified locations.");
  bullet("(2) Trinity is not responsible for any local permits. All city, Fire, Environmental, Seismic, etc. permits are the sole responsibility of the client.");
  bullet("(3) Trinity is not responsible for any alterations needed to the building for installation of this system.");
  bullet("(4) Trinity is not responsible for any Structural Engineering Calculations or Services.");
  bullet("(5) Installation hours are budgeted to take place during normal business hours 8:00 AM – 5:00 PM.");
  bullet("(6) Client will provide and ensure level flooring for equipment mounting.");
  bullet("(7) Client to provide Seismic Engineering & Title 24 calculations, if required.");

  section("Warranty Information");
  bullet("Trinity Robotics Automation, LLC. warrants the purchased materials and workmanship provided by Trinity to be free of defects for the period of one (1) year from the date in which SAT run-off is completed and signed off by the client or agreed upon production runs begin (whichever event happens first).");

  section("Lead Time");
  bullet("Delivery and completion of the equipment is based upon receipt and acceptance of Client purchase order, down payment, and contractual signature at Trinity's facility in Ontario, California. Lead times can shift during the project execution due to unaccounted-for events.");

  section("Payment Terms");
  bullet("20% - Down Payment · Due upon invoice");
  bullet("70% - Shipment of Equipment · Net 10");
  bullet("10% - Production · Net 30");

  section("Tax Information");
  bullet("(1) All purchase orders made to Trinity Robotics Automation should state whether they are taxable or non-taxable.");
  bullet("(2) If purchases are tax exempt, sales tax will be removed from the Sales Order Total.");
  bullet("(3) Tax exempt purchases will require proof of certification to Trinity Office Management.");

  section("Shipping / Freight / Rigging");
  bullet("(1) All shipment, freight, and rigging costs are the responsibility of the client.");

  section("Contract Terms");
  bullet("(1) Trinity Robotics Automation, LLC. retains a purchase money security interest in the goods that are subject to this contract to secure payment by customer.");
  bullet("(2) Payment in full on the balance of this Contract must be made upon terms noted on the SO.");
  bullet("(3) Late payments are subject to a financing charge of 1.5 percent per month on the unpaid balance.");
  bullet("(4) Financing is the responsibility of Customer.");

  pageFooter();

  // ============ SIGNATURE PAGE ============
  doc.addPage(); y = M; pageHeader();
  y += 20;
  txt("No contract shall result from this order until purchaser's offer is accepted by the General Manager", W / 2, y, { sz: 8, c: C.muted, a: "center" }); y += 12;
  txt("or Trinity Robotics Automation, LLC.", W / 2, y, { sz: 8, c: C.muted, a: "center" }); y += 6;
  txt("Price Valid for 60 days from date on Sales order", W / 2, y, { sz: 8, w: "bold", c: C.muted, a: "center" }); y += 30;
  hr(y); y += 30;

  // Customer signature
  txt("Date: ___________________", M, y, { sz: 9 });
  txt("Title: ___________________", M + 170, y, { sz: 9 });
  txt("Signature: ______________________________", M + 330, y, { sz: 9 });
  y += 16;
  txt("I agree to the stated Terms and Conditions", W / 2, y, { sz: 8, c: C.muted, a: "center" });
  y += 40;

  hr(y); y += 14;
  txt("Trinity Robotics Automation, LLC. Use Only.", W / 2, y, { sz: 8, c: C.muted, a: "center" }); y += 20;
  txt("Date: ___________________", M, y, { sz: 9 });
  txt("Title: ___________________", M + 170, y, { sz: 9 });
  txt("Signature: ______________________________", M + 330, y, { sz: 9 });
  y += 16;
  txt("Trinity Robotics Automation, LLC. Accepts this order.", W / 2, y, { sz: 8, c: C.muted, a: "center" });

  pageFooter();

  // Stamp all footers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) { doc.setPage(i); pageFooter(); }

  // ============ MERGE BROCHURES ============
  const brochureMap: Record<string, string[]> = {
    "ax1-12": ["ax1-spec.pdf"], "ax1-18": ["ax1-spec.pdf"],
    "ax2-16": ["ax2-brochure.pdf", "ax2-spec.pdf"], "ax2-24": ["ax2-brochure.pdf", "ax2-spec.pdf"],
    "ax2-16-duo": ["ax2-duo-brochure.pdf", "ax2-duo-spec.pdf"], "ax2-24-duo": ["ax2-duo-brochure.pdf", "ax2-duo-spec.pdf"],
    "ax4-12": ["ax4-spec.pdf"], "ax4-12-hd": ["ax4-spec.pdf"],
    "ax5-20": ["ax5-brochure.pdf", "ax5-spec.pdf"], "ax5-20-hd": ["ax5-hd-brochure.pdf"],
  };
  const machineSlug = quote.machineName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const brochureFiles = brochureMap[machineSlug];

  if (brochureFiles && brochureFiles.length > 0) {
    try {
      const { PDFDocument } = await import("pdf-lib");
      const quoteBytes = doc.output("arraybuffer");
      const merged = await PDFDocument.create();
      const quotePdf = await PDFDocument.load(quoteBytes);
      const qPages = await merged.copyPages(quotePdf, quotePdf.getPageIndices());
      for (const p of qPages) merged.addPage(p);
      for (const file of brochureFiles) {
        const bytes = await fetch(`/brochures/${file}`).then(r => r.arrayBuffer());
        const bPdf = await PDFDocument.load(bytes);
        const bPages = await merged.copyPages(bPdf, bPdf.getPageIndices());
        for (const p of bPages) merged.addPage(p);
      }
      const mergedBytes = await merged.save();
      const blob = new Blob([mergedBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `Trinity-Quote-${quote.quoteNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
      return;
    } catch (err) { console.warn("Brochure merge failed:", err); }
  }

  doc.save(`Trinity-Quote-${quote.quoteNumber}.pdf`);
}
