import { useMemo, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer, Download, Loader2 } from "lucide-react";
import type { Quote } from "@shared/schema";

type SelectedOption = { id: number; name: string; partNumber: string | null; price: number; isStandard: boolean; category: string };
type FP = { downPaymentPct: number; termMonths: number; interestRate: number; downPayment: number; financedAmount: number; monthlyPayment: number; totalCost: number };
type RP = { shopRate: number; hrsPerShift: number; operatorWage: number; workingDays: number; mannedShifts: number; unmannedShifts: number; capacityMult: number; totalGainRev: number; mannedGainRev: number; unmannedGainRev: number; mannedGainHrs: number; unmannedGainHrs: number; laborSaving: number; netBenefit: number; paybackMonths: number; year1ROI: number; year3ROI: number; year5ROI: number; taxSavings: number; effectiveCost: number; totalAutoHrs: number };

const $ = (n: number, f = 0) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: f, maximumFractionDigits: f });
const safe = <T,>(v: string | null | undefined, fb: T): T => { if (!v) return fb; try { return JSON.parse(v) as T; } catch { return fb; } };

const BROCHURE_MAP: Record<string, string[]> = {
  "ax1-12": ["ax1-spec.pdf"], "ax1-18": ["ax1-spec.pdf"],
  "ax2-16": ["ax2-brochure.pdf", "ax2-spec.pdf"], "ax2-24": ["ax2-brochure.pdf", "ax2-spec.pdf"],
  "ax2-16-duo": ["ax2-duo-brochure.pdf", "ax2-duo-spec.pdf"], "ax2-24-duo": ["ax2-duo-brochure.pdf", "ax2-duo-spec.pdf"],
  "ax4-12": ["ax4-spec.pdf"], "ax4-12-hd": ["ax4-spec.pdf"],
  "ax5-20": ["ax5-brochure.pdf", "ax5-spec.pdf"], "ax5-20-hd": ["ax5-hd-brochure.pdf"],
};

export default function QuoteSummary() {
  const { quoteNumber } = useParams<{ quoteNumber: string }>();
  const [exporting, setExporting] = useState(false);
  const { data: quote, isLoading } = useQuery<Quote>({ queryKey: [`/api/quotes/${quoteNumber}`] });

  const p = useMemo(() => {
    if (!quote) return null;
    return { opts: safe<SelectedOption[]>(quote.selectedOptions, []), fp: safe<FP | null>(quote.financingParams, null), rp: safe<RP | null>(quote.roiParams, null) };
  }, [quote]);

  const handleBrochures = useCallback(async () => {
    if (!quote || !p) return;
    setExporting(true);
    try { const { exportQuotePdf } = await import("@/lib/pdf-export"); await exportQuotePdf({ quote, options: p.opts, financing: p.fp, roi: p.rp }); }
    catch (e) { console.error(e); } finally { setExporting(false); }
  }, [quote, p]);

  if (isLoading) return <div className="min-h-screen bg-white flex items-center justify-center"><Skeleton className="h-96 w-full max-w-4xl" /></div>;
  if (!quote || !p) return <div className="min-h-screen bg-white flex items-center justify-center"><p>Quote not found</p></div>;

  const { fp, rp } = p;
  const std = p.opts.filter(o => o.isStandard);
  const add = p.opts.filter(o => !o.isStandard && o.price > 0);
  const s = quote.machineName.startsWith("Ai") ? "Ai" : "AX";
  const slug = quote.machineName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const hasBr = !!BROCHURE_MAP[slug];

  const hourlyCost = rp ? (() => {
    const totalShifts = rp.mannedShifts + rp.unmannedShifts;
    const hrsPerDay = totalShifts * rp.hrsPerShift;
    const hrsPerYear = hrsPerDay * rp.workingDays;
    const monthlyPmt = fp ? fp.monthlyPayment : quote.totalPrice / 60;
    const dailyCost = monthlyPmt / 30;
    const hourlyCostVal = hrsPerDay > 0 ? dailyCost / hrsPerDay : 0;
    return { hrsPerDay, hrsPerYear, dailyCost, hourlyCost: hourlyCostVal };
  })() : null;

  return (
    <>
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }
          .no-print { display: none !important; }
          .prop { font-size: 9.5pt; }
          .prop table { font-size: 9pt; }
          .cover-break { page-break-after: always; }
        }
        .prop { font-family: -apple-system, 'Segoe UI', system-ui, sans-serif; color: #1a1a1a; line-height: 1.4; }
        .prop table { border-collapse: collapse; width: 100%; margin-bottom: 6px; }
        .prop th { background: #4a4a4a; color: white; font-weight: 600; text-align: left; padding: 5px 8px; font-size: 10px; }
        .prop td { padding: 4px 8px; border-bottom: 1px solid #eee; font-size: 10px; }
        .prop tr:nth-child(even) td { background: #fafafa; }
        .prop .g { color: #D4A843; }
        .prop .m { color: #888; font-size: 10px; }
        .prop .grn { color: #10a06e; }
        .prop .hdr { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 8px; margin-bottom: 12px; border-bottom: 2px solid #eee; }
        .prop .logo { height: 32px; }
        .prop .stit { font-size: 15px; font-weight: 700; margin: 16px 0 2px; }
        .prop .gbar { width: 50px; height: 2px; background: #D4A843; margin-bottom: 10px; }
        .prop .ft { text-align: center; padding: 10px 0; margin-top: 16px; border-top: 1px solid #eee; font-size: 8px; color: #aaa; }
        .prop .cfgrid { display: grid; grid-template-columns: 1fr 1fr 1fr; border: 1px solid #ddd; margin-bottom: 12px; font-size: 10px; }
        .prop .cfhd { background: #4a4a4a; color: white; font-weight: 600; padding: 4px 8px; font-size: 10px; }
        .prop .cfcl { padding: 8px; border-right: 1px solid #ddd; }
        .prop .cfcl:last-child { border-right: none; }
        .prop .kgrid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px; }
        .prop .kbox { background: #f5f5f5; border-radius: 4px; padding: 8px; text-align: center; }
        .prop .klab { font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; }
        .prop .kval { font-size: 17px; font-weight: 700; }
        .prop .brow { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f0f0f0; font-size: 10px; }
        .prop .brow .det { font-size: 8px; color: #999; }
        .prop .tc-title { font-size: 11px; font-weight: 700; border-bottom: 1px solid #1a1a1a; padding-bottom: 1px; margin: 10px 0 4px; }
        .prop .tc-item { font-size: 9px; padding-left: 14px; margin-bottom: 2px; line-height: 1.4; }
        .prop .sigline { border-bottom: 1px solid #333; display: inline-block; min-width: 160px; margin: 0 6px; }
      `}</style>

      <div className="no-print border-b bg-white sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/"><button className="flex items-center gap-2 text-gray-500 hover:text-gray-900"><ArrowLeft className="h-4 w-4" /><span className="text-sm">Back</span></button></Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-black" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Save as PDF</Button>
            {hasBr && <Button variant="outline" size="sm" className="text-black" onClick={handleBrochures} disabled={exporting}>
              {exporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</> : <><Download className="h-4 w-4 mr-2" />PDF + Brochures</>}
            </Button>}
          </div>
        </div>
      </div>

      <div className="prop mx-auto max-w-[8.5in] px-[0.6in] py-6 bg-white">

        {/* === COVER === */}
        <div className="cover-break">
          <div className="hdr">
            <div>
              <img src="/trinity-logo.jpeg" alt="Trinity" className="logo" />
              <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>Automated Machine Tending</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{s} Automation Sales Quotation</div>
              <div className="m">Quotation: {quote.quoteNumber}</div>
              <div className="m">Date: {new Date(quote.createdAt).toLocaleDateString()}</div>
            </div>
          </div>

          <div style={{ background: "#f5f5f5", borderRadius: 6, padding: "28px 24px", margin: "20px 0" }}>
            <div className="g" style={{ fontSize: 26, fontWeight: 800 }}>Trinity{s} Series</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>High Performance CNC Automation</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>{quote.machineName}</div>
            <div className="m" style={{ marginTop: 4 }}>Automated CNC Production Made Easy · Since 2004</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, margin: "20px 0", borderTop: "1px solid #eee", paddingTop: 16 }}>
            <div>
              <div className="m" style={{ marginBottom: 6 }}>Prepared For:</div>
              <div style={{ fontWeight: 600, fontSize: 12 }}>{quote.customerName}</div>
              {quote.customerPhone && <div className="m">{quote.customerPhone}</div>}
              <div className="m">{quote.customerEmail}</div>
              {quote.customerCompany && <div className="m">{quote.customerCompany}</div>}
            </div>
            <div>
              <div className="m" style={{ marginBottom: 6 }}>Trinity Contact:</div>
              <div style={{ fontWeight: 600, fontSize: 12 }}>Trinity Automation</div>
              <div className="m">(800) 762-6864</div>
              <div className="m">sales@trinityautomation.com</div>
              <div className="m">4582 Brickell Privado, Ontario, CA 91761</div>
            </div>
          </div>

          {/* Total price on cover */}
          <div style={{ background: "#f5f5f5", borderRadius: 6, padding: "14px 20px", margin: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="m" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1 }}>Total System Price</div>
              <div className="g" style={{ fontSize: 24, fontWeight: 800 }}>{$(quote.totalPrice, 2)}</div>
            </div>
            {fp && <div style={{ textAlign: "right" }}>
              <div className="m" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1 }}>Estimated Monthly</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{$(Math.round(fp.monthlyPayment))}/mo</div>
              <div className="m">{fp.termMonths} mo @ {fp.interestRate}% APR</div>
            </div>}
          </div>

          <Ft />
        </div>

        {/* === CONFIG + PRODUCTS + PRICING (one continuous flow) === */}
        <Hdr s={s} q={quote} />
        <div className="stit">Configuration Details</div><div className="gbar" />
        <div className="cfgrid">
          <div><div className="cfhd">{s} Configuration</div><div className="cfcl">
            <p>• {s} – {quote.machineName}</p><p>• Voltage – 220 VAC, 3 Phase, 40 AMPS</p>
          </div></div>
          <div><div className="cfhd">CNC Machine Configuration</div><div className="cfcl">
            <p>• CNC Machine Details</p><p>• Manufacturer – TBD</p><p>• Model – TBD</p><p>• Automation Entry – TBD</p>
          </div></div>
          <div><div className="cfhd">Logistics</div><div className="cfcl">
            <p>• Lead Time – 8 weeks</p><p>• FOB – Shipping Point</p><p>• Shipping – Customer Supplied</p>
            <p>• Payment Terms:</p><p style={{ paddingLeft: 10 }}>○ 20% Down</p><p style={{ paddingLeft: 10 }}>○ 70% Shipment</p><p style={{ paddingLeft: 10 }}>○ 10% Production</p>
          </div></div>
        </div>

        <div className="stit">Standard Products & Services</div><div className="gbar" />
        <table><thead><tr><th>Part Number</th><th>Description</th><th>Unit Price</th><th>Qty.</th><th>Sub-Total</th></tr></thead>
          <tbody>{std.map(o => <tr key={o.id}><td style={{ fontWeight: 500 }}>{o.partNumber || "—"}</td><td>{o.name}</td><td>Included</td><td>1</td><td>Included</td></tr>)}</tbody>
        </table>

        {add.length > 0 && <>
          <div className="stit">Selected Options</div><div className="gbar" />
          <table><thead><tr><th>Part Number</th><th>Description</th><th>Unit Price</th><th>Qty.</th><th>Sub-Total</th></tr></thead>
            <tbody>{add.map(o => <tr key={o.id}><td style={{ fontWeight: 500 }}>{o.partNumber || "—"}</td><td>{o.name}</td><td>{$(o.price, 2)}</td><td>1</td><td>{$(o.price, 2)}</td></tr>)}</tbody>
          </table>
        </>}

        <div style={{ textAlign: "right", fontSize: 11, marginTop: 12, borderTop: "1px solid #ddd", paddingTop: 8 }}>
          <p>{s} System Price: <b>{$(quote.totalPrice, 2)}</b></p>
          <p className="m">Tax (%): TBD</p>
          <p>Equipment Total <b>{$(quote.totalPrice, 2)}</b></p>
          <p className="m">Approx. Freight: TBD</p>
          <p className="m">Approx. Rigging: TBD</p>
          <p style={{ borderTop: "2px solid #1a1a1a", paddingTop: 4, marginTop: 4, fontSize: 13, fontWeight: 700 }}>Total: {$(quote.totalPrice, 2)}</p>
        </div>
        <Ft />

        {/* === FINANCING + ROI + HOURLY COST (continuous) === */}
        {(fp || rp) && <>
          <Hdr s={s} q={quote} />

          {fp && <>
            <div className="stit">Financing Summary</div><div className="gbar" />
            <div style={{ background: "#f5f5f5", borderRadius: 6, padding: "10px 16px", marginBottom: 10 }}>
              <div className="m" style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: 1 }}>Estimated Monthly Payment</div>
              <div className="g" style={{ fontSize: 22, fontWeight: 800 }}>{$(Math.round(fp.monthlyPayment))}/mo</div>
            </div>
            <table><tbody>
              <tr><td style={{ fontWeight: 600 }}>Down Payment ({fp.downPaymentPct}%)</td><td style={{ textAlign: "right", fontWeight: 600 }}>{$(Math.round(fp.downPayment))}</td></tr>
              <tr><td>Financed Amount</td><td style={{ textAlign: "right", fontWeight: 600 }}>{$(Math.round(fp.financedAmount))}</td></tr>
              <tr><td>Term / Rate</td><td style={{ textAlign: "right", fontWeight: 600 }}>{fp.termMonths} months @ {fp.interestRate}% APR</td></tr>
              <tr><td>Total Cost of Financing</td><td style={{ textAlign: "right", fontWeight: 600 }}>{$(Math.round(fp.totalCost))}</td></tr>
            </tbody></table>
            {rp && rp.netBenefit > 0 && (
              <div style={{ background: "#f0fdf4", borderRadius: 6, padding: "8px 14px", margin: "8px 0", fontSize: 11 }}>
                Monthly cost <b>{$(Math.round(fp.monthlyPayment))}</b> vs. monthly benefit <b className="grn">{$(Math.round(rp.netBenefit / 12))}</b>
                {rp.netBenefit / 12 > fp.monthlyPayment && <span className="grn" style={{ fontWeight: 700 }}> — This system pays for itself from day one.</span>}
              </div>
            )}
          </>}

          {/* Hourly Cost */}
          {hourlyCost && fp && <>
            <div className="stit">Hourly Cost to Operate</div><div className="gbar" />
            <div className="kgrid">
              <div className="kbox"><div className="klab">Monthly</div><div className="kval">{$(Math.round(fp.monthlyPayment))}</div></div>
              <div className="kbox"><div className="klab">Daily</div><div className="kval">{$(Math.round(hourlyCost.dailyCost))}</div></div>
              <div className="kbox"><div className="klab">Hourly</div><div className="kval">{$(hourlyCost.hourlyCost, 2)}</div></div>
              <div className="kbox"><div className="klab">Hrs/Day</div><div className="kval">{hourlyCost.hrsPerDay}</div></div>
            </div>
            <div className="m" style={{ fontSize: 8 }}>Based on {fp.termMonths}-month financing at {fp.interestRate}% APR · {rp!.mannedShifts + rp!.unmannedShifts} shifts × {rp!.hrsPerShift} hrs/shift = {hourlyCost.hrsPerDay} hrs/day</div>
          </>}

          {rp && <>
            <div className="stit">Return on Investment</div><div className="gbar" />
            <div className="kgrid">
              <div className="kbox"><div className="klab">Net Annual Benefit</div><div className="kval grn">{$(Math.round(rp.netBenefit))}</div></div>
              <div className="kbox"><div className="klab">Payback Period</div><div className="kval grn">{rp.paybackMonths > 0 && rp.paybackMonths < 120 ? `${rp.paybackMonths.toFixed(1)} mo` : "120+"}</div></div>
              <div className="kbox"><div className="klab">Year 5 ROI</div><div className="kval grn">{Math.round(rp.year5ROI)}%</div></div>
              <div className="kbox"><div className="klab">Capacity</div><div className="kval">{rp.capacityMult.toFixed(1)}x</div></div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
              {([["Year 1", rp.year1ROI], ["Year 3", rp.year3ROI], ["Year 5", rp.year5ROI]] as [string, number][]).map(([l, v]) => (
                <div key={l} style={{ background: "#f5f5f5", borderRadius: 4, padding: "5px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="m" style={{ fontSize: 10 }}>{l}</span><span className="grn" style={{ fontSize: 15, fontWeight: 700 }}>{Math.round(v)}%</span>
                </div>
              ))}
            </div>

            <div className="m" style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>Annual Benefit Breakdown</div>
            <div className="brow"><div><div>Manned Shift Improvement</div><div className="det">{rp.mannedGainHrs?.toFixed(1)} hrs/day × ${rp.shopRate} × {rp.workingDays} days</div></div><div className="grn" style={{ fontWeight: 600 }}>{$(Math.round(rp.mannedGainRev ?? 0))}</div></div>
            {rp.unmannedShifts > 0 && <div className="brow"><div><div>Unmanned Shift — <span className="g" style={{ fontWeight: 600 }}>NEW REVENUE</span></div><div className="det">{rp.unmannedGainHrs?.toFixed(1)} hrs/day × ${rp.shopRate} × {rp.workingDays} days</div></div><div className="grn" style={{ fontWeight: 600 }}>{$(Math.round(rp.unmannedGainRev ?? 0))}</div></div>}
            <div className="brow"><div><div>Labor Reallocation Value</div><div className="det">{rp.mannedGainHrs?.toFixed(1)} hrs × ${rp.operatorWage} × {rp.workingDays} days × 50%</div></div><div className="grn" style={{ fontWeight: 600 }}>{$(Math.round(rp.laborSaving))}</div></div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #1a1a1a", padding: "8px 0", fontSize: 13, fontWeight: 700 }}>
              <div>NET ANNUAL BENEFIT</div><div className="grn">{$(Math.round(rp.netBenefit))}</div>
            </div>

            <div style={{ background: "#f5f5f5", borderRadius: 6, padding: "8px 14px", marginTop: 8, fontSize: 10 }}>
              <b>Section 179 Tax Benefit</b> — Tax Savings: <b>{$(Math.round(rp.taxSavings))}</b> · Effective Cost: <b>{$(Math.round(rp.effectiveCost))}</b> · Adjusted Payback: <b>{rp.paybackMonths > 0 && rp.paybackMonths < 120 ? (rp.paybackMonths * 0.79).toFixed(1) + " mo" : "—"}</b>
            </div>
            <div className="m" style={{ fontSize: 8, marginTop: 4 }}>Based on {rp.mannedShifts} manned + {rp.unmannedShifts} unmanned shifts · {rp.hrsPerShift} hrs/shift · ${rp.shopRate}/hr shop rate · {rp.workingDays} working days/year</div>
          </>}
          <Ft />
        </>}

        {/* === TERMS + SIGNATURES (continuous) === */}
        <Hdr s={s} q={quote} />

        <TC t="General Assumptions" items={[
          "(1) Trinity will require Client to provide utility connections (including Electricity and Clean Dry Shop Air) to specified locations.",
          "(2) Trinity is not responsible for any local permits. All city, Fire, Environmental, Seismic, etc. permits are the sole responsibility of the client.",
          "(3) Trinity is not responsible for any alterations needed to the building for installation of this system.",
          "(4) Trinity is not responsible for any Structural Engineering Calculations or Services.",
          "(5) Installation hours are budgeted to take place during normal business hours 8:00 AM – 5:00 PM.",
          "(6) Client will provide and ensure level flooring for equipment mounting.",
          "(7) Client to provide Seismic Engineering & Title 24 calculations, if required.",
        ]} />
        <TC t="Warranty Information" items={["Trinity Robotics Automation, LLC. warrants the purchased materials and workmanship provided by Trinity to be free of defects for the period of one (1) year from the date in which SAT run-off is completed and signed off by the client or agreed upon production runs begin (whichever event happens first)."]} />
        <TC t="Lead Time" items={["Delivery and completion of the equipment is based upon receipt and acceptance of Client purchase order, down payment, and contractual signature at Trinity's facility in Ontario, California. Lead times can shift during the project execution due to unaccounted-for events."]} />
        <TC t="Payment Terms" items={["20% - Down Payment · Due upon invoice", "70% - Shipment of Equipment · Net 10", "10% - Production · Net 30"]} />
        <TC t="Tax Information" items={["(1) All purchase orders made to Trinity Robotics Automation should state whether they are taxable or non-taxable.", "(2) If purchases are tax exempt, sales tax will be removed from the Sales Order Total.", "(3) Tax exempt purchases will require proof of certification to Trinity Office Management."]} />
        <TC t="Shipping / Freight / Rigging" items={["(1) All shipment, freight, and rigging costs are the responsibility of the client."]} />
        <TC t="Contract Terms" items={[
          "(1) Trinity Robotics Automation, LLC. retains a purchase money security interest in the goods that are subject to this contract to secure payment by customer.",
          "(2) Payment in full on the balance of this Contract must be made upon terms noted on the SO.",
          "(3) Late payments are subject to a financing charge of 1.5 percent per month on the unpaid balance.",
          "(4) Financing is the responsibility of Customer.",
          "(5) If an action is brought to enforce or interpret this Contract, the prevailing party will be reimbursed for all costs and expenses.",
        ]} />

        {/* Signatures */}
        <div style={{ textAlign: "center", margin: "20px 0 14px", borderTop: "1px solid #ddd", paddingTop: 14 }}>
          <div className="m" style={{ fontSize: 10 }}>No contract shall result from this order until purchaser's offer is accepted by the General Manager or Trinity Robotics Automation, LLC.</div>
          <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>Price Valid for 60 days from date on Sales order</div>
        </div>
        <div style={{ borderTop: "1px solid #ccc", padding: "14px 0" }}>
          <p style={{ fontSize: 10 }}>Date: <span className="sigline" /> Title: <span className="sigline" /> Signature: <span className="sigline" /></p>
          <p style={{ textAlign: "center", fontSize: 10, fontWeight: 600, marginTop: 4 }}>I agree to the stated Terms and Conditions</p>
        </div>
        <div style={{ borderTop: "1px solid #ccc", padding: "14px 0", marginTop: 10 }}>
          <p style={{ textAlign: "center", fontSize: 10, marginBottom: 10 }} className="m">Trinity Robotics Automation, LLC. Use Only.</p>
          <p style={{ fontSize: 10 }}>Date: <span className="sigline" /> Title: <span className="sigline" /> Signature: <span className="sigline" /></p>
          <p style={{ textAlign: "center", fontSize: 10, fontWeight: 600, marginTop: 4 }}>Trinity Robotics Automation, LLC. Accepts this order.</p>
        </div>
        <Ft />

        <div className="no-print" style={{ textAlign: "center", padding: "20px 0" }}>
          <Link href="/"><Button variant="outline" size="sm">Configure Another System</Button></Link>
        </div>
      </div>
    </>
  );
}

function Hdr({ s, q }: { s: string; q: Quote }) {
  return (
    <div className="hdr">
      <div className="flex items-center gap-2">
        <img src="/trinity-logo.jpeg" alt="Trinity" style={{ height: 24 }} />
        <div className="m" style={{ fontSize: 8 }}>Automated Pallet Systems</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{s} Automation Sales Quotation</div>
        <div className="m" style={{ fontSize: 9 }}>Quotation: {q.quoteNumber}</div>
        <div className="m" style={{ fontSize: 9 }}>Date: {new Date(q.createdAt).toLocaleDateString()}</div>
      </div>
    </div>
  );
}

function Ft() {
  return (
    <div className="ft">
      <img src="/trinity-logo.jpeg" alt="Trinity" style={{ height: 18, margin: "0 auto 4px" }} />
      <p>Trinityautomation.com • Sales@trinityautomation.com • (800) 762-6864</p>
      <p>NorCal - 431 Nelo Street Santa Clara, CA 95054 • SoCal - 4582 Brickell Privado Ontario, CA 91761</p>
    </div>
  );
}

function TC({ t, items }: { t: string; items: string[] }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="tc-title">{t}</div>
      {items.map((item, i) => <p key={i} className="tc-item">{item}</p>)}
    </div>
  );
}
