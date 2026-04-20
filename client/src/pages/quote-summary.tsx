import { useMemo, useCallback, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer, Download, Loader2 } from "lucide-react";
import type { Quote } from "@shared/schema";

type SelectedOption = { id: number; name: string; partNumber: string | null; price: number; isStandard: boolean; category: string };
type FinancingParams = { downPaymentPct: number; termMonths: number; interestRate: number; downPayment: number; financedAmount: number; monthlyPayment: number; totalCost: number };
type RoiParams = { shopRate: number; hrsPerShift: number; operatorWage: number; workingDays: number; mannedShifts: number; unmannedShifts: number; capacityMult: number; totalGainRev: number; mannedGainRev: number; unmannedGainRev: number; mannedGainHrs: number; unmannedGainHrs: number; laborSaving: number; netBenefit: number; paybackMonths: number; year1ROI: number; year3ROI: number; year5ROI: number; taxSavings: number; effectiveCost: number };

const USD = (n: number, frac = 0) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: frac, maximumFractionDigits: frac });
const safeParse = <T,>(v: string | null | undefined, fb: T): T => { if (!v) return fb; try { return JSON.parse(v) as T; } catch { return fb; } };

const BROCHURE_MAP: Record<string, string[]> = {
  "ax1-12": ["ax1-spec.pdf"], "ax1-18": ["ax1-spec.pdf"],
  "ax2-16": ["ax2-brochure.pdf", "ax2-spec.pdf"], "ax2-24": ["ax2-brochure.pdf", "ax2-spec.pdf"],
  "ax2-16-duo": ["ax2-duo-brochure.pdf", "ax2-duo-spec.pdf"], "ax2-24-duo": ["ax2-duo-brochure.pdf", "ax2-duo-spec.pdf"],
  "ax4-12": ["ax4-spec.pdf"], "ax4-12-hd": ["ax4-spec.pdf"],
  "ax5-20": ["ax5-brochure.pdf", "ax5-spec.pdf"], "ax5-20-hd": ["ax5-hd-brochure.pdf"],
};

export default function QuoteSummary() {
  const { quoteNumber } = useParams<{ quoteNumber: string }>();
  const [isExporting, setIsExporting] = useState(false);
  const { data: quote, isLoading } = useQuery<Quote>({ queryKey: [`/api/quotes/${quoteNumber}`] });

  const parsed = useMemo(() => {
    if (!quote) return null;
    return {
      options: safeParse<SelectedOption[]>(quote.selectedOptions, []),
      fp: safeParse<FinancingParams | null>(quote.financingParams, null),
      rp: safeParse<RoiParams | null>(quote.roiParams, null),
    };
  }, [quote]);

  const handleDownloadWithBrochures = useCallback(async () => {
    if (!quote || !parsed) return;
    setIsExporting(true);
    try {
      const { exportQuotePdf } = await import("@/lib/pdf-export");
      await exportQuotePdf({ quote, options: parsed.options, financing: parsed.fp, roi: parsed.rp });
    } catch (err) { console.error("PDF export failed", err); }
    finally { setIsExporting(false); }
  }, [quote, parsed]);

  if (isLoading) return <div className="min-h-screen bg-white flex items-center justify-center"><Skeleton className="h-96 w-full max-w-4xl" /></div>;
  if (!quote || !parsed) return <div className="min-h-screen bg-white flex items-center justify-center"><p>Quote not found</p></div>;

  const { fp, rp } = parsed;
  const standardOpts = parsed.options.filter(o => o.isStandard);
  const addedOpts = parsed.options.filter(o => !o.isStandard && o.price > 0);
  const series = quote.machineName.startsWith("Ai") ? "Ai" : "AX";
  const slug = quote.machineName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const hasBrochures = !!BROCHURE_MAP[slug];

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-page { page-break-after: always; }
          .print-page:last-child { page-break-after: auto; }
          .proposal { font-size: 10pt; }
          .proposal table { font-size: 9pt; }
        }
        .proposal { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a1a; }
        .proposal table { border-collapse: collapse; width: 100%; }
        .proposal th { background: #4a4a4a; color: white; font-weight: 600; text-align: left; padding: 6px 10px; font-size: 11px; }
        .proposal td { padding: 5px 10px; border-bottom: 1px solid #e5e5e5; font-size: 11px; vertical-align: top; }
        .proposal tr:nth-child(even) td { background: #fafafa; }
        .proposal .gold { color: #D4A843; }
        .proposal .muted { color: #888; }
        .proposal .section-title { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
        .proposal .gold-bar { width: 60px; height: 3px; background: #D4A843; margin-bottom: 16px; }
        .proposal .header-bar { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e5e5e5; padding-bottom: 10px; margin-bottom: 20px; }
        .proposal .footer { text-align: center; padding: 16px 0; border-top: 1px solid #e5e5e5; margin-top: 30px; font-size: 9px; color: #999; }
        .proposal .config-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; border: 1px solid #ddd; }
        .proposal .config-col { padding: 12px; border-right: 1px solid #ddd; font-size: 11px; }
        .proposal .config-col:last-child { border-right: none; }
        .proposal .config-header { background: #4a4a4a; color: white; font-weight: 600; padding: 6px 12px; font-size: 11px; }
        .proposal .kpi-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; }
        .proposal .kpi-box { background: #f8f8f8; border-radius: 6px; padding: 12px; text-align: center; }
        .proposal .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 4px; }
        .proposal .kpi-value { font-size: 20px; font-weight: 700; }
        .proposal .kpi-value.green { color: #10a06e; }
        .proposal .breakdown-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
        .proposal .breakdown-row .detail { font-size: 9px; color: #999; }
        .proposal .breakdown-row.total { border-top: 2px solid #1a1a1a; border-bottom: none; font-weight: 700; font-size: 14px; padding-top: 10px; }
        .proposal .sig-line { border-bottom: 1px solid #1a1a1a; display: inline-block; min-width: 180px; margin: 0 8px; }
      `}</style>

      {/* Screen-only header */}
      <div className="no-print border-b bg-white sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/"><button className="flex items-center gap-2 text-gray-500 hover:text-gray-900"><ArrowLeft className="h-4 w-4" /><span className="text-sm">Back</span></button></Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Save as PDF</Button>
            {hasBrochures && (
              <Button variant="outline" size="sm" onClick={handleDownloadWithBrochures} disabled={isExporting}>
                {isExporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</> : <><Download className="h-4 w-4 mr-2" />PDF + Brochures</>}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="proposal mx-auto max-w-[8.5in] px-[0.6in] py-8 bg-white">

        {/* ========== PAGE 1: COVER ========== */}
        <div className="print-page">
          <div className="header-bar">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <svg width="28" height="28" viewBox="0 0 28 28"><polygon points="14,2 26,26 2,26" fill="#D4A843" /></svg>
                <span style={{ fontSize: 20, fontWeight: 700 }}>Trinity</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600 }}>Automated Machine Tending</div>
              <div className="muted" style={{ fontSize: 10 }}>Small/Medium Vertical Machining Centers</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{series} Automation Sales Quotation</div>
              <div className="muted" style={{ fontSize: 11 }}>Quotation: {quote.quoteNumber}</div>
              <div className="muted" style={{ fontSize: 11 }}>Date: {new Date(quote.createdAt).toLocaleDateString()}</div>
            </div>
          </div>

          {/* Machine hero */}
          <div style={{ background: "#f5f5f5", borderRadius: 8, padding: "40px 32px", margin: "30px 0", textAlign: "center" }}>
            <div className="gold" style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>Trinity{series} Series</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{quote.machineName}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>Automated CNC Production Made Easy · Since 2004</div>
          </div>

          {/* Prepared For / Trinity Contact */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, margin: "40px 0", borderTop: "1px solid #e5e5e5", paddingTop: 24 }}>
            <div>
              <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Prepared For:</div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{quote.customerName}</div>
              {quote.customerPhone && <div className="muted" style={{ fontSize: 11 }}>{quote.customerPhone}</div>}
              <div className="muted" style={{ fontSize: 11 }}>{quote.customerEmail}</div>
              {quote.customerCompany && <div className="muted" style={{ fontSize: 11 }}>{quote.customerCompany}</div>}
            </div>
            <div>
              <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Trinity Contact:</div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Trinity Automation</div>
              <div className="muted" style={{ fontSize: 11 }}>(800) 762-6864</div>
              <div className="muted" style={{ fontSize: 11 }}>sales@trinityautomation.com</div>
              <div className="muted" style={{ fontSize: 11 }}>4582 Brickell Privado</div>
              <div className="muted" style={{ fontSize: 11 }}>Ontario, CA 91761</div>
            </div>
          </div>

          <ProposalFooter quoteNumber={quote.quoteNumber} />
        </div>

        {/* ========== PAGE 2: CONFIGURATION + PRODUCTS ========== */}
        <div className="print-page">
          <ProposalHeader series={series} quoteNumber={quote.quoteNumber} date={quote.createdAt} />

          <div className="section-title">Configuration Details</div>
          <div className="gold-bar" />

          <div className="config-grid" style={{ marginBottom: 24 }}>
            <div>
              <div className="config-header">{series} Configuration</div>
              <div className="config-col">
                <p>• {series} – {quote.machineName}</p>
                <p>• Voltage – 220 VAC, 3 Phase, 40 AMPS</p>
              </div>
            </div>
            <div>
              <div className="config-header">CNC Machine Configuration</div>
              <div className="config-col">
                <p>• Manufacturer – TBD</p>
                <p>• Model – TBD</p>
                <p>• Controller – TBD</p>
                <p>• Automation Entry – TBD</p>
              </div>
            </div>
            <div>
              <div className="config-header">Logistics</div>
              <div className="config-col">
                <p>• Lead Time – 8 weeks</p>
                <p>• FOB – Shipping Point</p>
                <p>• Shipping – Customer Supplied</p>
                <p>• Payment Terms:</p>
                <p style={{ paddingLeft: 12 }}>○ 20% Down</p>
                <p style={{ paddingLeft: 12 }}>○ 70% Shipment</p>
                <p style={{ paddingLeft: 12 }}>○ 10% Production</p>
              </div>
            </div>
          </div>

          <div className="section-title">Standard Products & Services</div>
          <div className="gold-bar" />

          <table>
            <thead><tr><th>Part Number</th><th>Description</th><th>Unit Price</th><th>Qty.</th><th>Sub-Total</th></tr></thead>
            <tbody>
              {standardOpts.map(o => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{o.partNumber || "—"}</td>
                  <td>{o.name}</td>
                  <td>Included</td>
                  <td>1</td>
                  <td>Included</td>
                </tr>
              ))}
            </tbody>
          </table>

          {addedOpts.length > 0 && (
            <>
              <div className="section-title" style={{ marginTop: 24 }}>Selected Options</div>
              <div className="gold-bar" />
              <table>
                <thead><tr><th>Part Number</th><th>Description</th><th>Unit Price</th><th>Qty.</th><th>Sub-Total</th></tr></thead>
                <tbody>
                  {addedOpts.map(o => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{o.partNumber || "—"}</td>
                      <td>{o.name}</td>
                      <td>{USD(o.price, 2)}</td>
                      <td>1</td>
                      <td>{USD(o.price, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Pricing summary */}
          <div style={{ marginTop: 24, textAlign: "right", fontSize: 12 }}>
            <div style={{ borderTop: "1px solid #ccc", paddingTop: 12 }}>
              <p>{series} System Price: <strong>{USD(quote.totalPrice, 2)}</strong></p>
              <p className="muted">Tax (%): TBD</p>
              <p>Equipment Total <strong>{USD(quote.totalPrice, 2)}</strong></p>
              <p className="muted">Approx. Freight: TBD</p>
              <p className="muted">Approx. Rigging: TBD</p>
              <p style={{ borderTop: "2px solid #1a1a1a", paddingTop: 6, marginTop: 6, fontSize: 14, fontWeight: 700 }}>Total: {USD(quote.totalPrice, 2)}</p>
            </div>
          </div>

          <ProposalFooter quoteNumber={quote.quoteNumber} />
        </div>

        {/* ========== PAGE 3: FINANCING ========== */}
        {fp && (
          <div className="print-page">
            <ProposalHeader series={series} quoteNumber={quote.quoteNumber} date={quote.createdAt} />

            <div className="section-title">Financing Summary</div>
            <div className="gold-bar" />

            <div style={{ background: "#f8f8f8", borderRadius: 8, padding: "20px 24px", marginBottom: 20 }}>
              <div className="muted" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Estimated Monthly Payment</div>
              <div className="gold" style={{ fontSize: 28, fontWeight: 800 }}>{USD(Math.round(fp.monthlyPayment))}/mo</div>
            </div>

            <table>
              <tbody>
                <tr><td style={{ fontWeight: 600 }}>Down Payment ({fp.downPaymentPct}%)</td><td style={{ textAlign: "right", fontWeight: 600 }}>{USD(Math.round(fp.downPayment))}</td></tr>
                <tr><td>Financed Amount</td><td style={{ textAlign: "right", fontWeight: 600 }}>{USD(Math.round(fp.financedAmount))}</td></tr>
                <tr><td>Term / Rate</td><td style={{ textAlign: "right", fontWeight: 600 }}>{fp.termMonths} months @ {fp.interestRate}% APR</td></tr>
                <tr><td>Total Cost of Financing</td><td style={{ textAlign: "right", fontWeight: 600 }}>{USD(Math.round(fp.totalCost))}</td></tr>
              </tbody>
            </table>

            {rp && rp.netBenefit > 0 && (
              <div style={{ background: "#f0fdf4", borderRadius: 8, padding: 16, marginTop: 20, textAlign: "center" }}>
                <p style={{ fontSize: 12 }}>
                  Monthly cost <strong>{USD(Math.round(fp.monthlyPayment))}</strong> vs. monthly benefit <strong style={{ color: "#10a06e" }}>{USD(Math.round(rp.netBenefit / 12))}</strong>
                </p>
                {rp.netBenefit / 12 > fp.monthlyPayment && (
                  <p style={{ color: "#10a06e", fontWeight: 700, marginTop: 4 }}>This system pays for itself from day one.</p>
                )}
              </div>
            )}

            <ProposalFooter quoteNumber={quote.quoteNumber} />
          </div>
        )}

        {/* ========== PAGE 4: ROI ========== */}
        {rp && (
          <div className="print-page">
            <ProposalHeader series={series} quoteNumber={quote.quoteNumber} date={quote.createdAt} />

            <div className="section-title">Return on Investment</div>
            <div className="gold-bar" />

            <div className="kpi-grid" style={{ marginBottom: 20 }}>
              <div className="kpi-box"><div className="kpi-label">Net Annual Benefit</div><div className="kpi-value green">{USD(Math.round(rp.netBenefit))}</div></div>
              <div className="kpi-box"><div className="kpi-label">Payback Period</div><div className="kpi-value green">{rp.paybackMonths > 0 && rp.paybackMonths < 120 ? `${rp.paybackMonths.toFixed(1)} mo` : "120+"}</div></div>
              <div className="kpi-box"><div className="kpi-label">Year 5 ROI</div><div className="kpi-value green">{Math.round(rp.year5ROI)}%</div></div>
              <div className="kpi-box"><div className="kpi-label">Capacity</div><div className="kpi-value">{rp.capacityMult.toFixed(1)}x</div></div>
            </div>

            {/* ROI Timeline */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
              {[["Year 1", rp.year1ROI], ["Year 3", rp.year3ROI], ["Year 5", rp.year5ROI]].map(([label, val]) => (
                <div key={String(label)} style={{ background: "#f8f8f8", borderRadius: 6, padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="muted" style={{ fontSize: 11 }}>{String(label)}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#10a06e" }}>{Math.round(val as number)}%</span>
                </div>
              ))}
            </div>

            {/* Annual breakdown */}
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, color: "#888", marginBottom: 10 }}>Annual Benefit Breakdown</div>

            <div className="breakdown-row">
              <div><div>Manned Shift Improvement</div><div className="detail">{rp.mannedGainHrs?.toFixed(1)} hrs/day × ${rp.shopRate} × {rp.workingDays} days</div></div>
              <div style={{ fontWeight: 600, color: "#10a06e" }}>{USD(Math.round(rp.mannedGainRev ?? 0))}</div>
            </div>
            {rp.unmannedShifts > 0 && (
              <div className="breakdown-row">
                <div><div>Unmanned Shift — <span className="gold" style={{ fontWeight: 600 }}>NEW REVENUE</span></div><div className="detail">{rp.unmannedGainHrs?.toFixed(1)} hrs/day × ${rp.shopRate} × {rp.workingDays} days</div></div>
                <div style={{ fontWeight: 600, color: "#10a06e" }}>{USD(Math.round(rp.unmannedGainRev ?? 0))}</div>
              </div>
            )}
            <div className="breakdown-row">
              <div><div>Labor Reallocation Value</div><div className="detail">{rp.mannedGainHrs?.toFixed(1)} hrs × ${rp.operatorWage} × {rp.workingDays} days × 50%</div></div>
              <div style={{ fontWeight: 600, color: "#10a06e" }}>{USD(Math.round(rp.laborSaving))}</div>
            </div>
            <div className="breakdown-row total">
              <div>Net Annual Benefit</div>
              <div style={{ color: "#10a06e" }}>{USD(Math.round(rp.netBenefit))}</div>
            </div>

            {/* Section 179 */}
            <div style={{ background: "#f8f8f8", borderRadius: 8, padding: 16, marginTop: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Section 179 Tax Benefit</div>
              <div style={{ fontSize: 11 }}>
                Tax Savings: <strong>{USD(Math.round(rp.taxSavings))}</strong> · Effective Cost: <strong>{USD(Math.round(rp.effectiveCost))}</strong> · Adjusted Payback: <strong>{rp.paybackMonths > 0 && rp.paybackMonths < 120 ? (rp.paybackMonths * 0.79).toFixed(1) + " mo" : "—"}</strong>
              </div>
            </div>

            <p className="muted" style={{ fontSize: 9, marginTop: 12 }}>
              Based on {rp.mannedShifts} manned + {rp.unmannedShifts} unmanned shifts · {rp.hrsPerShift} hrs/shift · ${rp.shopRate}/hr shop rate · {rp.workingDays} working days/year
            </p>

            <ProposalFooter quoteNumber={quote.quoteNumber} />
          </div>
        )}

        {/* ========== PAGE 5: TERMS & CONDITIONS ========== */}
        <div className="print-page">
          <ProposalHeader series={series} quoteNumber={quote.quoteNumber} date={quote.createdAt} />

          <TC title="General Assumptions" items={[
            "(1) Trinity will require Client to provide utility connections (including Electricity and Clean Dry Shop Air) to specified locations. All drops will have disconnects and will be de-energized until system power up.",
            "(2) Trinity is not responsible for any local permits. All city, Fire, Environmental, Seismic, etc. permits are the sole responsibility of the client.",
            "(3) Trinity is not responsible for any alterations needed to the building for the installation of this system.",
            "(4) Trinity is not responsible for any Structural Engineering Calculations or Services.",
            "(5) Installation hours are budgeted to take place during normal business hours 8:00 AM – 5:00 PM.",
            "(6) Client will provide and ensure level flooring for equipment mounting.",
            "(7) Client to provide Seismic Engineering & Title 24 calculations, if required.",
          ]} />

          <TC title="Warranty Information" items={[
            "Trinity Robotics Automation, LLC. warrants the purchased materials and workmanship provided by Trinity to be free of defects for the period of one (1) year from the date in which SAT run-off is completed and signed off by the client or agreed upon production runs begin (whichever event happens first).",
          ]} />

          <TC title="Lead Time" items={[
            "Delivery and completion of the equipment is based upon receipt and acceptance of Client purchase order, down payment, and contractual signature at Trinity's facility in Ontario, California. Lead times can shift during the project execution due to unaccounted-for events.",
          ]} />

          <TC title="Payment Terms" items={[
            "20% - Down Payment · Due upon invoice",
            "70% - Shipment of Equipment · Net 10",
            "10% - Production · Net 30",
          ]} />

          <TC title="Tax Information" items={[
            "(1) All purchase orders made to Trinity Robotics Automation should state whether they are taxable or non-taxable.",
            "(2) If purchases are tax exempt, sales tax will be removed from the Sales Order Total.",
            "(3) Tax exempt purchases will require proof of certification to Trinity Office Management.",
          ]} />

          <TC title="Shipping / Freight / Rigging" items={[
            "(1) All shipment, freight, and rigging costs are the responsibility of the client.",
          ]} />

          <TC title="Contract Terms" items={[
            "(1) Trinity Robotics Automation, LLC. retains a purchase money security interest in the goods that are subject to this contract to secure payment by customer.",
            "(2) Payment in full on the balance of this Contract must be made upon terms noted on the SO.",
            "(3) Late payments are subject to a financing charge of 1.5 percent per month on the unpaid balance.",
            "(4) Financing is the responsibility of Customer.",
            "(5) If an action is brought to enforce or interpret this Contract, the prevailing party will be reimbursed for all costs and expenses, including reasonable attorney's fees, disbursements, and other costs.",
          ]} />

          <ProposalFooter quoteNumber={quote.quoteNumber} />
        </div>

        {/* ========== PAGE 6: SIGNATURE ========== */}
        <div>
          <ProposalHeader series={series} quoteNumber={quote.quoteNumber} date={quote.createdAt} />

          <div style={{ textAlign: "center", margin: "40px 0 30px" }}>
            <p className="muted" style={{ fontSize: 11 }}>No contract shall result from this order until purchaser's offer is accepted by the General Manager</p>
            <p className="muted" style={{ fontSize: 11 }}>or Trinity Robotics Automation, LLC.</p>
            <p style={{ fontSize: 11, fontWeight: 600, marginTop: 4 }}>Price Valid for 60 days from date on Sales order</p>
          </div>

          <div style={{ borderTop: "1px solid #ccc", padding: "24px 0" }}>
            <p style={{ fontSize: 11, marginBottom: 16 }}>
              Date: <span className="sig-line" /> Title: <span className="sig-line" /> Signature: <span className="sig-line" />
            </p>
            <p style={{ textAlign: "center", fontSize: 11, fontWeight: 600 }}>I agree to the stated Terms and Conditions</p>
          </div>

          <div style={{ borderTop: "1px solid #ccc", padding: "24px 0", marginTop: 20 }}>
            <p style={{ textAlign: "center", fontSize: 11, fontWeight: 600, marginBottom: 16 }} className="muted">Trinity Robotics Automation, LLC. Use Only.</p>
            <p style={{ fontSize: 11, marginBottom: 16 }}>
              Date: <span className="sig-line" /> Title: <span className="sig-line" /> Signature: <span className="sig-line" />
            </p>
            <p style={{ textAlign: "center", fontSize: 11, fontWeight: 600 }}>Trinity Robotics Automation, LLC. Accepts this order.</p>
          </div>

          <ProposalFooter quoteNumber={quote.quoteNumber} />
        </div>

        {/* Screen-only nav */}
        <div className="no-print" style={{ textAlign: "center", padding: "30px 0" }}>
          <Link href="/"><Button variant="outline" size="sm">Configure Another System</Button></Link>
        </div>
      </div>
    </>
  );
}

function ProposalHeader({ series, quoteNumber, date }: { series: string; quoteNumber: string; date: string }) {
  return (
    <div className="header-bar">
      <div className="flex items-center gap-2">
        <svg width="22" height="22" viewBox="0 0 28 28"><polygon points="14,2 26,26 2,26" fill="#D4A843" /></svg>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>Trinity</div>
          <div className="muted" style={{ fontSize: 8 }}>Automated Machine Tending</div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{series} Automation Sales Quotation</div>
        <div className="muted" style={{ fontSize: 10 }}>Quotation: {quoteNumber}</div>
        <div className="muted" style={{ fontSize: 10 }}>Date: {new Date(date).toLocaleDateString()}</div>
      </div>
    </div>
  );
}

function ProposalFooter({ quoteNumber }: { quoteNumber: string }) {
  return (
    <div className="footer">
      <div className="flex items-center justify-center gap-1 mb-1">
        <svg width="14" height="14" viewBox="0 0 28 28"><polygon points="14,2 26,26 2,26" fill="#D4A843" /></svg>
        <span style={{ fontWeight: 700, fontSize: 11, color: "#333" }}>Trinity</span>
      </div>
      <p>Trinityautomation.com • Sales@trinityautomation.com • (800) 762-6864</p>
      <p>NorCal - 431 Nelo Street Santa Clara, CA 95054 • SoCal - 4582 Brickell Privado Ontario, CA 91761</p>
    </div>
  );
}

function TC({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, borderBottom: "1px solid #1a1a1a", paddingBottom: 2, marginBottom: 8 }}>{title}</div>
      {items.map((item, i) => (
        <p key={i} style={{ fontSize: 10, lineHeight: 1.5, marginBottom: 4, paddingLeft: 16 }}>{item}</p>
      ))}
    </div>
  );
}
