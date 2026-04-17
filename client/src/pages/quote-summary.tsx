import { useMemo, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";

import { TrinityLogo } from "@/components/trinity-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Printer, Download, Check, Phone, Mail, MapPin,
  Calculator, TrendingUp, Clock, Zap, Loader2,
} from "lucide-react";
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
};

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
  // New fields — see configurator.tsx
  hourlyOperatingCost?: number;
  powerCostPerHr?: number;
  maintenanceCostPerHr?: number;
  consumablesCostPerHr?: number;
  amortizedCostPerHr?: number;
};

// ---------- helpers ----------

const USD = (n: number, fractionDigits = 0) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

const safeParse = <T,>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

function groupBy<T, K extends keyof T>(arr: T[], key: K): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of arr) {
    const k = String(item[key]);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}

// ---------- component ----------

export default function QuoteSummary() {
  const { quoteNumber } = useParams<{ quoteNumber: string }>();
  const [isExporting, setIsExporting] = useState(false);

  const { data: quote, isLoading, isError } = useQuery<Quote>({
    queryKey: [`/api/quotes/${quoteNumber}`],
    staleTime: 60_000,
  });

  // Parse JSON once — not on every render
  const parsed = useMemo(() => {
    if (!quote) return null;
    const options = safeParse<SelectedOption[]>(quote.selectedOptions, []);
    const fp = safeParse<FinancingParams | null>(quote.financingParams, null);
    const rp = safeParse<RoiParams | null>(quote.roiParams, null);
    return { options, fp, rp };
  }, [quote]);

  // Build indexed lookups once — O(1) category access in render
  const { standardByCategory, addedByCategory, addedTotal, categoryOrder } =
    useMemo(() => {
      if (!parsed) {
        return {
          standardByCategory: new Map<string, SelectedOption[]>(),
          addedByCategory: new Map<string, SelectedOption[]>(),
          addedTotal: 0,
          categoryOrder: [] as string[],
        };
      }
      const std = parsed.options.filter((o) => o.isStandard);
      const add = parsed.options.filter((o) => !o.isStandard && o.price > 0);
      const total = add.reduce((sum, o) => sum + o.price, 0);
      const order = Array.from(
        new Set(parsed.options.map((o) => o.category))
      );
      return {
        standardByCategory: groupBy(std, "category"),
        addedByCategory: groupBy(add, "category"),
        addedTotal: total,
        categoryOrder: order,
      };
    }, [parsed]);

  // PDF export — see below, rebuilt for speed + quality
  const handleExport = useCallback(async () => {
    if (!quote || !parsed) return;
    setIsExporting(true);
    try {
      const { exportQuotePdf } = await import("@/lib/pdf-export");
      await exportQuotePdf({
        quote,
        options: parsed.options,
        financing: parsed.fp,
        roi: parsed.rp,
      });
    } catch (err) {
      console.error("PDF export failed", err);
    } finally {
      setIsExporting(false);
    }
  }, [quote, parsed]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-4xl space-y-4">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !quote || !parsed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-lg font-bold mb-2">Quote not found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            We couldn't locate quote #{quoteNumber}. It may have expired or been removed.
          </p>
          <Link href="/">
            <Button>Return to Systems</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { fp, rp } = parsed;

  return (
    <div className="min-h-screen bg-background" data-testid="quote-summary-page">
      {/* Header — not captured in PDF */}
      <header className="border-b border-border/50 bg-background sticky top-0 z-40 backdrop-blur-xl bg-background/80 print:hidden">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/">
            <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm">Back to Systems</span>
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
              data-testid="save-pdf-button"
            >
              {isExporting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</>
              ) : (
                <><Download className="h-4 w-4 mr-2" />Save as PDF</>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              data-testid="print-button"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>
      </header>

      <div id="quote-content" className="mx-auto max-w-5xl px-6 py-8">
        {/* Quote Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-8">
          <div>
            <TrinityLogo className="h-10 mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-1">System Quotation</h1>
            <p className="text-sm text-muted-foreground">
              Quote #{quote.quoteNumber} — {new Date(quote.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              Total System Price
            </p>
            <p className="text-3xl font-bold text-primary" data-testid="quote-total">
              {USD(quote.totalPrice, 2)}
            </p>
            {fp && (
              <p className="text-xs text-muted-foreground mt-1">
                Est. {USD(Math.round(fp.monthlyPayment))}/mo ({fp.termMonths} mo @ {fp.interestRate}% APR)
              </p>
            )}
          </div>
        </div>

        {/* Customer / Prepared By */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Prepared For
            </h3>
            <p className="text-sm font-semibold text-foreground">{quote.customerName}</p>
            <p className="text-sm text-muted-foreground">{quote.customerEmail}</p>
            {quote.customerCompany && (
              <p className="text-sm text-muted-foreground">{quote.customerCompany}</p>
            )}
            {quote.customerPhone && (
              <p className="text-sm text-muted-foreground">{quote.customerPhone}</p>
            )}
          </Card>
          <Card className="p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Prepared By
            </h3>
            <p className="text-sm font-semibold text-foreground">Trinity Automation</p>
            <div className="text-sm text-muted-foreground space-y-1 mt-1">
              <p className="flex items-center gap-2"><Phone className="h-3 w-3" /> (800) 762-6864</p>
              <p className="flex items-center gap-2"><Mail className="h-3 w-3" /> sales@trinityautomation.com</p>
              <p className="flex items-center gap-2"><MapPin className="h-3 w-3" /> Ontario, CA 91761</p>
            </div>
          </Card>
        </div>

        {/* ============ REFRESHED ROW / LINE-ITEM SECTION ============ */}
        <Card className="p-0 mb-6 overflow-hidden">
          {/* System header row */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground leading-tight">
                  {quote.machineName}
                </h3>
                <p className="text-xs text-muted-foreground">Base System · Standard configuration</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Base</p>
              <p className="text-lg font-bold text-foreground">{USD(quote.basePrice, 2)}</p>
            </div>
          </div>

          {/* Line-item table */}
          <div className="divide-y divide-border/30">
            {/* Standard features — render once per category, collapsible feel */}
            {categoryOrder
              .filter((c) => standardByCategory.has(c))
              .map((category) => {
                const opts = standardByCategory.get(category)!;
                return (
                  <details key={`std-${category}`} className="group">
                    <summary className="flex cursor-pointer items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors list-none">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-primary/30 text-primary"
                        >
                          STANDARD
                        </Badge>
                        <span className="text-sm font-semibold text-foreground">{category}</span>
                        <span className="text-xs text-muted-foreground">
                          ({opts.length} item{opts.length !== 1 ? "s" : ""})
                        </span>
                      </div>
                      <span className="text-xs font-medium text-primary">Included</span>
                    </summary>
                    <div className="px-5 pb-3 bg-muted/10">
                      {opts.map((o) => (
                        <LineItem key={o.id} option={o} showPrice={false} />
                      ))}
                    </div>
                  </details>
                );
              })}

            {/* Added options — always visible, grouped by category, with sub-totals */}
            {categoryOrder
              .filter((c) => addedByCategory.has(c))
              .map((category) => {
                const opts = addedByCategory.get(category)!;
                const subtotal = opts.reduce((s, o) => s + o.price, 0);
                return (
                  <div key={`add-${category}`} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          {category}
                        </h4>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Subtotal <span className="font-semibold text-foreground">{USD(subtotal)}</span>
                      </span>
                    </div>
                    <div>
                      {opts.map((o) => (
                        <LineItem key={o.id} option={o} showPrice={true} />
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Totals */}
          <div className="bg-muted/20 px-5 py-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Base System</span>
              <span className="font-medium text-foreground">{USD(quote.basePrice, 2)}</span>
            </div>
            {addedTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Options ({Array.from(addedByCategory.values()).flat().length})
                </span>
                <span className="font-medium text-foreground">{USD(addedTotal, 2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Tax</span><span>TBD</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Freight / Rigging</span><span>TBD</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between items-baseline">
              <span className="text-base font-bold text-foreground">System Total</span>
              <span className="text-2xl font-bold text-primary">{USD(quote.totalPrice, 2)}</span>
            </div>
          </div>
        </Card>

        {/* Financing & ROI */}
        {fp && (
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <Card className="p-5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5" />
                Financing Summary
              </h3>
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 mb-4">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Estimated Monthly Payment</p>
                <p className="text-2xl font-bold text-primary">
                  {USD(Math.round(fp.monthlyPayment))}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
              </div>
              <dl className="space-y-2 text-sm">
                <Row label={`Down Payment (${fp.downPaymentPct}%)`} value={USD(Math.round(fp.downPayment))} />
                <Row label="Financed Amount" value={USD(Math.round(fp.financedAmount))} />
                <Row label="Term / Rate" value={`${fp.termMonths} mo @ ${fp.interestRate}% APR`} />
                <Separator className="my-1" />
                <Row label="Total Cost of Financing" value={USD(Math.round(fp.totalCost))} bold />
              </dl>
            </Card>

            {rp && <RoiCard rp={rp} totalPrice={quote.totalPrice} />}
          </div>
        )}

        {/* NEW: Hourly Operating Cost Card — requested */}
        {rp && (
          <Card className="p-5 mb-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Hourly Operating Cost
            </h3>
            <HourlyOperatingCost rp={rp} totalPrice={quote.totalPrice} />
          </Card>
        )}

        {/* Details */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Details
            </h3>
            <dl className="space-y-2 text-sm text-muted-foreground">
              <Row label="Lead Time" value="8 Weeks" />
              <Row label="FOB" value="Ontario, CA" />
              <Row label="Warranty" value="1 Year Standard" />
              <Row label="Quote Valid" value="60 Days" />
            </dl>
          </Card>
          <Card className="p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Next Steps
            </h3>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Review configuration and pricing with your team</li>
              <li>Schedule a technical review call with Trinity engineering</li>
              <li>Finalize specifications and confirm lead time</li>
              <li>Issue PO — production begins on receipt</li>
            </ol>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center py-8 border-t border-border/30">
          <p className="text-xs text-muted-foreground mb-2">
            Price valid for 60 days from date on sales order.
          </p>
          <p className="text-xs text-muted-foreground">
            Trinity Robotics Automation, LLC. — Built in the USA
          </p>
          <div className="flex justify-center gap-4 mt-4 print:hidden">
            <Link href="/">
              <Button variant="outline" size="sm">Configure Another System</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- sub-components ----------

function LineItem({ option, showPrice }: { option: SelectedOption; showPrice: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate">{option.name}</p>
        {option.partNumber && (
          <p className="text-[10px] text-muted-foreground font-mono">{option.partNumber}</p>
        )}
      </div>
      {showPrice ? (
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {USD(option.price)}
        </span>
      ) : (
        <span className="text-xs text-primary font-medium">Included</span>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={bold ? "font-semibold text-foreground" : "font-medium text-foreground"}>
        {value}
      </dd>
    </div>
  );
}

function RoiCard({ rp, totalPrice }: { rp: RoiParams; totalPrice: number }) {
  const fiveYearNet = rp.netBenefit * 5 - totalPrice;
  const paybackDisplay =
    rp.paybackMonths > 0 && rp.paybackMonths < 999 ? rp.paybackMonths.toFixed(1) : "—";
  return (
    <Card className="p-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5" />
        Return on Investment
      </h3>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Kpi label="Payback" value={paybackDisplay} sublabel="months" tone="positive" />
        <Kpi
          label="5-Year Net"
          value={fiveYearNet > 0 ? USD(Math.round(fiveYearNet)) : "—"}
          sublabel="profit"
          tone="positive"
        />
      </div>
      <dl className="space-y-2 text-sm">
        <Row label="New Revenue (Utilization Gains)" value={USD(Math.round(rp.totalGainRev))} />
        <Row label="Labor Reallocation Value" value={USD(Math.round(rp.laborSaving))} />
        <Row label="Operating Costs" value={`-${USD(Math.round(rp.opCost))}`} />
        <Separator className="my-1" />
        <Row label="Net Annual Benefit" value={USD(Math.round(rp.netBenefit))} bold />
      </dl>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <Kpi label="Year 1" value={`${Math.round(rp.year1ROI)}%`} tone="positive" compact />
        <Kpi label="Year 3" value={`${Math.round(rp.year3ROI)}%`} tone="positive" compact />
        <Kpi label="Year 5" value={`${Math.round(rp.year5ROI)}%`} tone="positive" compact />
      </div>
      <p className="mt-3 text-[10px] text-muted-foreground">
        {rp.mannedShifts} manned + {rp.unmannedShifts} unmanned shifts · ${rp.shopRate}/hr shop
        rate · {rp.capacityMult.toFixed(1)}x capacity · Sec. 179:{" "}
        {USD(Math.round(rp.taxSavings))} savings
      </p>
    </Card>
  );
}

function Kpi({
  label, value, sublabel, tone, compact,
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: "positive" | "neutral";
  compact?: boolean;
}) {
  const toneClass =
    tone === "positive"
      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-500"
      : "bg-muted/40 border-border/50 text-foreground";
  return (
    <div className={`rounded-lg border ${toneClass} ${compact ? "p-2" : "p-3"} text-center`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <p className={`${compact ? "text-sm" : "text-xl"} font-bold`}>{value}</p>
      {sublabel && <p className="text-[10px] text-muted-foreground">{sublabel}</p>}
    </div>
  );
}

function HourlyOperatingCost({ rp, totalPrice }: { rp: RoiParams; totalPrice: number }) {
  // Derive hourly costs if not stored on the quote (backwards-compatible)
  const totalHrsPerYear =
    (rp.mannedShifts + rp.unmannedShifts) * rp.hrsPerShift * rp.workingDays;

  const power    = rp.powerCostPerHr    ?? 1.8;  // ~15 kW avg × $0.12/kWh
  const maint    = rp.maintenanceCostPerHr ?? 1.2;
  const consum   = rp.consumablesCostPerHr ?? 2.0;
  const amort    = rp.amortizedCostPerHr
    ?? (totalHrsPerYear > 0 ? totalPrice / (totalHrsPerYear * 5) : 0); // 5-yr straight-line
  const total    = rp.hourlyOperatingCost ?? power + maint + consum + amort;

  const breakdown = [
    { label: "Power & Utilities", value: power },
    { label: "Scheduled Maintenance", value: maint },
    { label: "Consumables (grippers, jaws, filters)", value: consum },
    { label: "Amortized Capital (5-yr straight-line)", value: amort },
  ];

  return (
    <div className="grid md:grid-cols-[auto_1fr] gap-6">
      <div className="rounded-xl bg-primary/5 border border-primary/10 p-5 md:w-56 text-center md:text-left">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
          Total Hourly Cost
        </p>
        <p className="text-3xl font-bold text-primary">
          {USD(total, 2)}
          <span className="text-sm font-normal text-muted-foreground">/hr</span>
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Based on {totalHrsPerYear.toLocaleString()} scheduled hrs/year
        </p>
      </div>
      <dl className="space-y-2 text-sm">
        {breakdown.map((b) => {
          const pct = total > 0 ? (b.value / total) * 100 : 0;
          return (
            <div key={b.label}>
              <div className="flex justify-between mb-1">
                <dt className="text-muted-foreground">{b.label}</dt>
                <dd className="font-medium text-foreground tabular-nums">{USD(b.value, 2)}/hr</dd>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary/70"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
