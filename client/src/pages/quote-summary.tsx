import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";

import { TrinityLogo } from "@/components/trinity-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Printer, Download, Check, Phone, Mail, MapPin, Calculator, TrendingUp } from "lucide-react";
import type { Quote } from "@shared/schema";

type SelectedOption = {
  id: number;
  name: string;
  partNumber: string | null;
  price: number;
  isStandard: boolean;
  category: string;
};

export default function QuoteSummary() {
  const { quoteNumber } = useParams<{ quoteNumber: string }>();

  const { data: quote, isLoading } = useQuery<Quote>({
    queryKey: [`/api/quotes/${quoteNumber}`],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-96 w-full max-w-3xl rounded-xl" />
      </div>
    );
  }

  if (!quote) return null;

  const options: SelectedOption[] = JSON.parse(quote.selectedOptions);
  const standardOptions = options.filter((o) => o.isStandard);
  const addedOptions = options.filter((o) => !o.isStandard && o.price > 0);
  const groupedStandard = groupBy(standardOptions, "category");
  const groupedAdded = groupBy(addedOptions, "category");

  return (
    <div className="min-h-screen bg-background" data-testid="quote-summary-page">
      {/* Header */}
      <header className="border-b border-border/50 bg-background">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
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
              onClick={() => {
                const el = document.getElementById('quote-content');
                if (!el) return;
                import('html2pdf.js').then((mod) => {
                  const html2pdf = mod.default;
                  html2pdf()
                    .set({
                      margin: [0.4, 0.4, 0.4, 0.4],
                      filename: `Trinity-Quote-${quoteNumber}.pdf`,
                      image: { type: 'jpeg', quality: 0.98 },
                      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#1a1c20' },
                      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
                    })
                    .from(el)
                    .save();
                });
              }}
              data-testid="save-pdf-button"
            >
              <Download className="h-4 w-4 mr-2" />
              Save as PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              data-testid="print-button"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print Quote
            </Button>
          </div>
        </div>
      </header>

      <div id="quote-content" className="mx-auto max-w-4xl px-6 py-8">
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
              ${quote.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            {quote.financingParams && (() => {
              const fp = JSON.parse(quote.financingParams);
              return (
                <p className="text-xs text-muted-foreground mt-1">
                  Est. ${Math.round(fp.monthlyPayment).toLocaleString()}/mo ({fp.termMonths} mo. @ {fp.interestRate}% APR)
                </p>
              );
            })()}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Customer Info */}
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

          {/* Trinity Info */}
          <Card className="p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Prepared By
            </h3>
            <p className="text-sm font-semibold text-foreground">Trinity Automation</p>
            <div className="text-sm text-muted-foreground space-y-1 mt-1">
              <p className="flex items-center gap-2">
                <Phone className="h-3 w-3" /> (800) 762-6864
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-3 w-3" /> sales@trinityautomation.com
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="h-3 w-3" /> Ontario, CA 91761
              </p>
            </div>
          </Card>
        </div>

        {/* System Configuration */}
        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">{quote.machineName}</h3>
              <p className="text-xs text-muted-foreground">Base System</p>
            </div>
            <p className="text-lg font-bold text-foreground">
              ${quote.basePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Standard Features */}
          {Object.entries(groupedStandard).map(([category, opts]) => (
            <div key={category} className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {category} — Standard
              </p>
              {opts.map((o) => (
                <div key={o.id} className="flex items-center gap-2 py-1">
                  <Check className="h-3 w-3 text-primary flex-shrink-0" />
                  <span className="text-sm text-foreground">{o.name}</span>
                  {o.partNumber && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {o.partNumber}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-primary font-medium">Included</span>
                </div>
              ))}
            </div>
          ))}

          {/* Added Options */}
          {Object.keys(groupedAdded).length > 0 && (
            <>
              <Separator className="my-4" />
              <h4 className="text-sm font-bold text-foreground mb-3">Selected Options</h4>
              {Object.entries(groupedAdded).map(([category, opts]) => (
                <div key={category} className="mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {category}
                  </p>
                  {opts.map((o) => (
                    <div key={o.id} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <Check className="h-3 w-3 text-primary flex-shrink-0" />
                        <span className="text-sm text-foreground">{o.name}</span>
                        {o.partNumber && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {o.partNumber}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        ${o.price.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}

          <Separator className="my-4" />

          {/* Totals */}
          {quote.optionsTotal > 0 && (
            <div className="flex justify-between py-1">
              <span className="text-sm text-muted-foreground">Options Total</span>
              <span className="text-sm font-semibold">
                ${quote.optionsTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          <div className="flex justify-between py-2">
            <span className="text-base font-bold text-foreground">System Total</span>
            <span className="text-xl font-bold text-primary">
              ${quote.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between py-1 text-sm text-muted-foreground">
            <span>Tax</span>
            <span>TBD</span>
          </div>
          <div className="flex justify-between py-1 text-sm text-muted-foreground">
            <span>Freight / Rigging</span>
            <span>TBD</span>
          </div>
        </Card>

        {/* Financing & ROI */}
        {quote.financingParams && (() => {
          const fp = JSON.parse(quote.financingParams);
          const rp = quote.roiParams ? JSON.parse(quote.roiParams) : null;
          return (
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <Card className="p-5">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Calculator className="h-3.5 w-3.5" />
                  Financing Summary
                </h3>
                <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 mb-4">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Estimated Monthly Payment</p>
                  <p className="text-2xl font-bold text-primary">
                    ${Math.round(fp.monthlyPayment).toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Down Payment ({fp.downPaymentPct}%)</span>
                    <span className="font-medium text-foreground">${Math.round(fp.downPayment).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Financed Amount</span>
                    <span className="font-medium text-foreground">${Math.round(fp.financedAmount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Term / Rate</span>
                    <span className="font-medium text-foreground">{fp.termMonths} months @ {fp.interestRate}% APR</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Cost of Financing</span>
                    <span className="font-semibold text-foreground">${Math.round(fp.totalCost).toLocaleString()}</span>
                  </div>
                </div>
              </Card>

              {rp && (
                <Card className="p-5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Return on Investment
                  </h3>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Payback</p>
                      <p className="text-xl font-bold text-emerald-500">{rp.paybackMonths > 0 ? rp.paybackMonths.toFixed(1) : "—"}</p>
                      <p className="text-[10px] text-muted-foreground">months</p>
                    </div>
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">5-Year Net</p>
                      <p className="text-xl font-bold text-emerald-500">${rp.fiveYearNet > 0 ? Math.round(rp.fiveYearNet).toLocaleString() : "—"}</p>
                      <p className="text-[10px] text-muted-foreground">profit</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Annual Labor Savings</span>
                      <span className="font-medium text-emerald-500">${rp.annualLaborSavings.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Annual Revenue Increase</span>
                      <span className="font-medium text-emerald-500">${rp.annualRevenueIncrease.toLocaleString()}</span>
                    </div>
                    <Separator className="my-1" />
                    <div className="flex justify-between font-semibold">
                      <span className="text-foreground">Total Annual Benefit</span>
                      <span className="text-emerald-500">${rp.totalAnnualBenefit.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] text-muted-foreground">
                    Based on {rp.laborHoursPerWeek} hrs/wk saved @ ${rp.hourlyLaborCost}/hr + {rp.additionalPartsPerDay} parts/day @ ${rp.revenuePerPart}/part
                  </div>
                </Card>
              )}
            </div>
          );
        })()}

        {/* Details */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="p-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Details
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Lead Time: <span className="text-foreground font-medium">8 Weeks</span></p>
              <p>FOB: <span className="text-foreground font-medium">Ontario, CA</span></p>
              <p>Warranty: <span className="text-foreground font-medium">1 Year Standard</span></p>
              <p>Quote Valid: <span className="text-foreground font-medium">60 Days</span></p>
            </div>
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
          <div className="flex justify-center gap-4 mt-4">
            <Link href="/">
              <Button variant="outline" size="sm">Configure Another System</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key]);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
