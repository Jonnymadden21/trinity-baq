/**
 * /preview — renders the QuoteProposal with realistic demo data so you can
 * preview the full proposal layout without spinning up the DB / API.
 *
 * Use ?machine=ax2-16|ax2-24|ax5-20|ax5-20-hd|ai-part-loader to switch.
 */
import { useRoute } from "wouter";
import { useMemo } from "react";
import { QuoteProposal } from "./quote-summary";
import type { Quote } from "@shared/schema";

/* Demo quote data per-machine */
function makeDemoQuote(machineSlug: string): Quote {
  const map: Record<
    string,
    { name: string; base: number; prefix: string }
  > = {
    "ax1-12": { name: "AX1-12", base: 165000, prefix: "AX112" },
    "ax1-18": { name: "AX1-18", base: 175000, prefix: "AX118" },
    "ax2-16": { name: "AX2-16", base: 189245.12, prefix: "AX216" },
    "ax2-24": { name: "AX2-24", base: 195845, prefix: "AX224" },
    "ax2-16-duo": { name: "AX2-16 Duo", base: 225000, prefix: "AX216DUO" },
    "ax2-24-duo": { name: "AX2-24 Duo", base: 245000, prefix: "AX224DUO" },
    "ax4-12": { name: "AX4-12", base: 235000, prefix: "AX412" },
    "ax4-12-hd": { name: "AX4-12 HD", base: 275000, prefix: "AX412HD" },
    "ax5-20": { name: "AX5-20", base: 212082, prefix: "AX520" },
    "ax5-20-hd": { name: "AX5-20 HD", base: 277959, prefix: "AX520HD" },
    "ai-part-loader": {
      name: "Ai Part Loader",
      base: 115900,
      prefix: "AI1",
    },
  };
  const info = map[machineSlug] ?? map["ax2-24"];

  const installPrice = 6995;
  const isAi = info.name.startsWith("Ai");

  const options = [
    {
      id: 1,
      name: isAi
        ? "Trinity Ai Machine Tending Cell"
        : `Automated Pallet System for Small/Medium Vertical Machining Centers`,
      partNumber: isAi ? "Trinity Ai" : `${info.name}_G5`,
      description: isAi
        ? "Six Axis Industrial Robot. Equipped with Robot Controller, Connection Cables, and Robot software options. Robot Gripper with Schunk pneumatic gripper. Trinity Integrated System Base with Steel construction / powder coated finish. Operator Interface with wired tablet control. Fully functional safety interface / Clear fencing panels."
        : 'Six Axis Industrial Robot – 35 KG Max Robot Payload. Robot Gripper with Standard Schunk Single Pallet Gripper. Integrated Pallet Storage. Max Work Holding + Part Size 16" Diameter x 9" Height. Operator Interface with 15" Touch Screen. Trinity Work Cell with Fully Integrated Enclosure. AX / CNC Integration. Active Drying Station. Operator Rotary Load Station. Shipment Preparation.',
      price: info.base,
      isStandard: true,
      category: "Standard Products",
    },
    {
      id: 2,
      name: "Integrated In-Machine CNC Zero-Point Interface",
      partNumber: "AX.A176",
      description:
        "In-Machine CNC Zero-Point Work Holding Package. Zero-Point Receiver with single Schunk Vero-S clamping module. Integration to CNC Table. Controls Package with Clamp Confirmation Detection. Blow offs for contact surfaces.",
      price: 0,
      isStandard: true,
      category: "Standard Products",
    },
    {
      id: 3,
      name: "Trinity Certified Pallets",
      partNumber: "AX.A157",
      description:
        'A3 Style Blank Pallet - No Hole Pattern. Standard duty – Single Pull stud for single Schunk Vero-S Receiver. Approx. 7.5" Diameter x 1.5".',
      price: 0,
      isStandard: true,
      category: "Standard Products",
    },
    {
      id: 10,
      name: "Installation / Integration",
      partNumber: "AX.INST",
      description:
        "Trinity technician on-site for installation / machine integration. Includes on-site time & travel expenses. Normal business hours 8:00 AM – 5:00 PM.",
      price: installPrice,
      isStandard: false,
      category: "Installation & Services",
    },
  ];

  const totalPrice = info.base + installPrice;

  /* Financing: 10% down, 60mo, 6.5% APR */
  const fp = (() => {
    const downPct = 10;
    const rate = 6.5;
    const term = 60;
    const downPayment = totalPrice * (downPct / 100);
    const principal = totalPrice - downPayment;
    const r = rate / 100 / 12;
    const monthlyPayment =
      r > 0
        ? (principal * (r * Math.pow(1 + r, term))) /
          (Math.pow(1 + r, term) - 1)
        : principal / term;
    const totalCost = downPayment + monthlyPayment * term;
    return {
      downPaymentPct: downPct,
      termMonths: term,
      interestRate: rate,
      downPayment,
      financedAmount: principal,
      monthlyPayment,
      totalCost,
    };
  })();

  /* ROI: 1 manned + 1 unmanned, 8 hrs/shift, $125/hr, 250 working days */
  const rp = (() => {
    const shopRate = 125;
    const workingDays = 250;
    const hrsPerShift = 8;
    const mannedShifts = 1;
    const unmannedShifts = 1;
    const operatorWage = 30;
    const mannedUtilBefore = 26,
      mannedUtilAfter = 80;
    const unmannedUtilBefore = 0,
      unmannedUtilAfter = 70;
    const mannedHrs = mannedShifts * hrsPerShift;
    const mannedGainHrs =
      (mannedHrs * (mannedUtilAfter - mannedUtilBefore)) / 100;
    const mannedGainRev = mannedGainHrs * shopRate * workingDays;
    const unmannedHrs = unmannedShifts * hrsPerShift;
    const unmannedGainHrs =
      (unmannedHrs * (unmannedUtilAfter - unmannedUtilBefore)) / 100;
    const unmannedGainRev = unmannedGainHrs * shopRate * workingDays;
    const laborSaving = operatorWage * mannedGainHrs * workingDays * 0.5;
    const totalGainRev = mannedGainRev + unmannedGainRev;
    const netBenefit = totalGainRev + laborSaving;
    const paybackMonths = (totalPrice / netBenefit) * 12;
    const year1ROI = ((netBenefit - totalPrice) / totalPrice) * 100;
    const year3ROI = ((netBenefit * 3 - totalPrice) / totalPrice) * 100;
    const year5ROI = ((netBenefit * 5 - totalPrice) / totalPrice) * 100;
    const capacityMult =
      ((mannedHrs * mannedUtilAfter) / 100 +
        (unmannedHrs * unmannedUtilAfter) / 100) /
      Math.max(0.01, (mannedHrs * mannedUtilBefore) / 100);
    const taxSavings = totalPrice * 0.21;
    return {
      shopRate,
      hrsPerShift,
      operatorWage,
      workingDays,
      mannedShifts,
      unmannedShifts,
      mannedUtilBefore,
      mannedUtilAfter,
      unmannedUtilBefore,
      unmannedUtilAfter,
      mannedGainHrs,
      unmannedGainHrs,
      mannedGainRev,
      unmannedGainRev,
      totalGainRev,
      laborSaving,
      netBenefit,
      paybackMonths,
      year1ROI,
      year3ROI,
      year5ROI,
      capacityMult,
      taxSavings,
      effectiveCost: totalPrice - taxSavings,
    };
  })();

  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const yy = String(today.getFullYear()).slice(2);

  return {
    id: 0,
    quoteNumber: `SEL-${mm}${dd}${yy}A-${info.prefix}`,
    machineName: info.name,
    machineId: 1,
    customerName: "Mike Gillen",
    customerEmail: "MGillen@selwaytool.com",
    customerCompany: "Selway Machine Tool",
    customerPhone: "(510) 475-4712",
    selectedOptions: JSON.stringify(options),
    basePrice: info.base,
    optionsTotal: installPrice,
    totalPrice,
    financingParams: JSON.stringify(fp),
    roiParams: JSON.stringify(rp),
    createdAt: today.toISOString(),
  } as Quote;
}

export default function QuotePreview() {
  const [, params] = useRoute("/preview/:machine");
  const machine = params?.machine || "ax2-24";
  const demo = useMemo(() => makeDemoQuote(machine), [machine]);

  return (
    <div>
      <div
        className="np"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "#fff3cd",
          borderBottom: "1px solid #ffd66b",
          padding: "10px 16px",
          fontSize: 13,
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <b>PREVIEW MODE</b> — Demo quote ·{" "}
        <a href="#/preview/ax1-12">AX1-12</a> ·{" "}
        <a href="#/preview/ax1-18">AX1-18</a> ·{" "}
        <a href="#/preview/ax2-16">AX2-16</a> ·{" "}
        <a href="#/preview/ax2-24">AX2-24</a> ·{" "}
        <a href="#/preview/ax2-16-duo">AX2-16 Duo</a> ·{" "}
        <a href="#/preview/ax2-24-duo">AX2-24 Duo</a> ·{" "}
        <a href="#/preview/ax4-12">AX4-12</a> ·{" "}
        <a href="#/preview/ax4-12-hd">AX4-12 HD</a> ·{" "}
        <a href="#/preview/ax5-20">AX5-20</a> ·{" "}
        <a href="#/preview/ax5-20-hd">AX5-20 HD</a> ·{" "}
        <a href="#/preview/ai-part-loader">Ai Part Loader</a>
      </div>
      <QuoteProposal quote={demo} />
    </div>
  );
}
