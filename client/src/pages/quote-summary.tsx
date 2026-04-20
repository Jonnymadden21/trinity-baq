import { useMemo, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer, Download, Loader2 } from "lucide-react";
import type { Quote } from "@shared/schema";

type Opt = { id: number; name: string; partNumber: string | null; description?: string; price: number; isStandard: boolean; category: string };
type FP = { downPaymentPct: number; termMonths: number; interestRate: number; downPayment: number; financedAmount: number; monthlyPayment: number; totalCost: number };
type RP = { shopRate: number; hrsPerShift: number; operatorWage: number; workingDays: number; mannedShifts: number; unmannedShifts: number; capacityMult: number; totalGainRev: number; mannedGainRev: number; unmannedGainRev: number; mannedGainHrs: number; unmannedGainHrs: number; laborSaving: number; netBenefit: number; paybackMonths: number; year1ROI: number; year3ROI: number; year5ROI: number; taxSavings: number; effectiveCost: number };

const $ = (n: number, f = 0) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: f, maximumFractionDigits: f });
const safe = <T,>(v: string | null | undefined, fb: T): T => { if (!v) return fb; try { return JSON.parse(v) as T; } catch { return fb; } };

const BM: Record<string, string[]> = {
  "ax1-12": ["ax1-spec.pdf"], "ax1-18": ["ax1-spec.pdf"],
  "ax2-16": ["ax2-brochure.pdf", "ax2-spec.pdf"], "ax2-24": ["ax2-brochure.pdf", "ax2-spec.pdf"],
  "ax2-16-duo": ["ax2-duo-brochure.pdf", "ax2-duo-spec.pdf"], "ax2-24-duo": ["ax2-duo-brochure.pdf", "ax2-duo-spec.pdf"],
  "ax4-12": ["ax4-spec.pdf"], "ax4-12-hd": ["ax4-spec.pdf"],
  "ax5-20": ["ax5-brochure.pdf", "ax5-spec.pdf"], "ax5-20-hd": ["ax5-hd-brochure.pdf"],
  "ai-part-loader": ["ai-part-loader.pdf"],
};

export default function QuoteSummary() {
  const { quoteNumber } = useParams<{ quoteNumber: string }>();
  const [exp, setExp] = useState(false);
  const { data: quote, isLoading } = useQuery<Quote>({ queryKey: [`/api/quotes/${quoteNumber}`] });

  const p = useMemo(() => {
    if (!quote) return null;
    return { opts: safe<Opt[]>(quote.selectedOptions, []), fp: safe<FP | null>(quote.financingParams, null), rp: safe<RP | null>(quote.roiParams, null) };
  }, [quote]);

  const handleBr = useCallback(async () => {
    if (!quote || !p) return; setExp(true);
    try { const { exportQuotePdf } = await import("@/lib/pdf-export"); await exportQuotePdf({ quote, options: p.opts, financing: p.fp, roi: p.rp }); }
    catch (e) { console.error(e); } finally { setExp(false); }
  }, [quote, p]);

  if (isLoading) return <div className="min-h-screen bg-white flex items-center justify-center"><Skeleton className="h-96 w-full max-w-4xl" /></div>;
  if (!quote || !p) return <div className="min-h-screen bg-white flex items-center justify-center"><p>Quote not found</p></div>;

  const { fp, rp } = p;
  const std = p.opts.filter(o => o.isStandard);
  const add = p.opts.filter(o => !o.isStandard && o.price > 0);
  const stdByCat = groupBy(std, "category");
  const addByCat = groupBy(add, "category");
  const sr = quote.machineName.startsWith("Ai") ? "Ai" : "AX";
  const slug = quote.machineName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const hasBr = !!BM[slug];

  const hc = rp && fp ? (() => {
    const hpd = (rp.mannedShifts + rp.unmannedShifts) * rp.hrsPerShift;
    const daily = fp.monthlyPayment / 30;
    return { hpd, daily, hourly: hpd > 0 ? daily / hpd : 0 };
  })() : null;

  return (
    <>
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }
          .np { display: none !important; }
          .pb { page-break-after: always; }
          @page { margin: 0.5in 0.6in 1in 0.6in; }
          .print-ft { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; padding: 6px 0.6in; font-size: 7.5px; color: #aaa; border-top: 1px solid #eee; background: #fff; }
          .print-ft img { height: 14px; margin: 0 auto 2px; display: block; }
          .ft-inline { display: none !important; }
        }
        @media screen { .print-ft { display: none; } }
        .pr { font-family: -apple-system, 'Segoe UI', system-ui, sans-serif; color: #1a1a1a; line-height: 1.45; font-size: 10px; }
        .pr table { border-collapse: collapse; width: 100%; }
        .pr th { background: #4a4a4a; color: #fff; font-weight: 600; padding: 5px 8px; text-align: left; font-size: 9px; vertical-align: middle; }
        .pr td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 9.5px; vertical-align: middle; }
        .pr tr:nth-child(even) td { background: #fafafb; }
        .pr .g { color: #D4A843; } .pr .m { color: #888; } .pr .gn { color: #0fa06e; }
        .pr .hd { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #eee; padding-bottom: 8px; margin-bottom: 14px; }
        .pr .st { font-size: 14px; font-weight: 700; margin: 18px 0 3px; } .pr .gb { width: 50px; height: 2px; background: #D4A843; margin-bottom: 10px; }
        .pr .ft-inline { text-align: center; padding: 8px 0; margin-top: 14px; border-top: 1px solid #eee; font-size: 7.5px; color: #aaa; }
        .pr .cg { display: grid; grid-template-columns: 1fr 1fr 1fr; border: 1px solid #ddd; font-size: 9.5px; margin-bottom: 14px; }
        .pr .ch { background: #4a4a4a; color: #fff; font-weight: 600; padding: 4px 8px; font-size: 9px; }
        .pr .cc { padding: 8px; border-right: 1px solid #ddd; line-height: 1.5; } .pr .cc:last-child { border-right: none; }
        .pr .kg { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px; margin-bottom: 10px; }
        .pr .kb { background: #f5f5f5; border-radius: 4px; padding: 7px; text-align: center; }
        .pr .kl { font-size: 7px; text-transform: uppercase; letter-spacing: .5px; color: #888; margin: 0; } .pr .kv { font-size: 16px; font-weight: 700; margin: 2px 0 0; }
        .pr .br { display: flex; justify-content: space-between; align-items: flex-start; padding: 4px 0; border-bottom: 1px solid #f0f0f0; } .pr .bd { font-size: 8px; color: #999; }
        .pr .tt { font-size: 11px; font-weight: 700; border-bottom: 1px solid #1a1a1a; padding-bottom: 1px; margin: 10px 0 4px; }
        .pr .ti { font-size: 8.5px; padding-left: 14px; margin-bottom: 2px; line-height: 1.45; }
        .pr .sl { border-bottom: 1px solid #333; display: inline-block; min-width: 150px; margin: 0 4px; }
      `}</style>

      {/* Fixed footer that appears at bottom of every printed page */}
      <div className="print-ft">
        <img src="/trinity-logo.jpeg" alt="Trinity" />
        <p>Trinityautomation.com • Sales@trinityautomation.com • (800) 762-6864</p>
        <p>NorCal - 431 Nelo Street Santa Clara, CA 95054 • SoCal - 4582 Brickell Privado Ontario, CA 91761</p>
      </div>

      <div className="np border-b bg-white sticky top-0 z-40">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/"><button className="flex items-center gap-2 text-gray-500 hover:text-gray-900"><ArrowLeft className="h-4 w-4" /><span className="text-sm">Back</span></button></Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-black" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Save as PDF</Button>
            {hasBr && <Button variant="outline" size="sm" className="text-black" onClick={handleBr} disabled={exp}>
              {exp ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</> : <><Download className="h-4 w-4 mr-2" />PDF + Brochures</>}
            </Button>}
          </div>
        </div>
      </div>

      <div className="pr mx-auto max-w-[8.5in] px-[0.6in] py-6 bg-white">

        {/* ===== COVER ===== */}
        <div className="pb">
          <Hd s={sr} q={quote} first />
          <div style={{ background: "#f5f5f5", borderRadius: 6, padding: "24px 20px", margin: "16px 0" }}>
            <div className="g" style={{ fontSize: 24, fontWeight: 800 }}>Trinity{sr} Series</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>High Performance CNC Automation</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{quote.machineName}</div>
            <div className="m" style={{ fontSize: 10, marginTop: 4 }}>Automated CNC Production Made Easy · Since 2004</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, margin: "14px 0", borderTop: "1px solid #eee", paddingTop: 12 }}>
            <div>
              <div className="m" style={{ fontSize: 9, marginBottom: 4 }}>Prepared For:</div>
              <div style={{ fontWeight: 600, fontSize: 11 }}>{quote.customerName}</div>
              {quote.customerPhone && <div className="m">{quote.customerPhone}</div>}
              <div className="m">{quote.customerEmail}</div>
              {quote.customerCompany && <div className="m">{quote.customerCompany}</div>}
            </div>
            <div>
              <div className="m" style={{ fontSize: 9, marginBottom: 4 }}>Trinity Contact:</div>
              <div style={{ fontWeight: 600, fontSize: 11 }}>Trinity Automation</div>
              <div className="m">(800) 762-6864</div>
              <div className="m">sales@trinityautomation.com</div>
              <div className="m">4582 Brickell Privado, Ontario, CA 91761</div>
            </div>
          </div>

          <div style={{ background: "#f5f5f5", borderRadius: 6, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="m" style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: 1 }}>Total System Price</div>
              <div className="g" style={{ fontSize: 22, fontWeight: 800 }}>{$(quote.totalPrice, 2)}</div>
            </div>
            {fp && <div style={{ textAlign: "right" }}>
              <div className="m" style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: 1 }}>Estimated Monthly</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{$(Math.round(fp.monthlyPayment))}/mo</div>
              <div className="m" style={{ fontSize: 9 }}>{fp.termMonths} mo @ {fp.interestRate}% APR</div>
            </div>}
          </div>
          <Ft />
        </div>

        {/* ===== CONFIG + PRODUCTS ===== */}
        <div className="pb">
          <Hd s={sr} q={quote} />
          <div className="st">Configuration Details</div><div className="gb" />
          <div className="cg">
            <div><div className="ch">{sr} Configuration</div><div className="cc">
              <p>• {sr} – {quote.machineName}</p><p>• Voltage – 220 VAC, 3 Phase, 40 AMPS</p>
            </div></div>
            <div><div className="ch">CNC Machine Configuration</div><div className="cc">
              <p>• CNC Machine Details</p><p>• Manufacturer – TBD</p><p>• Model – TBD</p><p>• Controller – TBD</p><p>• Automation Entry – TBD</p>
            </div></div>
            <div><div className="ch">Logistics</div><div className="cc">
              <p>• Lead Time – 8 weeks</p><p>• FOB – Shipping Point</p><p>• Shipping – Customer Supplied</p><p>• Shipment Prep – Trinity Supplied</p>
              <p>• Payment Terms:</p><p style={{ paddingLeft: 8 }}>○ 20% Down</p><p style={{ paddingLeft: 8 }}>○ 70% Shipment</p><p style={{ paddingLeft: 8 }}>○ 10% Production</p>
            </div></div>
          </div>

          <div className="st">Standard Products & Services</div><div className="gb" />
          <table>
            <thead><tr><th style={{ width: "15%" }}>Part Number</th><th>Description</th><th style={{ width: "12%" }}>Unit Price</th><th style={{ width: "6%" }}>Qty.</th><th style={{ width: "12%" }}>Sub-Total</th></tr></thead>
            <tbody>
              {Array.from(stdByCat.entries()).map(([cat, opts]) => opts.map((o, i) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 500, fontSize: 9 }}>{o.partNumber || "—"}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{o.name}</div>
                    {o.description && <div className="m" style={{ fontSize: 8.5, marginTop: 1, lineHeight: 1.4 }}>{o.description}</div>}
                  </td>
                  <td>Included</td><td>1</td><td>Included</td>
                </tr>
              )))}
            </tbody>
          </table>

          {add.length > 0 && <>
            <div className="st">Selected Options</div><div className="gb" />
            <table>
              <thead><tr><th style={{ width: "15%" }}>Part Number</th><th>Description</th><th style={{ width: "12%" }}>Unit Price</th><th style={{ width: "6%" }}>Qty.</th><th style={{ width: "12%" }}>Sub-Total</th></tr></thead>
              <tbody>
                {add.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 500, fontSize: 9 }}>{o.partNumber || "—"}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.name}</div>
                      {o.description && <div className="m" style={{ fontSize: 8.5, marginTop: 1, lineHeight: 1.4 }}>{o.description}</div>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{$(o.price, 2)}</td><td>1</td><td style={{ fontWeight: 600 }}>{$(o.price, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>}

          <div style={{ textAlign: "right", fontSize: 10, marginTop: 10, borderTop: "1px solid #ddd", paddingTop: 6 }}>
            <p>{sr} System Price: <b>{$(quote.totalPrice, 2)}</b></p>
            <p className="m">Tax (%): TBD</p>
            <p>Equipment Total <b>{$(quote.totalPrice, 2)}</b></p>
            <p className="m">Approx. Freight: TBD</p>
            <p className="m">Approx. Rigging: TBD</p>
            <p style={{ borderTop: "2px solid #1a1a1a", paddingTop: 4, marginTop: 4, fontSize: 12, fontWeight: 700 }}>Total: {$(quote.totalPrice, 2)}</p>
          </div>
          <Ft />
        </div>

        {/* ===== FINANCING + HOURLY + ROI ===== */}
        {(fp || rp) && <div className="pb">
          <Hd s={sr} q={quote} />

          {fp && <>
            <div className="st">Financing Summary</div><div className="gb" />
            <div style={{ background: "#f5f5f5", borderRadius: 6, padding: "10px 14px", marginBottom: 8 }}>
              <div className="m" style={{ fontSize: 7, textTransform: "uppercase", letterSpacing: 1 }}>Estimated Monthly Payment</div>
              <div className="g" style={{ fontSize: 20, fontWeight: 800 }}>{$(Math.round(fp.monthlyPayment))}/mo</div>
            </div>
            <table><tbody>
              <tr><td style={{ fontWeight: 600 }}>Down Payment ({fp.downPaymentPct}%)</td><td style={{ textAlign: "right", fontWeight: 600 }}>{$(Math.round(fp.downPayment))}</td></tr>
              <tr><td>Financed Amount</td><td style={{ textAlign: "right", fontWeight: 600 }}>{$(Math.round(fp.financedAmount))}</td></tr>
              <tr><td>Term / Rate</td><td style={{ textAlign: "right", fontWeight: 600 }}>{fp.termMonths} months @ {fp.interestRate}% APR</td></tr>
              <tr><td>Total Cost of Financing</td><td style={{ textAlign: "right", fontWeight: 600 }}>{$(Math.round(fp.totalCost))}</td></tr>
            </tbody></table>
            {rp && rp.netBenefit > 0 && <div style={{ background: "#f0fdf4", borderRadius: 4, padding: "6px 12px", margin: "6px 0", fontSize: 10 }}>
              Monthly cost <b>{$(Math.round(fp.monthlyPayment))}</b> vs. monthly benefit <b className="gn">{$(Math.round(rp.netBenefit / 12))}</b>
              {rp.netBenefit / 12 > fp.monthlyPayment && <span className="gn" style={{ fontWeight: 700 }}> — This system pays for itself from day one.</span>}
            </div>}
          </>}

          {hc && fp && <>
            <div className="st">Hourly Cost to Operate</div><div className="gb" />
            <div className="kg">
              <div className="kb"><div className="kl">Monthly</div><div className="kv">{$(Math.round(fp.monthlyPayment))}</div></div>
              <div className="kb"><div className="kl">Daily</div><div className="kv">{$(Math.round(hc.daily))}</div></div>
              <div className="kb"><div className="kl">Hourly</div><div className="kv">{$(hc.hourly, 2)}</div></div>
              <div className="kb"><div className="kl">Hrs/Day</div><div className="kv">{hc.hpd}</div></div>
            </div>
            <div className="m" style={{ fontSize: 7.5 }}>Based on {fp.termMonths}-month financing · {rp!.mannedShifts + rp!.unmannedShifts} shifts × {rp!.hrsPerShift} hrs = {hc.hpd} hrs/day</div>
          </>}

          {rp && <>
            <div className="st">Return on Investment</div><div className="gb" />
            <div className="kg">
              <div className="kb"><div className="kl">Net Annual Benefit</div><div className="kv gn">{$(Math.round(rp.netBenefit))}</div></div>
              <div className="kb"><div className="kl">Payback Period</div><div className="kv gn">{rp.paybackMonths > 0 && rp.paybackMonths < 120 ? `${rp.paybackMonths.toFixed(1)} mo` : "120+"}</div></div>
              <div className="kb"><div className="kl">Year 5 ROI</div><div className="kv gn">{Math.round(rp.year5ROI)}%</div></div>
              <div className="kb"><div className="kl">Capacity</div><div className="kv">{rp.capacityMult.toFixed(1)}x</div></div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
              {([["Year 1", rp.year1ROI], ["Year 3", rp.year3ROI], ["Year 5", rp.year5ROI]] as [string, number][]).map(([l, v]) => (
                <div key={l} style={{ background: "#f5f5f5", borderRadius: 4, padding: "4px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="m" style={{ fontSize: 9 }}>{l}</span><span className="gn" style={{ fontSize: 14, fontWeight: 700 }}>{Math.round(v)}%</span>
                </div>
              ))}
            </div>

            <div className="m" style={{ fontSize: 7, textTransform: "uppercase", letterSpacing: .5, fontWeight: 700, marginBottom: 5 }}>Annual Benefit Breakdown</div>
            <div className="br"><div><div style={{ fontWeight: 600 }}>Manned Shift Improvement</div><div className="bd">{rp.mannedGainHrs?.toFixed(1)} hrs/day × ${rp.shopRate} × {rp.workingDays} days</div></div><div className="gn" style={{ fontWeight: 600 }}>{$(Math.round(rp.mannedGainRev ?? 0))}</div></div>
            {rp.unmannedShifts > 0 && <div className="br"><div><div style={{ fontWeight: 600 }}>Unmanned Shift — <span className="g">NEW REVENUE</span></div><div className="bd">{rp.unmannedGainHrs?.toFixed(1)} hrs/day × ${rp.shopRate} × {rp.workingDays} days</div></div><div className="gn" style={{ fontWeight: 600 }}>{$(Math.round(rp.unmannedGainRev ?? 0))}</div></div>}
            <div className="br"><div><div style={{ fontWeight: 600 }}>Labor Reallocation Value</div><div className="bd">{rp.mannedGainHrs?.toFixed(1)} hrs × ${rp.operatorWage} × {rp.workingDays} days × 50%</div></div><div className="gn" style={{ fontWeight: 600 }}>{$(Math.round(rp.laborSaving))}</div></div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #1a1a1a", padding: "6px 0", fontSize: 12, fontWeight: 700, marginTop: 2 }}>
              <div>NET ANNUAL BENEFIT</div><div className="gn">{$(Math.round(rp.netBenefit))}</div>
            </div>

            <div style={{ background: "#f5f5f5", borderRadius: 4, padding: "6px 12px", marginTop: 6, fontSize: 9 }}>
              <b>Section 179 Tax Benefit</b> — Tax Savings: <b>{$(Math.round(rp.taxSavings))}</b> · Effective Cost: <b>{$(Math.round(rp.effectiveCost))}</b> · Adjusted Payback: <b>{rp.paybackMonths > 0 && rp.paybackMonths < 120 ? (rp.paybackMonths * 0.79).toFixed(1) + " mo" : "—"}</b>
            </div>
            <div className="m" style={{ fontSize: 7, marginTop: 3 }}>Based on {rp.mannedShifts} manned + {rp.unmannedShifts} unmanned shifts · {rp.hrsPerShift} hrs/shift · ${rp.shopRate}/hr shop rate · {rp.workingDays} working days/year</div>
          </>}
          <Ft />
        </div>}

        {/* ===== TERMS & CONDITIONS + SIGNATURES ===== */}
        <Hd s={sr} q={quote} />

        <TC t="General Assumptions" items={[
          "(1) Trinity will require Client to provide utility connections (including Electricity and Clean Dry Shop Air) to specified locations. All drops will have disconnects and will be de-energized until system power up.",
          "(2) Trinity is not responsible for any local permits. All city, Fire, Environmental, Seismic, etc. permits are the sole responsibility of the client.",
          "(3) Trinity is not responsible for any alterations needed to the building for the installation of this system. These include alterations needed to the walls, floors, ceiling, structure, or any existing building alterations required to install the quoted system.",
          "(4) Trinity is not responsible for any Structural Engineering Calculations or Services.",
          "(5) Installation hours are budgeted to take place during normal business hours 8:00 AM – 5:00 PM.",
          "(6) Client will provide and ensure level flooring for equipment mounting.",
          "(7) Client to provide Seismic Engineering & Title 24 calculations, if required.",
          "(8) (If Applicable) Trinity is not responsible for any limitations placed on the installation that are driven by local permitting entities.",
        ]} />

        <TC t="Warranty Information" items={[
          "(1) Trinity Robotics Automation, LLC. warrants the purchased materials and workmanship provided by Trinity to be free of defects for the period of one (1) year from the date in which SAT run-off is completed and signed off by the client or agreed upon production runs begin (whichever event happens first).",
        ]} />

        <TC t="Lead Time" items={[
          "Delivery and completion of the equipment is based upon receipt and acceptance of Client purchase order, down payment, and contractual signature at Trinity's facility in Ontario, California. Lead times can shift during the project execution due to unaccounted-for events (purchased component lead times, delay in payment, delay in signatures, etc.).",
        ]} />

        <TC t="Payment Terms" items={["20% - Down Payment · Due upon invoice", "70% - Shipment of Equipment · Net 10", "10% - Production · Net 30"]} />

        <TC t="Tax Information" items={[
          "(1) All purchase orders made to Trinity Robotics Automation should state whether they are taxable or non-taxable.",
          "(2) If purchases are tax exempt, sales tax will be removed from the Sales Order Total.",
          "(3) Tax exempt purchases will require proof of certification to Trinity Office Management.",
        ]} />

        <TC t="Shipping / Freight / Rigging" items={[
          "(1) All shipment, freight, and rigging costs are the responsibility of the client.",
        ]} />

        <TC t="Contract Terms" items={[
          '(1) Trinity Robotics Automation, LLC. ("Trinity") retains a purchase money security interest in the goods that are subject to this contract to secure payment by customer. Upon request, customer will execute a UCC-1 Financing Statement to perfect Trinity\'s security interest.',
          "(2) Payment in full on the balance of this Contract must be made upon terms noted on the SO.",
          "(3) Late payments are subject to a financing charge of 1.5 percent per month on the unpaid balance.",
          "(4) Financing is the responsibility of Customer.",
          "(5) If an action is brought to enforce or interpret this Contract, the prevailing party will be reimbursed for all costs and expenses, including reasonable attorney's fees, disbursements, and other costs.",
          "(6) Limited Warranty – Does not apply to used equipment. (a) If a defect arises during the Warranty Period, Trinity, at its option will(i) repair the Product at no charge using new parts or parts that are equivalent to new in performance and reliability, (ii) exchange the Product with same Product configuration or with your consent, exchange a product that is at least functionally equivalent to the product it replaces, or (iii) refund the original purchase price. (b) Goods that have been subject to abuse, misuse, accident, alteration, neglect, unauthorized repair or installation are not covered by this limited warranty. (c) Except for the Limited Warranty expressly stated here, Trinity makes no warranty in connection with this Contract and hereby disclaims any and all implied or statutory warranties, including, but not limited to, all implied warranties or title, merchantability, nonfringement and fitness for a particular purpose.",
          "(7) Limitations on Liability (a) Trinity will not be liable for any loss, damage, cost, expense or penalty resulting from failure or delay in performance due to causes beyond the reasonable control of Trinity, including but not limited to supplier delay, force majeure, act of God, labor unrest, fire, explosion, earthquake, or by excess demand for its products. (b) In no event will Trinity be liable for (i) damages in excess of the purchase price for the goods and services that are subject to this Contract, or (ii) special, consequential, incidental or indirect damages.",
        ]} />

        {/* Signatures */}
        <div style={{ textAlign: "center", margin: "16px 0 10px", borderTop: "1px solid #ddd", paddingTop: 10 }}>
          <div className="m" style={{ fontSize: 9 }}>No contract shall result from this order until purchaser's offer is accepted by the General Manager or Trinity Robotics Automation, LLC.</div>
          <div style={{ fontSize: 9, fontWeight: 600, marginTop: 2 }}>Price Valid for 60 days from date on Sales order</div>
        </div>
        <div style={{ borderTop: "1px solid #ccc", padding: "12px 0" }}>
          <p style={{ fontSize: 9 }}>Date: <span className="sl" /> Title: <span className="sl" /> Signature: <span className="sl" /></p>
          <p style={{ textAlign: "center", fontSize: 9, fontWeight: 600, marginTop: 3 }}>I agree to the stated Terms and Conditions</p>
        </div>
        <div style={{ borderTop: "1px solid #ccc", padding: "12px 0", marginTop: 8 }}>
          <p style={{ textAlign: "center", fontSize: 9, marginBottom: 8 }} className="m">Trinity Robotics Automation, LLC. Use Only.</p>
          <p style={{ fontSize: 9 }}>Date: <span className="sl" /> Title: <span className="sl" /> Signature: <span className="sl" /></p>
          <p style={{ textAlign: "center", fontSize: 9, fontWeight: 600, marginTop: 3 }}>Trinity Robotics Automation, LLC. Accepts this order.</p>
        </div>
        <Ft />

        <div className="np" style={{ textAlign: "center", padding: "16px 0" }}>
          <Link href="/"><Button variant="outline" size="sm">Configure Another System</Button></Link>
        </div>
      </div>
    </>
  );
}

function Hd({ s, q, first }: { s: string; q: Quote; first?: boolean }) {
  return (
    <div className="hd">
      <div>
        <img src="/trinity-logo.jpeg" alt="Trinity" style={{ height: first ? 32 : 24 }} />
        {first && <div style={{ fontSize: 9, fontWeight: 600, marginTop: 2 }}>Automated Machine Tending</div>}
        {!first && <div className="m" style={{ fontSize: 7.5 }}>Automated Pallet Systems</div>}
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: first ? 15 : 11, fontWeight: 600 }}>{s} Automation Sales Quotation</div>
        <div className="m" style={{ fontSize: first ? 10 : 9 }}>Quotation: {q.quoteNumber}</div>
        <div className="m" style={{ fontSize: first ? 10 : 9 }}>Date: {new Date(q.createdAt).toLocaleDateString()}</div>
      </div>
    </div>
  );
}

function Ft() { return <div className="ft-inline"><img src="/trinity-logo.jpeg" alt="Trinity" style={{ height: 16, margin: "0 auto 2px", display: "block" }} /><p>Trinityautomation.com • Sales@trinityautomation.com • (800) 762-6864</p><p>NorCal - 431 Nelo Street Santa Clara, CA 95054 • SoCal - 4582 Brickell Privado Ontario, CA 91761</p></div>; }

function TC({ t, items }: { t: string; items: string[] }) { return <div style={{ marginBottom: 6 }}><div className="tt">{t}</div>{items.map((item, i) => <p key={i} className="ti">{item}</p>)}</div>; }

function groupBy(arr: Opt[], key: keyof Opt): Map<string, Opt[]> {
  const m = new Map<string, Opt[]>();
  for (const item of arr) { const k = String(item[key]); const b = m.get(k); if (b) b.push(item); else m.set(k, [item]); }
  return m;
}
