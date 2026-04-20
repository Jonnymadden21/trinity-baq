import { useMemo, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer, Download, Loader2 } from "lucide-react";
import type { Quote } from "@shared/schema";

/* ---------- Types ---------- */
type Opt = {
  id: number;
  name: string;
  partNumber: string | null;
  description?: string;
  price: number;
  isStandard: boolean;
  category: string;
};
type FP = {
  downPaymentPct: number;
  termMonths: number;
  interestRate: number;
  downPayment: number;
  financedAmount: number;
  monthlyPayment: number;
  totalCost: number;
};
type RP = {
  shopRate: number;
  hrsPerShift: number;
  operatorWage: number;
  workingDays: number;
  mannedShifts: number;
  unmannedShifts: number;
  mannedUtilBefore?: number;
  mannedUtilAfter?: number;
  unmannedUtilBefore?: number;
  unmannedUtilAfter?: number;
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
};

/* ---------- Helpers ---------- */
const money = (n: number, frac = 2) =>
  "$" +
  (n || 0).toLocaleString("en-US", {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  });
const m0 = (n: number) => money(n, 0);
const m2 = (n: number) => money(n, 2);
const safe = <T,>(v: string | null | undefined, fb: T): T => {
  if (!v) return fb;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fb;
  }
};

/* Brochure map for "PDF + Brochures" merge button */
const BROCHURE_MAP: Record<string, string[]> = {
  "ax1-12": ["ax1-spec.pdf"],
  "ax1-18": ["ax1-spec.pdf"],
  "ax2-16": ["ax2-brochure.pdf", "ax2-spec.pdf"],
  "ax2-24": ["ax2-brochure.pdf", "ax2-spec.pdf"],
  "ax2-16-duo": ["ax2-duo-brochure.pdf", "ax2-duo-spec.pdf"],
  "ax2-24-duo": ["ax2-duo-brochure.pdf", "ax2-duo-spec.pdf"],
  "ax4-12": ["ax4-spec.pdf"],
  "ax4-12-hd": ["ax4-spec.pdf"],
  "ax5-20": ["ax5-brochure.pdf", "ax5-spec.pdf"],
  "ax5-20-hd": ["ax5-hd-brochure.pdf"],
  };

/* Per-machine branding — series logo, hero, tagline */
function brandForSlug(slug: string, machineName: string) {
  const ax5 = slug.startsWith("ax5");
  const ax4 = slug.startsWith("ax4");
  const ax2 = slug.startsWith("ax2");
  const ax1 = slug.startsWith("ax1");
  const ai = slug.startsWith("ai");

  let seriesLogo = `${import.meta.env.BASE_URL}proposal-assets/trinity-ax2-logo.png`;
  let hero = `${import.meta.env.BASE_URL}proposal-assets/ax2-hero.png`;
  let tagline = ["Automated Pallet System for", "Small/Medium Vertical Machining Centers"];
  let quoteTitlePrefix = machineName;
  let seriesShort = "AX";

  if (ai) {
    // Use text-based series header for Ai (no AX2 logo), reuse trinity-logo.jpeg + gold "Ai"
    seriesLogo = "";
    hero = `${import.meta.env.BASE_URL}proposal-assets/ai-hero.jpg`;
    tagline = ["Automated Machine Tending", "Small/Medium Vertical Machining Centers"];
    seriesShort = "Ai";
  } else if (ax5) {
    seriesLogo = slug === "ax5-20-hd"
      ? `${import.meta.env.BASE_URL}proposal-assets/trinity-ax5-hd-logo.png`
      : `${import.meta.env.BASE_URL}proposal-assets/trinity-ax5-logo.png`;
    hero = slug === "ax5-20-hd"
      ? `${import.meta.env.BASE_URL}proposal-assets/ax5-hd-hero.png`
      : `${import.meta.env.BASE_URL}proposal-assets/ax5-hero.png`;
    tagline = ["Automated Pallet System for", "Medium/Large Vertical Machining Centers"];
    seriesShort = "AX";
  } else if (ax4) {
    seriesLogo = `${import.meta.env.BASE_URL}proposal-assets/trinity-ax2-logo.png`; // fallback
    hero = `${import.meta.env.BASE_URL}proposal-assets/ax2-hero.png`;
    tagline = ["Automated Pallet System for", "Horizontal Machining Centers"];
    seriesShort = "AX";
  } else if (ax2) {
    seriesLogo = `${import.meta.env.BASE_URL}proposal-assets/trinity-ax2-logo.png`;
    hero = `${import.meta.env.BASE_URL}proposal-assets/ax2-hero.png`;
    tagline = ["Automated Pallet System for", "Small/Medium Vertical Machining Centers"];
    seriesShort = "AX";
  } else if (ax1) {
    seriesLogo = `${import.meta.env.BASE_URL}proposal-assets/trinity-ax2-logo.png`;
    hero = `${import.meta.env.BASE_URL}proposal-assets/ax2-hero.png`;
    tagline = ["Automated Pallet System for", "Small/Medium Vertical Machining Centers"];
    seriesShort = "AX";
  }

  return { seriesLogo, hero, tagline, seriesShort, quoteTitlePrefix };
}

/* ---------- Component ---------- */
export default function QuoteSummary() {
  const { quoteNumber } = useParams<{ quoteNumber: string }>();
  const { data: quote, isLoading } = useQuery<Quote>({
    queryKey: [`/api/quotes/${quoteNumber}`],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Skeleton className="h-96 w-full max-w-4xl" />
      </div>
    );
  }
  if (!quote) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p>Quote not found</p>
      </div>
    );
  }
  return <QuoteProposal quote={quote} />;
}

/**
 * Pure render component — takes a Quote object and renders the full proposal.
 * Exported so /preview can feed it a demo quote without going through the API.
 */
export function QuoteProposal({ quote }: { quote: Quote }) {
  const [exporting, setExporting] = useState(false);

  const parsed = useMemo(() => {
    return {
      opts: safe<Opt[]>(quote.selectedOptions, []),
      fp: safe<FP | null>(quote.financingParams, null),
      rp: safe<RP | null>(quote.roiParams, null),
    };
  }, [quote]);

  const handlePdfPlusBrochures = useCallback(async () => {
    setExporting(true);
    try {
      const { exportQuotePdf } = await import("@/lib/pdf-export");
      await exportQuotePdf({
        quote,
        options: parsed.opts,
        financing: parsed.fp,
        roi: parsed.rp,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  }, [quote, parsed]);

  const { fp, rp } = parsed;
  const std = parsed.opts.filter((o) => o.isStandard);
  const add = parsed.opts.filter((o) => !o.isStandard && o.price > 0);

  const slug = quote.machineName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const brand = brandForSlug(slug, quote.machineName);
  const hasBrochure = !!BROCHURE_MAP[slug];

  const quoteDateStr = new Date(quote.createdAt).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

  const equipmentTotal = quote.totalPrice;
  const installOpt = add.find((o) =>
    /install/i.test(o.name) || /install/i.test(o.partNumber || ""),
  );
  // System Price = total MINUS installation line (matches reference where "AX System Price" != total if install present)
  const systemPrice = equipmentTotal;

  // Pages: cover, products (possibly multi-page — single render, printer paginates), financing/roi, terms
  // Always ~4 printed pages + brochures
  const totalPagesPrinted = 4; // best-effort label; real count varies with brochure merge

  const proposalTitle = `${quote.machineName} Proposal`;
  const quoteHeaderTitle =
    brand.seriesShort === "Ai"
      ? "Ai Automation Sales Quotation"
      : `${quote.machineName} Sales Quotation`;

  /* ============================== RENDER ============================== */
  return (
    <>
      <style>{STYLES}</style>

      {/* Screen-only navbar */}
      <div className="np border-b bg-white sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/">
            <button className="flex items-center gap-2 text-gray-500 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back</span>
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-black"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4 mr-2" />
              Save as PDF
            </Button>
            {hasBrochure && (
              <Button
                variant="outline"
                size="sm"
                className="text-black"
                onClick={handlePdfPlusBrochures}
                disabled={exporting}
              >
                {exporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    PDF + Brochures
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ============== DOCUMENT ============== */}
      <div className="prop">

        {/* ===== PAGE 1 — COVER ===== */}
        <section className="page">
          <PageHeader brand={brand} title={quoteHeaderTitle} qnum={quote.quoteNumber} date={quoteDateStr} />

          <div className="cover-title">
            <div className="cover-title-main">TRINITY AUTOMATION</div>
            <div className="cover-title-sub">{proposalTitle}</div>
            <div className="cover-title-bar" />
          </div>

          <div className="cover-hero-wrap">
            <img src={brand.hero} alt={quote.machineName} className="cover-hero" />
          </div>

          <hr className="cover-divider" />

          <div className="prepared-grid">
            <div>
              <div className="prepared-label">Prepared For:</div>
              <div className="prepared-body">
                <div>{quote.customerName}</div>
                {quote.customerPhone && <div>{quote.customerPhone}</div>}
                <div>{quote.customerEmail}</div>
                {quote.customerCompany && <div>{quote.customerCompany}</div>}
              </div>
            </div>
            <div>
              <div className="prepared-label">Trinity Contact:</div>
              <div className="prepared-body">
                <div>Nick Tonti</div>
                <div>(714) 767-2035</div>
                <div>nick@trinityautomation.com</div>
                <div>Trinity Robotics Automation</div>
                <div>4582 Brickell Privado</div>
                <div>Ontario, CA 91761</div>
              </div>
            </div>
          </div>

          <PageFooter page={1} total={totalPagesPrinted} />
        </section>

        {/* ===== PAGE 2 — CONFIG + PRODUCTS ===== */}
        <section className="page">
          <PageHeader brand={brand} title={quoteHeaderTitle} qnum={quote.quoteNumber} date={quoteDateStr} />

          <h2 className="section-title">Configuration Details</h2>
          <div className="config-grid">
            <div className="config-col">
              <div className="config-col-header">{brand.seriesShort === "Ai" ? "Ai Configuration" : quote.machineName}</div>
              <div className="config-col-body">
                <ul>
                  {brand.seriesShort === "Ai" ? (
                    <>
                      <li>Max Part Width — 4"</li>
                      <li>Max Part Height — 4"</li>
                      <li>Max Part Length — 6"</li>
                      <li>Max Weight Capacity — 8 lbs.</li>
                      <li>Voltage — 220 VAC, 3 Phase, 40 AMPS</li>
                    </>
                  ) : (
                    <>
                      <li>{quote.machineName}</li>
                      <li>Voltage — 220 VAC, 3 Phase, 40 AMPS</li>
                      <li>FOB — Ontario, CA</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
            <div className="config-col">
              <div className="config-col-header">CNC Machine Configuration</div>
              <div className="config-col-body">
                <ul>
                  <li>CNC Machine Details</li>
                  <li>Manufacturer — TBD</li>
                  <li>Year — TBD</li>
                  <li>Model — TBD</li>
                  <li>Controller — TBD</li>
                  <li>Automation Entry — TBD</li>
                </ul>
              </div>
            </div>
            <div className="config-col">
              <div className="config-col-header">Logistics</div>
              <div className="config-col-body">
                <ul>
                  <li>Lead Time — 8 weeks</li>
                  <li>FOB — Shipping Point</li>
                  <li>Shipping — Customer Supplied</li>
                  <li>Shipment Prep — Trinity Supplied</li>
                  <li>
                    Payment Terms:
                    <ul>
                      <li>20% Down</li>
                      <li>70% Shipment</li>
                      <li>10% Production</li>
                    </ul>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <h2 className="section-title">Standard Products &amp; Services</h2>
          <ProductTable rows={buildStdRows(std, quote.machineName, quote.basePrice)} showPrice="included" />

          {add.length > 0 && (
            <>
              <h2 className="section-title">Selected Options</h2>
              <ProductTable
                rows={add.map((o) => ({
                  partNumber: o.partNumber || "—",
                  name: o.name,
                  bullets: o.description
                    ? o.description.split("\n").map((l) => l.trim()).filter(Boolean)
                    : [],
                  unitPrice: m2(o.price),
                  qty: 1,
                  subTotal: m2(o.price),
                }))}
                showPrice="show"
              />
            </>
          )}

          <div className="pricing-summary">
            <div className="pricing-row">
              <span>{brand.seriesShort === "Ai" ? "AX" : brand.seriesShort} System Price:</span>
              <span>{m2(systemPrice)}</span>
            </div>
            <div className="pricing-row muted">
              <span>Tax (%):</span>
              <span>TBD</span>
            </div>
            <div className="pricing-row">
              <span>Equipment Total:</span>
              <span>{m2(equipmentTotal)}</span>
            </div>
            <div className="pricing-row muted">
              <span>Approx. Freight:</span>
              <span>TBD</span>
            </div>
            <div className="pricing-row muted">
              <span>Approx. Rigging:</span>
              <span>TBD</span>
            </div>
            <div className="pricing-row total">
              <span>Total:</span>
              <span>{m2(equipmentTotal)}</span>
            </div>
          </div>

          <PageFooter page={2} total={totalPagesPrinted} />
        </section>

        {/* ===== PAGE 3 — BAQ-ONLY: FINANCING + ROI ===== */}
        {(fp || rp) && (
          <section className="page">
            <PageHeader brand={brand} title={quoteHeaderTitle} qnum={quote.quoteNumber} date={quoteDateStr} />

            <div className="baq-banner">
              <span className="baq-banner-tag">Build-a-Quote Analysis</span>
              <span className="baq-banner-note">
                Financing &amp; ROI projections based on your configured inputs
              </span>
            </div>

            {fp && (
              <>
                <h2 className="section-title">Financing Summary</h2>
                <div className="fin-hero">
                  <div>
                    <div className="fin-hero-label">Estimated Monthly Payment</div>
                    <div className="fin-hero-value">
                      {m0(Math.round(fp.monthlyPayment))}
                      <span className="fin-hero-unit"> /mo</span>
                    </div>
                    <div className="fin-hero-note">
                      {fp.termMonths} months @ {fp.interestRate}% APR · {fp.downPaymentPct}% down
                    </div>
                  </div>
                  <div className="fin-hero-right">
                    <div className="fin-hero-label">Total System Price</div>
                    <div className="fin-hero-value gold">{m2(equipmentTotal)}</div>
                  </div>
                </div>

                <table className="fin-table">
                  <tbody>
                    <tr>
                      <td>Down Payment ({fp.downPaymentPct}%)</td>
                      <td className="r">{m0(Math.round(fp.downPayment))}</td>
                    </tr>
                    <tr>
                      <td>Financed Amount</td>
                      <td className="r">{m0(Math.round(fp.financedAmount))}</td>
                    </tr>
                    <tr>
                      <td>Term / Rate</td>
                      <td className="r">
                        {fp.termMonths} months @ {fp.interestRate}% APR
                      </td>
                    </tr>
                    <tr>
                      <td>Total Cost of Financing</td>
                      <td className="r">{m0(Math.round(fp.totalCost))}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            {rp && fp && (
              <>
                <h2 className="section-title">Hourly Cost to Operate</h2>
                <HourlyCostGrid fp={fp} rp={rp} />
              </>
            )}

            {rp && (
              <>
                <h2 className="section-title">Return on Investment</h2>
                <div className="roi-kpis">
                  <KPI label="Net Annual Benefit" value={m0(Math.round(rp.netBenefit))} green />
                  <KPI
                    label="Payback Period"
                    value={
                      rp.paybackMonths > 0 && rp.paybackMonths < 120
                        ? `${rp.paybackMonths.toFixed(1)} mo`
                        : "120+"
                    }
                    green
                  />
                  <KPI label="Year 5 ROI" value={`${Math.round(rp.year5ROI)}%`} green />
                  <KPI label="Capacity" value={`${rp.capacityMult.toFixed(1)}x`} />
                </div>

                <div className="roi-row">
                  {([
                    ["Year 1", rp.year1ROI],
                    ["Year 3", rp.year3ROI],
                    ["Year 5", rp.year5ROI],
                  ] as [string, number][]).map(([l, v]) => (
                    <div key={l} className="roi-chip">
                      <span className="roi-chip-label">{l}</span>
                      <span className="roi-chip-value">{Math.round(v)}%</span>
                    </div>
                  ))}
                </div>

                <div className="benefit-title">Annual Benefit Breakdown</div>
                <div className="benefit-row">
                  <div>
                    <div className="benefit-name">Manned Shift Improvement</div>
                    <div className="benefit-formula">
                      {rp.mannedGainHrs?.toFixed(1)} hrs/day × ${rp.shopRate} × {rp.workingDays} days
                    </div>
                  </div>
                  <div className="benefit-value">{m0(Math.round(rp.mannedGainRev ?? 0))}</div>
                </div>
                {rp.unmannedShifts > 0 && (
                  <div className="benefit-row">
                    <div>
                      <div className="benefit-name">
                        Unmanned Shift — <span className="gold">NEW REVENUE</span>
                      </div>
                      <div className="benefit-formula">
                        {rp.unmannedGainHrs?.toFixed(1)} hrs/day × ${rp.shopRate} × {rp.workingDays} days
                      </div>
                    </div>
                    <div className="benefit-value">{m0(Math.round(rp.unmannedGainRev ?? 0))}</div>
                  </div>
                )}
                <div className="benefit-row">
                  <div>
                    <div className="benefit-name">Labor Reallocation Value</div>
                    <div className="benefit-formula">
                      {rp.mannedGainHrs?.toFixed(1)} hrs × ${rp.operatorWage} × {rp.workingDays} days × 50%
                    </div>
                  </div>
                  <div className="benefit-value">{m0(Math.round(rp.laborSaving))}</div>
                </div>
                <div className="benefit-total">
                  <div>NET ANNUAL BENEFIT</div>
                  <div className="green">{m0(Math.round(rp.netBenefit))}</div>
                </div>

                <div className="sec179">
                  <b>Section 179 Tax Benefit</b> — Tax Savings:{" "}
                  <b>{m0(Math.round(rp.taxSavings))}</b> · Effective Cost:{" "}
                  <b>{m0(Math.round(rp.effectiveCost))}</b> · Adjusted Payback:{" "}
                  <b>
                    {rp.paybackMonths > 0 && rp.paybackMonths < 120
                      ? (rp.paybackMonths * 0.79).toFixed(1) + " mo"
                      : "—"}
                  </b>
                </div>
                <div className="roi-assumptions">
                  Based on {rp.mannedShifts} manned + {rp.unmannedShifts} unmanned shifts ·{" "}
                  {rp.hrsPerShift} hrs/shift · ${rp.shopRate}/hr shop rate · {rp.workingDays} working days/year
                </div>
              </>
            )}

            <PageFooter page={3} total={totalPagesPrinted} />
          </section>
        )}

        {/* ===== PAGE 4 — TERMS & CONDITIONS ===== */}
        <section className="page">
          <PageHeader brand={brand} title={quoteHeaderTitle} qnum={quote.quoteNumber} date={quoteDateStr} />

          <TermsBlock
            heading="General Assumptions"
            numbered
            items={[
              "Trinity will require Client to provide utility connections (including Electricity and Clean Dry Shop Air) to specified locations. All drops will have disconnects and will be de-energized until system power up.",
              "Trinity is not responsible for any local permits. All city, Fire, Environmental, Seismic, etc. permits are the sole responsibility of the client.",
              "Trinity is not responsible for any alterations needed to the building for the installation of this system. These include alterations needed to the walls, floors, ceiling, structure, or any existing building alterations required to install the quoted system.",
              "Trinity is not responsible for any Structural Engineering Calculations or Services.",
              "Installation hours are budgeted to take place during normal business hours 8:00 AM – 5:00 PM.",
              "Client will provide and ensure level flooring for equipment mounting.",
              "Client to provide Seismic Engineering & Title 24 calculations, if required.",
              "(If Applicable) Trinity is not responsible for any limitations placed on the installation that are driven by local permitting entities.",
            ]}
          />

          <TermsBlock
            heading="Warranty Information"
            numbered
            items={[
              "Trinity Robotics Automation, LLC. warranties the purchased materials and workmanship provided by Trinity to be free of defects for the period of one (1) year from the date in which SAT run-off is completed and signed off by the client or agreed upon production runs begin (whichever event happens first).",
            ]}
          />

          <TermsBlock
            heading="Lead Time"
            items={[
              "Delivery and completion of the equipment is based upon receipt and acceptance of Client purchase order, down payment, and contractual signature at Trinity's facility in Ontario, California. Lead times can shift during the project execution due to unaccounted-for events (purchased component lead times, delay in payment, delay in signatures, etc.).",
            ]}
          />

          <div className="terms-heading">Payment Terms</div>
          <div className="pay-terms">
            <div>
              20% - Down Payment
              <div className="pay-sub">• Due upon invoice</div>
            </div>
            <div>
              70% - Shipment of Equipment
              <div className="pay-sub">• Net 10</div>
            </div>
            <div>
              10% - Production
              <div className="pay-sub">• Net 30</div>
            </div>
          </div>

          <TermsBlock
            heading="Tax Information"
            numbered
            items={[
              "All purchase orders made to Trinity Robotics Automation should state whether they are taxable or non-taxable.",
              "If Purchases are tax exempt, sales tax will be removed from the Sales Order Total.",
              "Tax exempt purchases will require proof of certification to Trinity Office Management.",
            ]}
          />

          <TermsBlock
            heading="Shipping / Freight / Rigging"
            numbered
            items={[
              "All Shipment, freight, and rigging costs are the responsibility of the client.",
              "Shipment, Freight, and Rigging will be billed on a separate invoice.",
            ]}
          />

          <TermsBlock
            heading="Contract Terms"
            numbered
            items={[
              'Trinity Robotics Automation, LLC. ("Trinity") retains a purchase money security interest in the goods that are subject to this contract to secure payment by customer. Upon request, customer will execute a UCC-1 Financing Statement to perfect Trinity\'s security interest.',
              "Payment in full on the balance of this Contract must be made upon terms noted on the SO.",
              "Late payments are subject to a financing charge of 1.5 percent per month on the unpaid balance.",
              "Financing is the responsibility of Customer.",
              "If an action is brought to enforce or interpret this Contract, the prevailing party will be reimbursed for all costs and expenses, including reasonable attorney's fees, disbursements, and other costs.",
            ]}
          />

          {/* Signatures */}
          <div className="sig-notice">
            No contract shall result from this order until purchaser's offer is accepted by the
            General Manager or Trinity Robotics Automation, LLC.
            <div className="sig-notice-sub">Price Valid for 60 days from date on Sales order</div>
          </div>
          <div className="sig-block">
            <div className="sig-line">
              Date: <span className="sig-fill" /> Title: <span className="sig-fill" /> Signature:{" "}
              <span className="sig-fill" />
            </div>
            <div className="sig-caption">I agree to the stated Terms and Conditions</div>
          </div>
          <div className="sig-block">
            <div className="sig-caption-top">Trinity Robotics Automation, LLC. Use Only.</div>
            <div className="sig-line">
              Date: <span className="sig-fill" /> Title: <span className="sig-fill" /> Signature:{" "}
              <span className="sig-fill" />
            </div>
            <div className="sig-caption">Trinity Robotics Automation, LLC. Accepts this order.</div>
          </div>

          <PageFooter page={4} total={totalPagesPrinted} />
        </section>

        <div className="np" style={{ textAlign: "center", padding: "16px 0" }}>
          <Link href="/">
            <Button variant="outline" size="sm">
              Configure Another System
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}

/* =================================================================== */
/*                         SUB-COMPONENTS                               */
/* =================================================================== */

function PageHeader({
  brand,
  title,
  qnum,
  date,
}: {
  brand: ReturnType<typeof brandForSlug>;
  title: string;
  qnum: string;
  date: string;
}) {
  return (
    <header className="ph">
      <div className="ph-left">
        {brand.seriesLogo ? (
          <img src={brand.seriesLogo} alt="Trinity" className="ph-series-logo" />
        ) : (
          <div className="ph-series-ai">
            <img src={`${import.meta.env.BASE_URL}trinity-logo.jpeg`} alt="Trinity" className="ph-series-ai-logo" />
          </div>
        )}
        <div className="ph-tagline">
          <div className="ph-tagline-1">{brand.tagline[0]}</div>
          <div className="ph-tagline-2">{brand.tagline[1]}</div>
        </div>
      </div>
      <div className="ph-right">
        <div className="ph-title">{title}</div>
        <div className="ph-meta">Quotation: {qnum}</div>
        <div className="ph-meta">
          Date: <b>{date}</b>
        </div>
      </div>
    </header>
  );
}

function PageFooter({ page, total }: { page: number; total: number }) {
  return (
    <footer className="pf">
      <div className="pf-logo-wrap">
        <img src={`${import.meta.env.BASE_URL}proposal-assets/trinity-footer-logo.png`} alt="Trinity" className="pf-logo" />
      </div>
      <div className="pf-lines">
        <div>Trinityautomation.com &nbsp;&nbsp;▪&nbsp;&nbsp; Sales@trinityautomation.com &nbsp;&nbsp;▪&nbsp;&nbsp; (800) 762-6864</div>
        <div>NorCal - 431 Nelo Street Santa Clara, CA 95054 &nbsp;&nbsp;▪&nbsp;&nbsp; SoCal - 4582 Brickell Privado Ontario, CA 91761</div>
      </div>
      <div className="pf-pagenum">
        Page {page} | {total}
      </div>
    </footer>
  );
}

type Row = {
  partNumber: string;
  name: string;
  bullets: string[];
  unitPrice: string;
  qty: number | string;
  subTotal: string;
};

function ProductTable({
  rows,
  showPrice,
}: {
  rows: Row[];
  showPrice: "included" | "show";
}) {
  return (
    <table className="product-table">
      <thead>
        <tr>
          <th style={{ width: "16%" }}>Part Number</th>
          <th>Description</th>
          <th style={{ width: "13%" }}>Unit Price</th>
          <th style={{ width: "6%" }}>Qty.</th>
          <th style={{ width: "13%" }}>Extended Price</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="pt-part">{r.partNumber}</td>
            <td>
              <div className="pt-name">{r.name}</div>
              {r.bullets.length > 0 && (
                <ul className="pt-bullets">
                  {r.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              )}
            </td>
            <td className="pt-price">{showPrice === "included" ? "Included" : r.unitPrice}</td>
            <td className="pt-price">{r.qty}</td>
            <td className="pt-price">{showPrice === "included" ? "Included" : r.subTotal}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function KPI({
  label,
  value,
  green,
}: {
  label: string;
  value: string;
  green?: boolean;
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${green ? "green" : ""}`}>{value}</div>
    </div>
  );
}

function HourlyCostGrid({ fp, rp }: { fp: FP; rp: RP }) {
  const hpd = (rp.mannedShifts + rp.unmannedShifts) * rp.hrsPerShift;
  const daily = fp.monthlyPayment / 30;
  const hourly = hpd > 0 ? daily / hpd : 0;
  return (
    <>
      <div className="roi-kpis">
        <KPI label="Monthly" value={m0(Math.round(fp.monthlyPayment))} />
        <KPI label="Daily" value={m0(Math.round(daily))} />
        <KPI label="Hourly" value={m2(hourly)} />
        <KPI label="Hrs / Day" value={String(hpd)} />
      </div>
      <div className="roi-assumptions">
        Based on {fp.termMonths}-month financing ·{" "}
        {rp.mannedShifts + rp.unmannedShifts} shifts × {rp.hrsPerShift} hrs = {hpd} hrs/day
      </div>
    </>
  );
}

function TermsBlock({
  heading,
  items,
  numbered,
}: {
  heading: string;
  items: string[];
  numbered?: boolean;
}) {
  return (
    <div className="terms-block">
      <div className="terms-heading">{heading}</div>
      {items.map((it, i) => (
        <div key={i} className="terms-item">
          {numbered ? <span className="terms-num">({i + 1})</span> : null}
          <span>{it}</span>
        </div>
      ))}
    </div>
  );
}

/* Build standard-products rows, grouping the base machine into one big bullet list to match reference */
function buildStdRows(std: Opt[], machineName: string, basePrice: number): Row[] {
  // Try to find the "main" standard item (usually the machine with many bullet descriptions)
  // Fall back to listing each standard opt as its own row.
  if (std.length === 0) return [];

  // Heuristic: if the first standard option belongs to the cnc-integration / machine category
  // we render one "machine row" with all included bullets pulled from descriptions.
  const rows: Row[] = [];
  for (const o of std) {
    const raw = o.description || "";
    const bullets = raw
      .split(/(?:\n|(?<=[.])\s+(?=[A-Z]))/)
      .map((l) => l.trim().replace(/\.$/, ""))
      .filter((l) => l.length > 2);
    rows.push({
      partNumber: o.partNumber || machineName,
      name: o.name,
      bullets,
      unitPrice: "Included",
      qty: 1,
      subTotal: "Included",
    });
  }

  // First row's partNumber: if the first std item has no partNumber, synthesize something like AX2-16_G5
  if (!std[0].partNumber) {
    rows[0].partNumber =
      machineName.replace(/\s+/g, "-") + "_G" + Math.max(1, std.length % 9);
  }
  return rows;
}

/* =================================================================== */
/*                              STYLES                                  */
/* =================================================================== */

const STYLES = `
/* ===== Page sizing & print ===== */
.prop {
  font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
  color: #1a1a1a;
  background: #e5e7eb;
  padding: 24px 0;
}
.prop .page {
  width: 8.5in;
  min-height: 11in;
  margin: 0 auto 24px;
  padding: 0.45in 0.55in 0.55in;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; background: #fff; }
  .np { display: none !important; }
  .prop { background: #fff; padding: 0; }
  .prop .page {
    margin: 0;
    box-shadow: none;
    page-break-after: always;
    break-after: page;
    padding: 0.45in 0.55in 0.55in;
  }
  .prop .page:last-of-type {
    page-break-after: auto;
  }
  @page { size: letter; margin: 0; }
}

/* ===== Header ===== */
.ph {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;
}
.ph-left { display: flex; flex-direction: column; gap: 4px; }
.ph-series-logo { height: 30px; width: auto; display: block; }
.ph-series-ai { display: flex; align-items: center; gap: 4px; }
.ph-series-ai-logo { height: 32px; width: auto; }
.ph-tagline { margin-top: 2px; }
.ph-tagline-1 { font-size: 10.5px; font-weight: 700; color: #1a1a1a; line-height: 1.15; }
.ph-tagline-2 { font-size: 10.5px; color: #333; line-height: 1.15; }
.ph-right { text-align: right; }
.ph-title { font-size: 15px; color: #6a6a6a; font-weight: 500; line-height: 1.1; }
.ph-meta { font-size: 11px; color: #6a6a6a; margin-top: 2px; line-height: 1.2; }
.ph-meta b { color: #1a1a1a; font-weight: 600; }

/* ===== Cover ===== */
.cover-title { margin-top: 6px; }
.cover-title-main { font-size: 34px; font-weight: 800; letter-spacing: -0.5px; line-height: 1; color: #111; }
.cover-title-sub  { font-size: 22px; color: #6a6a6a; font-weight: 500; margin-top: 2px; line-height: 1.1; }
.cover-title-bar  { width: 30px; height: 3px; background: #1a1a1a; margin-top: 14px; }
.cover-hero-wrap  { display: flex; justify-content: center; margin: 14px 0 18px; }
.cover-hero       { max-width: 5.8in; width: 100%; height: auto; display: block; }
.cover-divider    { border: none; border-top: 1px solid #bfbfbf; margin: 8px auto 12px; width: 4.8in; }
.prepared-grid    { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 0 auto; width: 5.6in; }
.prepared-label   { font-size: 12px; font-weight: 500; color: #1a1a1a; margin-bottom: 4px; }
.prepared-body    { font-size: 10.5px; line-height: 1.55; color: #1a1a1a; padding-left: 6px; }

/* ===== Section titles ===== */
.section-title {
  font-size: 16px;
  font-weight: 500;
  color: #1a1a1a;
  margin: 10px 0 6px;
  padding: 0;
}

/* ===== Config grid ===== */
.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  border: 1px solid #c9c9c9;
  margin-bottom: 12px;
}
.config-col { display: flex; flex-direction: column; }
.config-col + .config-col { border-left: 1px solid #c9c9c9; }
.config-col-header {
  background: #c9c9c9;
  color: #1a1a1a;
  font-weight: 700;
  padding: 6px 10px;
  font-size: 11px;
}
.config-col-body { padding: 8px 10px 12px; font-size: 10.5px; line-height: 1.5; }
.config-col-body ul { margin: 0; padding-left: 16px; list-style: disc; }
.config-col-body ul ul { list-style: circle; padding-left: 16px; margin-top: 2px; }
.config-col-body li { margin: 1px 0; }

/* ===== Product table ===== */
.product-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 10.5px; }
.product-table th {
  background: #6f6f6f;
  color: #fff;
  text-align: left;
  padding: 6px 10px;
  font-weight: 500;
  font-size: 10.5px;
}
.product-table th:nth-child(2) { text-align: left; }
.product-table th:nth-child(3),
.product-table th:nth-child(4),
.product-table th:nth-child(5) { text-align: center; }
.product-table td {
  border: 1px solid #e0e0e0;
  padding: 8px 10px;
  vertical-align: top;
  background: #fff;
}
.product-table tr:nth-child(even) td { background: #f6f6f6; }
.product-table .pt-part { text-align: center; font-weight: 500; }
.product-table .pt-price { text-align: center; }
.product-table .pt-name { font-weight: 700; margin-bottom: 2px; }
.product-table .pt-bullets {
  margin: 2px 0 0 0;
  padding-left: 16px;
  list-style: disc;
  line-height: 1.45;
}
.product-table .pt-bullets li { margin: 1px 0; }

/* ===== Pricing summary ===== */
.pricing-summary {
  margin-top: 10px;
  padding: 8px 0 4px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  border-top: 1px solid #c9c9c9;
}
.pricing-row {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  font-size: 11px;
  padding: 1px 0;
  min-width: 3in;
}
.pricing-row.muted { color: #555; }
.pricing-row.total {
  font-size: 13px;
  font-weight: 700;
  border-top: 1px solid #1a1a1a;
  padding-top: 4px;
  margin-top: 2px;
}

/* ===== BAQ Banner ===== */
.baq-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  background: linear-gradient(90deg, #fff7e0 0%, #fff 100%);
  border-left: 3px solid #D4A843;
  border-radius: 3px;
  margin: 0 0 10px;
  font-size: 10px;
}
.baq-banner-tag {
  font-weight: 700;
  color: #8a6b10;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  font-size: 9px;
}
.baq-banner-note { color: #555; }

/* ===== Financing ===== */
.fin-hero {
  background: #f7f7f7;
  border-radius: 6px;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.fin-hero-label { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #666; }
.fin-hero-value { font-size: 26px; font-weight: 800; color: #1a1a1a; margin-top: 2px; line-height: 1; }
.fin-hero-value.gold { color: #D4A843; }
.fin-hero-unit { font-size: 14px; color: #666; font-weight: 600; }
.fin-hero-note { font-size: 10px; color: #555; margin-top: 2px; }
.fin-hero-right { text-align: right; }

.fin-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
.fin-table td { padding: 5px 10px; border-bottom: 1px solid #eee; font-size: 10.5px; }
.fin-table td:first-child { color: #333; }
.fin-table td.r { text-align: right; font-weight: 600; }

/* ===== ROI KPIs ===== */
.roi-kpis {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 8px;
}
.kpi {
  background: #f7f7f7;
  border-radius: 5px;
  padding: 8px 10px;
  text-align: center;
}
.kpi-label { font-size: 8px; text-transform: uppercase; letter-spacing: .6px; color: #666; }
.kpi-value { font-size: 18px; font-weight: 700; color: #1a1a1a; margin-top: 3px; line-height: 1.1; }
.kpi-value.green { color: #0fa06e; }

.roi-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 4px 0 10px; }
.roi-chip {
  background: #f7f7f7;
  border-radius: 4px;
  padding: 6px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.roi-chip-label { font-size: 10px; color: #555; font-weight: 500; }
.roi-chip-value { font-size: 15px; font-weight: 700; color: #0fa06e; }

/* ===== Benefit breakdown ===== */
.benefit-title {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: .8px;
  font-weight: 700;
  color: #555;
  margin: 10px 0 6px;
}
.benefit-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 5px 0;
  border-bottom: 1px solid #f0f0f0;
}
.benefit-name { font-weight: 600; font-size: 11px; }
.benefit-formula { font-size: 9px; color: #888; margin-top: 1px; }
.benefit-value { font-size: 11px; font-weight: 700; color: #0fa06e; }
.benefit-total {
  display: flex;
  justify-content: space-between;
  border-top: 2px solid #1a1a1a;
  padding: 7px 0;
  font-size: 13px;
  font-weight: 800;
  margin-top: 4px;
}
.benefit-total .green { color: #0fa06e; }

.sec179 {
  background: #f7f7f7;
  border-radius: 4px;
  padding: 8px 12px;
  margin-top: 8px;
  font-size: 10.5px;
  line-height: 1.45;
}
.roi-assumptions {
  font-size: 8.5px;
  color: #888;
  margin-top: 6px;
  text-align: left;
}
.gold { color: #D4A843; }
.green { color: #0fa06e; }

/* ===== Terms & Conditions ===== */
.terms-block { margin-bottom: 10px; }
.terms-heading {
  font-size: 12px;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
  margin: 10px 0 4px;
  color: #1a1a1a;
}
.terms-item {
  font-size: 10px;
  line-height: 1.5;
  padding-left: 18px;
  text-indent: -18px;
  margin: 2px 0;
  color: #1a1a1a;
}
.terms-num { display: inline-block; width: 22px; }
.pay-terms { font-size: 10px; line-height: 1.5; padding-left: 4px; margin-bottom: 4px; }
.pay-sub { padding-left: 18px; }

.sig-notice {
  text-align: center;
  font-size: 10px;
  color: #444;
  margin: 14px 0 8px;
  padding-top: 10px;
  border-top: 1px solid #ddd;
}
.sig-notice-sub { font-weight: 700; margin-top: 3px; color: #1a1a1a; }
.sig-block {
  border-top: 1px solid #c9c9c9;
  padding: 10px 0;
  margin-top: 6px;
}
.sig-caption-top {
  text-align: center;
  font-size: 10px;
  color: #666;
  margin-bottom: 6px;
}
.sig-line { font-size: 10px; color: #1a1a1a; }
.sig-fill {
  display: inline-block;
  border-bottom: 1px solid #333;
  min-width: 130px;
  margin: 0 6px;
  height: 1em;
  vertical-align: bottom;
}
.sig-caption {
  text-align: center;
  font-size: 10px;
  font-weight: 600;
  margin-top: 6px;
}

/* ===== Page footer ===== */
.pf {
  margin-top: auto;
  padding-top: 12px;
  text-align: center;
  position: relative;
}
.pf-logo-wrap { display: flex; justify-content: center; margin-bottom: 4px; }
.pf-logo { height: 24px; width: auto; }
.pf-lines {
  font-size: 9px;
  color: #333;
  line-height: 1.45;
}
.pf-pagenum {
  position: absolute;
  right: 0;
  bottom: 0;
  font-size: 9px;
  color: #555;
}
`;
