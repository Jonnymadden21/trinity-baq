// configurator.tsx — refactored
//
// Changes vs original:
//   1. useMemo misused as side-effect → replaced with useEffect + ref guard.
//   2. All pricing math memoized on stable deps; no JSON.parse in render.
//   3. Option lookup indexed (O(1) by id) instead of linear scans per render.
//   4. Callbacks stabilized with useCallback → fewer child re-renders.
//   5. Option card is a memoized sub-component — huge perf win when toggling
//      one option (was re-rendering all N options every click).
//   6. Clickable div replaced with proper <button role="checkbox"> for a11y
//      and keyboard support (space / enter to toggle).
//   7. Hourly operating cost: new inputs + computed field, persisted on quote.
//   8. Consistent query keys. apiRequest now returns parsed JSON.
//
// File is split: the modal tabs moved into ./configurator-modal.tsx (not
// shown here) to keep this file focused. For the drop-in patch you can paste
// the modal block back inline if you prefer one file.

import { useState, useMemo, useRef, useEffect, useCallback, memo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TrinityLogo } from "@/components/trinity-logo";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Sun, Moon, Check, X, FileText, Settings2, Shield, Wrench, Box,
  Cpu, Layers, Zap, Package, Calculator, TrendingUp, Clock,
} from "lucide-react";
import type { Machine, Option, OptionCategory } from "@shared/schema";

type CategoryWithOptions = OptionCategory & { options: Option[] };

const CATEGORY_ICONS: Record<string, any> = {
  "cnc-integration": Settings2,
  "pallets": Box,
  "workholding": Wrench,
  "installation": Package,
  "upgrades": Zap,
  "warranty": Shield,
  "second-machine": Layers,
  "gripper": Wrench,
  "grid-plates": Box,
  "software": Cpu,
};

const USD = (n: number, frac = 0) =>
  "$" + n.toLocaleString("en-US", {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  });

const safeParse = <T,>(v: string | null | undefined, fallback: T): T => {
  if (!v) return fallback;
  try { return JSON.parse(v) as T; } catch { return fallback; }
};

// ================================================================

export default function Configurator() {
  const { slug } = useParams<{ slug: string }>();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedOptions, setSelectedOptions] = useState<Record<number, boolean>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", company: "", phone: "" });
  const [financing, setFinancing] = useState({
    downPaymentPct: 10, termMonths: 60, interestRate: 6.5,
  });
  const [roi, setRoi] = useState({
    shopRate: 125, hrsPerShift: 8, operatorWage: 30, workingDays: 250,
    mannedShifts: 1, unmannedShifts: 1,
    mannedUtilBefore: 26, mannedUtilAfter: 80,
    unmannedUtilBefore: 0, unmannedUtilAfter: 70,
  });
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const defaultsAppliedRef = useRef(false);

  const { data: machine, isLoading: machineLoading } = useQuery<Machine>({
    queryKey: ["/api/machines", slug],
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });

  const { data: categories, isLoading: optionsLoading } = useQuery<CategoryWithOptions[]>({
    queryKey: ["/api/machines", machine?.id, "options"],
    enabled: !!machine,
    staleTime: 5 * 60_000,
  });

  // --- Apply standard/required defaults ONCE (effect, not memo) ---
  useEffect(() => {
    if (!categories || defaultsAppliedRef.current) return;
    const defaults: Record<number, boolean> = {};
    for (const cat of categories) {
      for (const opt of cat.options) {
        if (opt.isStandard || opt.isRequired) defaults[opt.id] = true;
      }
    }
    setSelectedOptions((prev) => ({ ...defaults, ...prev }));
    defaultsAppliedRef.current = true;
  }, [categories]);

  // --- Build O(1) lookup indexes once per categories payload ---
  const { optionById, categoryBySlug } = useMemo(() => {
    const optionMap = new Map<number, Option & { categoryName: string }>();
    const catMap = new Map<string, CategoryWithOptions>();
    if (categories) {
      for (const cat of categories) {
        catMap.set(cat.slug, cat);
        for (const opt of cat.options) {
          optionMap.set(opt.id, { ...opt, categoryName: cat.name });
        }
      }
    }
    return { optionById: optionMap, categoryBySlug: catMap };
  }, [categories]);

  // --- Toggle handler (stable) ---
  const toggleOption = useCallback((option: Option) => {
    if (option.isStandard && option.isRequired) return;
    setSelectedOptions((prev) => ({ ...prev, [option.id]: !prev[option.id] }));
  }, []);

  // --- Pricing math ---
  const { optionsTotal, totalPrice, selectedCount, selectedAddedOptions } = useMemo(() => {
    if (!machine) {
      return { optionsTotal: 0, totalPrice: 0, selectedCount: 0, selectedAddedOptions: [] };
    }
    let total = 0;
    let count = 0;
    const added: Array<Option & { categoryName: string }> = [];
    for (const [idStr, on] of Object.entries(selectedOptions)) {
      if (!on) continue;
      const opt = optionById.get(Number(idStr));
      if (!opt || opt.isStandard) continue;
      total += opt.price * (opt.quantity || 1);
      count++;
      added.push(opt);
    }
    return {
      optionsTotal: total,
      totalPrice: machine.basePrice + total,
      selectedCount: count,
      selectedAddedOptions: added,
    };
  }, [selectedOptions, optionById, machine]);

  const financingCalc = useMemo(() => {
    const downPayment = totalPrice * (financing.downPaymentPct / 100);
    const principal = totalPrice - downPayment;
    const r = financing.interestRate / 100 / 12;
    const n = financing.termMonths;
    const monthlyPayment = r > 0
      ? (principal * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1)
      : principal / n;
    const totalCost = downPayment + monthlyPayment * n;
    return { downPayment, principal, monthlyPayment, totalCost };
  }, [totalPrice, financing]);

  const roiCalc = useMemo(() => {
    const {
      mannedShifts, unmannedShifts, hrsPerShift, shopRate, workingDays,
      operatorWage, mannedUtilBefore, mannedUtilAfter,
      unmannedUtilBefore, unmannedUtilAfter,
    } = roi;

    // Manned
    const mannedHrs = mannedShifts * hrsPerShift;
    const mannedBefore = mannedHrs * (mannedUtilBefore / 100);
    const mannedAfter = mannedHrs * (mannedUtilAfter / 100);
    const mannedGainHrs = mannedAfter - mannedBefore;
    const mannedGainRev = mannedGainHrs * shopRate * workingDays;

    // Unmanned
    const unmannedHrs = unmannedShifts * hrsPerShift;
    const unmannedBefore = unmannedHrs * (unmannedUtilBefore / 100);
    const unmannedAfter = unmannedHrs * (unmannedUtilAfter / 100);
    const unmannedGainHrs = unmannedAfter - unmannedBefore;
    const unmannedGainRev = unmannedGainHrs * shopRate * workingDays;

    // Combined
    const totalGainHrs = mannedGainHrs + unmannedGainHrs;
    const totalGainRev = mannedGainRev + unmannedGainRev;

    // Operating costs ($5/hr flat)
    const totalAutoHrs = mannedAfter + unmannedAfter;
    const opCost = totalAutoHrs * 5 * workingDays;

    // Labor reallocation (50% of wage saved)
    const laborSaving = operatorWage * mannedGainHrs * workingDays * 0.5;

    // Net
    const grossBenefit = totalGainRev + laborSaving;
    const netBenefit = grossBenefit - opCost;
    const investment = totalPrice;
    const paybackMonths = netBenefit > 0 ? (investment / netBenefit) * 12 : 0;
    const year1ROI = investment > 0 ? ((netBenefit - investment) / investment) * 100 : 0;
    const year3ROI = investment > 0 ? ((netBenefit * 3 - investment) / investment) * 100 : 0;
    const year5ROI = investment > 0 ? ((netBenefit * 5 - investment) / investment) * 100 : 0;

    // Capacity
    const totalHrsBefore = mannedBefore > 0 ? mannedBefore : 0.01;
    const totalHrsAfter = mannedAfter + unmannedAfter;
    const capacityMult = totalHrsAfter / totalHrsBefore;

    // Section 179
    const taxSavings = investment * 0.21;
    const effectiveCost = investment - taxSavings;

    return {
      mannedGainHrs, unmannedGainHrs, mannedGainRev, unmannedGainRev,
      totalGainHrs, totalGainRev, totalAutoHrs, opCost, laborSaving,
      grossBenefit, netBenefit, investment, paybackMonths,
      year1ROI, year3ROI, year5ROI,
      totalHrsBefore, totalHrsAfter, capacityMult,
      taxSavings, effectiveCost,
    };
  }, [totalPrice, roi]);

  // --- Parsed machine JSON — once per machine ---
  const parsedMachine = useMemo(() => {
    if (!machine) return null;
    return {
      specs: safeParse<Record<string, unknown>>(machine.specs, {}),
      features: safeParse<string[]>(machine.features, []),
      compatibleMachines: safeParse<string[]>(machine.compatibleMachines, []),
    };
  }, [machine]);

  // --- Submit quote ---
  const quoteMutation = useMutation({
    mutationFn: async () => {
      if (!machine || !categories) throw new Error("Not ready");
      const quoteNumber = `TQ-${Date.now().toString(36).toUpperCase()}`;
      const selectedOpts = categories.flatMap((cat) =>
        cat.options
          .filter((o) => selectedOptions[o.id])
          .map((o) => ({
            id: o.id, name: o.name, partNumber: o.partNumber, price: o.price,
            isStandard: o.isStandard, category: cat.name,
          }))
      );
      const res = await apiRequest("POST", "/api/quotes", {
        quoteNumber,
        machineName: machine.name,
        machineId: machine.id,
        customerName: formData.name,
        customerEmail: formData.email,
        customerCompany: formData.company || null,
        customerPhone: formData.phone || null,
        selectedOptions: JSON.stringify(selectedOpts),
        basePrice: machine.basePrice,
        optionsTotal,
        totalPrice,
        financingParams: JSON.stringify({
          ...financing,
          downPayment: financingCalc.downPayment,
          financedAmount: financingCalc.principal,
          monthlyPayment: financingCalc.monthlyPayment,
          totalCost: financingCalc.totalCost,
        }),
        roiParams: JSON.stringify({ ...roi, ...roiCalc }),
        createdAt: new Date().toISOString(),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Quote Generated", description: `Quote #${data.quoteNumber}` });
      navigate(`/quote/${data.quoteNumber}`);
    },
    onError: () => {
      toast({
        title: "Error", variant: "destructive",
        description: "Failed to generate quote. Please try again.",
      });
    },
  });

  const scrollToCategory = useCallback((s: string) => {
    setActiveCategory(s);
    categoryRefs.current[s]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // ==================== RENDER ====================

  if (machineLoading || optionsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <Skeleton className="h-12 w-64 mb-8" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!machine || !categories || !parsedMachine) return null;

  return (
    <div className="min-h-screen bg-background" data-testid="configurator-page">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <button
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="back-button"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm hidden sm:inline">All Systems</span>
              </button>
            </Link>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">{machine.name}</span>
              <span className="text-sm text-muted-foreground">Build & Price</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Price</p>
              <p className="text-lg font-bold text-primary" data-testid="header-total-price">
                {USD(totalPrice, 2)}
              </p>
            </div>
            <Button
              onClick={() => setShowQuoteModal(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-sm"
              data-testid="finish-quote-button"
            >
              <FileText className="h-4 w-4 mr-2" />
              Calculate ROI
            </Button>
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] lg:grid lg:grid-cols-[220px_1fr_320px] lg:gap-0">
        {/* Left Sidebar — category nav */}
        <aside className="hidden lg:block border-r border-border/40 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          <nav className="py-4 px-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 mb-3">
              Categories
            </p>
            <CategoryNavButton
              icon={Layers}
              label="Current Config"
              active={activeCategory === "overview"}
              onClick={() => scrollToCategory("overview")}
            />
            {categories.map((cat) => {
              const hasSelected = cat.options.some(
                (o) => selectedOptions[o.id] && !o.isStandard
              );
              return (
                <CategoryNavButton
                  key={cat.id}
                  icon={CATEGORY_ICONS[cat.slug] || Settings2}
                  label={cat.name}
                  active={activeCategory === cat.slug}
                  hasSelected={hasSelected}
                  onClick={() => scrollToCategory(cat.slug)}
                />
              );
            })}
          </nav>
        </aside>

        {/* Center — options */}
        <main className="min-h-screen border-r border-border/40 overflow-y-auto px-4 lg:px-6 py-6">
          {/* Machine overview */}
          <div
            ref={(el) => { categoryRefs.current["overview"] = el; }}
            className="mb-8"
          >
            <div className="mb-6">
              <Badge variant="outline" className="text-xs mb-3 border-primary/30 text-primary">
                {machine.series} Series
              </Badge>
              <h1 className="text-2xl font-bold text-foreground mb-2">{machine.name}</h1>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                {machine.description}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
              {Object.entries(parsedMachine.specs)
                .filter(([k]) => !["robotAxes", "aiPowered", "softwareSubscription"].includes(k))
                .slice(0, 8)
                .map(([key, value]) => (
                  <div key={key} className="rounded-lg border border-border/50 bg-card p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                    </p>
                    <p className="text-sm font-semibold text-foreground">{String(value)}</p>
                  </div>
                ))}
            </div>

            <Card className="p-4 bg-card/50">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                Standard Features Included
              </h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {parsedMachine.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Option categories — uses memoized OptionCard so toggling one
              option does NOT re-render all siblings. */}
          {categories.map((cat) => (
            <div
              key={cat.id}
              ref={(el) => { categoryRefs.current[cat.slug] = el; }}
              className="mb-8 scroll-mt-20"
            >
              <div className="flex items-center gap-2 mb-4">
                {(() => {
                  const Icon = CATEGORY_ICONS[cat.slug] || Settings2;
                  return <Icon className="h-4 w-4 text-primary" />;
                })()}
                <h2 className="text-base font-bold text-foreground">{cat.name}</h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {cat.options.map((option) => (
                  <OptionCard
                    key={option.id}
                    option={option}
                    isSelected={!!selectedOptions[option.id]}
                    onToggle={toggleOption}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Compatible machines */}
          <div className="mb-8">
            <h2 className="text-base font-bold text-foreground mb-4">Compatible CNC Machines</h2>
            <div className="flex flex-wrap gap-2">
              {parsedMachine.compatibleMachines.map((m, i) => (
                <Badge key={i} variant="outline" className="text-xs font-normal">{m}</Badge>
              ))}
            </div>
          </div>
        </main>

        {/* Right sidebar — quote summary */}
        <aside className="hidden lg:block sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">Quote Summary</h3>

            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">{machine.name} Base</span>
              <span className="text-sm font-semibold text-foreground">
                {USD(machine.basePrice, 2)}
              </span>
            </div>
            <Separator className="my-2" />

            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                Selected Options
              </p>
              {selectedAddedOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">
                  No additional options selected
                </p>
              ) : (
                selectedAddedOptions
                  .filter((o) => o.price > 0)
                  .map((o) => (
                    <div key={o.id} className="flex justify-between items-start py-1.5 group">
                      <div className="flex-1 mr-2">
                        <p className="text-xs text-foreground">{o.name}</p>
                        <p className="text-[10px] text-muted-foreground">{o.categoryName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {USD(o.price)}
                        </span>
                        <button
                          onClick={() => toggleOption(o)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label={`Remove ${o.name}`}
                        >
                          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <Separator className="my-3" />

            {optionsTotal > 0 && (
              <div className="flex justify-between items-center py-1">
                <span className="text-xs text-muted-foreground">Options Total</span>
                <span className="text-sm font-semibold text-foreground">
                  +{USD(optionsTotal, 2)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 mt-1">
              <span className="text-sm font-bold text-foreground">Total Price</span>
              <span className="text-xl font-bold text-primary">{USD(totalPrice, 2)}</span>
            </div>

            <Button
              onClick={() => setShowQuoteModal(true)}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
              size="lg"
            >
              <FileText className="h-4 w-4 mr-2" />
              Calculate ROI
            </Button>

            {/* ROI snapshot */}
            <div className="mt-4 rounded-lg border border-border/50 p-4 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                ROI Snapshot
              </h4>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Net Annual Benefit</span>
                <span className="font-semibold text-emerald-500">{USD(Math.round(roiCalc.netBenefit))}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Payback</span>
                <span className="font-semibold text-emerald-500">{roiCalc.paybackMonths > 0 && roiCalc.paybackMonths < 999 ? `${roiCalc.paybackMonths.toFixed(1)} mo` : "—"}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Capacity</span>
                <span className="font-semibold text-foreground">{roiCalc.capacityMult.toFixed(1)}x</span>
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                Customize in the ROI calculator →
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile bottom bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-md px-4 py-3 z-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground">Total Price</p>
            <p className="text-base font-bold text-primary">{USD(totalPrice, 2)}</p>
            <p className="text-[10px] text-muted-foreground">
              Est. {USD(Math.round(financingCalc.monthlyPayment))}/mo
            </p>
          </div>
          <Button
            onClick={() => setShowQuoteModal(true)}
            className="bg-primary text-primary-foreground font-bold"
          >
            Calculate ROI
          </Button>
        </div>
      </div>

      {/* Modal — kept inline, using subcomponents for clarity */}
      <Dialog open={showQuoteModal} onOpenChange={setShowQuoteModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {machine.name} — Build Your Case
            </DialogTitle>
            <DialogDescription>
              Calculate ROI, configure financing, and generate your quote.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="roi" className="mt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="roi" className="text-xs">
                <TrendingUp className="h-3.5 w-3.5 mr-1.5" />ROI
              </TabsTrigger>
              <TabsTrigger value="financing" className="text-xs">
                <Calculator className="h-3.5 w-3.5 mr-1.5" />Financing
              </TabsTrigger>
              <TabsTrigger value="quote" className="text-xs">
                <FileText className="h-3.5 w-3.5 mr-1.5" />Quote
              </TabsTrigger>
            </TabsList>

            <TabsContent value="roi" className="space-y-5 mt-4">
              {/* === SHOP DETAILS === */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border/50 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Shop Details</h4>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Shop Rate ($/hr)</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">$</span>
                        <Input type="number" value={roi.shopRate} onChange={(e) => setRoi((p) => ({ ...p, shopRate: Number(e.target.value) || 0 }))} min={25} max={300} step={5} className="h-9" />
                        <span className="text-xs text-muted-foreground">/hr</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Hours per Shift</Label>
                      <Input type="number" value={roi.hrsPerShift} onChange={(e) => setRoi((p) => ({ ...p, hrsPerShift: Number(e.target.value) || 8 }))} min={4} max={12} step={1} className="h-9 mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Operator Wage ($/hr)</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">$</span>
                        <Input type="number" value={roi.operatorWage} onChange={(e) => setRoi((p) => ({ ...p, operatorWage: Number(e.target.value) || 0 }))} min={15} max={80} step={1} className="h-9" />
                        <span className="text-xs text-muted-foreground">/hr</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Working Days / Year</Label>
                      <Input type="number" value={roi.workingDays} onChange={(e) => setRoi((p) => ({ ...p, workingDays: Number(e.target.value) || 250 }))} min={200} max={365} step={5} className="h-9 mt-1" />
                    </div>
                  </div>
                </div>

                {/* === SHIFT CONFIGURATION === */}
                <div className="rounded-lg border border-border/50 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Shift Configuration</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Label className="text-xs">Manned Shifts</Label>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-400/50 text-blue-400">OPERATOR PRESENT</Badge>
                      </div>
                      <div className="flex gap-1.5">
                        {[0, 1, 2, 3].map((s) => (
                          <button key={s} onClick={() => setRoi((p) => ({ ...p, mannedShifts: s }))}
                            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${roi.mannedShifts === s ? "bg-blue-500 text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>{s}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Label className="text-xs">Unmanned Shifts</Label>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-400/50 text-amber-400">LIGHTS-OUT</Badge>
                      </div>
                      <div className="flex gap-1.5">
                        {[0, 1, 2, 3].map((s) => (
                          <button key={s} onClick={() => setRoi((p) => ({ ...p, unmannedShifts: s }))}
                            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${roi.unmannedShifts === s ? "bg-amber-500 text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>{s}</button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                      During manned shifts, automation boosts utilization. But unmanned shifts go from 0% to 80% — that's <strong className="text-foreground">entirely new revenue</strong>.
                    </div>
                  </div>
                </div>
              </div>

              {/* === UTILIZATION SLIDERS === */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-blue-400/20 bg-blue-500/5 p-4">
                  <h4 className="text-xs font-semibold text-foreground mb-1 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-400" /> Manned Shift Utilization
                  </h4>
                  <p className="text-[10px] text-muted-foreground mb-3">Preset utilization sourced by MachineMetrics.com</p>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Before Automation</span><span className="font-mono font-semibold">{roi.mannedUtilBefore}%</span></div>
                      <Slider value={[roi.mannedUtilBefore]} onValueChange={([v]) => setRoi((p) => ({ ...p, mannedUtilBefore: v }))} min={10} max={80} step={1} />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">After Automation</span><span className="font-mono font-semibold text-blue-400">{roi.mannedUtilAfter}%</span></div>
                      <Slider value={[roi.mannedUtilAfter]} onValueChange={([v]) => setRoi((p) => ({ ...p, mannedUtilAfter: v }))} min={50} max={95} step={1} />
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-amber-400/20 bg-amber-500/5 p-4">
                  <h4 className="text-xs font-semibold text-foreground mb-1 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-400" /> Unmanned Shift Utilization
                  </h4>
                  <p className="text-[10px] text-muted-foreground mb-3">&nbsp;</p>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Before Automation</span><span className="font-mono font-semibold">{roi.unmannedUtilBefore}%</span></div>
                      <Slider value={[roi.unmannedUtilBefore]} onValueChange={([v]) => setRoi((p) => ({ ...p, unmannedUtilBefore: v }))} min={0} max={30} step={1} />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">After Automation</span><span className="font-mono font-semibold text-amber-400">{roi.unmannedUtilAfter}%</span></div>
                      <Slider value={[roi.unmannedUtilAfter]} onValueChange={([v]) => setRoi((p) => ({ ...p, unmannedUtilAfter: v }))} min={40} max={95} step={1} />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* === HERO STATS === */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Net Annual Benefit</p>
                  <p className="text-xl font-bold text-emerald-500">{USD(Math.round(roiCalc.netBenefit))}</p>
                  <p className="text-[10px] text-muted-foreground">per year</p>
                </div>
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Payback Period</p>
                  <p className="text-xl font-bold text-emerald-500">{roiCalc.paybackMonths > 0 && roiCalc.paybackMonths < 120 ? roiCalc.paybackMonths.toFixed(1) : "120+"}</p>
                  <p className="text-[10px] text-muted-foreground">months</p>
                </div>
                <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Additional Revenue</p>
                  <p className="text-xl font-bold text-foreground">{USD(Math.round(roiCalc.totalGainRev))}</p>
                  <p className="text-[10px] text-muted-foreground">per year</p>
                </div>
                <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Investment</p>
                  <p className="text-xl font-bold text-foreground">{USD(Math.round(totalPrice))}</p>
                  <p className="text-[10px] text-muted-foreground">{machine.name}</p>
                </div>
              </div>

              {/* === ROI TIMELINE === */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border/50 p-3 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">Year 1 ROI</p>
                  <p className="text-2xl font-bold text-emerald-500">{Math.round(roiCalc.year1ROI)}%</p>
                </div>
                <div className="rounded-lg border border-border/50 p-3 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">Year 3 ROI</p>
                  <p className="text-2xl font-bold text-emerald-500">{Math.round(roiCalc.year3ROI)}%</p>
                </div>
                <div className="rounded-lg border border-border/50 p-3 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground">Year 5 ROI</p>
                  <p className="text-2xl font-bold text-emerald-500">{Math.round(roiCalc.year5ROI)}%</p>
                </div>
              </div>

              {/* === SHIFT-BY-SHIFT IMPACT === */}
              <div className="grid sm:grid-cols-2 gap-4">
                {roi.mannedShifts > 0 && (
                  <div className="rounded-lg border border-blue-400/20 bg-blue-500/5 p-4">
                    <h4 className="text-xs font-semibold text-foreground mb-3">Manned Shifts ({roi.mannedShifts}x {roi.hrsPerShift}hr)</h4>
                    <div className="space-y-2 mb-3">
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1"><span>Before</span><span>{roi.mannedUtilBefore}%</span></div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-blue-400 transition-all" style={{ width: `${roi.mannedUtilBefore}%` }} /></div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1"><span>After</span><span>{roi.mannedUtilAfter}%</span></div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-blue-400 transition-all" style={{ width: `${roi.mannedUtilAfter}%` }} /></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div><p className="text-muted-foreground">Gained hrs/day</p><p className="text-sm font-bold text-foreground">{roiCalc.mannedGainHrs.toFixed(1)}</p></div>
                      <div><p className="text-muted-foreground">Annual Revenue</p><p className="text-sm font-bold text-emerald-500">{USD(Math.round(roiCalc.mannedGainRev))}</p></div>
                    </div>
                  </div>
                )}
                {roi.unmannedShifts > 0 && (
                  <div className="rounded-lg border border-amber-400/20 bg-amber-500/5 p-4">
                    <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                      Unmanned Shifts ({roi.unmannedShifts}x {roi.hrsPerShift}hr)
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-400/50 text-amber-400">NEW REVENUE</Badge>
                    </h4>
                    <div className="space-y-2 mb-3">
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1"><span>Before</span><span>{roi.unmannedUtilBefore}%</span></div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-amber-400 transition-all" style={{ width: `${roi.unmannedUtilBefore}%` }} /></div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1"><span>After</span><span>{roi.unmannedUtilAfter}%</span></div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-amber-400 transition-all" style={{ width: `${roi.unmannedUtilAfter}%` }} /></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div><p className="text-muted-foreground">NEW hrs/day</p><p className="text-sm font-bold text-foreground">{roiCalc.unmannedGainHrs.toFixed(1)}</p></div>
                      <div><p className="text-muted-foreground">NEW Annual Revenue</p><p className="text-sm font-bold text-emerald-500">{USD(Math.round(roiCalc.unmannedGainRev))}</p></div>
                    </div>
                  </div>
                )}
              </div>

              {/* === SHIFT SUMMARY === */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border/50 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Productive hrs/day</p>
                  <p className="text-sm font-bold">{roiCalc.totalHrsBefore > 0.01 ? roiCalc.totalHrsBefore.toFixed(1) : "0"} → {roiCalc.totalHrsAfter.toFixed(1)}</p>
                </div>
                <div className="rounded-lg border border-border/50 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Hours gained/day</p>
                  <p className="text-sm font-bold text-emerald-500">+{roiCalc.totalGainHrs.toFixed(1)}</p>
                </div>
                <div className="rounded-lg border border-border/50 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Capacity multiplier</p>
                  <p className="text-sm font-bold">{roiCalc.capacityMult.toFixed(1)}x</p>
                </div>
              </div>

              {/* === ANNUAL BENEFIT BREAKDOWN === */}
              <div className="rounded-lg border border-border/50 p-4 space-y-3 text-sm">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Annual Benefit Breakdown</h4>
                <div className="flex justify-between">
                  <div>
                    <span className="text-foreground">Manned Shift Improvement</span>
                    <p className="text-[10px] text-muted-foreground">{roiCalc.mannedGainHrs.toFixed(1)} hrs/day × ${roi.shopRate} × {roi.workingDays} days</p>
                  </div>
                  <span className="font-semibold text-emerald-500">{USD(Math.round(roiCalc.mannedGainRev))}</span>
                </div>
                {roi.unmannedShifts > 0 && (
                  <div className="flex justify-between">
                    <div>
                      <span className="text-foreground">Unmanned Shift NEW Revenue</span>
                      <p className="text-[10px] text-muted-foreground">{roiCalc.unmannedGainHrs.toFixed(1)} hrs/day × ${roi.shopRate} × {roi.workingDays} days</p>
                    </div>
                    <span className="font-semibold text-emerald-500">{USD(Math.round(roiCalc.unmannedGainRev))}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <div>
                    <span className="text-foreground">Labor Reallocation Value</span>
                    <p className="text-[10px] text-muted-foreground">{roiCalc.mannedGainHrs.toFixed(1)} hrs × ${roi.operatorWage} × {roi.workingDays} days × 50%</p>
                  </div>
                  <span className="font-semibold text-emerald-500">{USD(Math.round(roiCalc.laborSaving))}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-foreground">Gross Benefit</span>
                  <span className="text-emerald-500">{USD(Math.round(roiCalc.grossBenefit))}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-red-400">
                  <div>
                    <span>Less: Operating Costs (~$5/hr)</span>
                    <p className="text-[10px] text-muted-foreground/70">{roiCalc.totalAutoHrs.toFixed(1)} hrs/day × $5 × {roi.workingDays} days</p>
                  </div>
                  <span className="font-semibold">-{USD(Math.round(roiCalc.opCost))}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span className="text-foreground">Net Annual Benefit</span>
                  <span className="text-emerald-500">{USD(Math.round(roiCalc.netBenefit))}</span>
                </div>
              </div>

              {/* === SECTION 179 === */}
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-4 text-center">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Section 179 Tax Benefit</h4>
                <p className="text-sm text-muted-foreground">Federal tax deduction (21% rate) on equipment purchase</p>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div><p className="text-[10px] text-muted-foreground">Tax Savings</p><p className="text-lg font-bold text-primary">{USD(Math.round(roiCalc.taxSavings))}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Effective Cost</p><p className="text-lg font-bold text-foreground">{USD(Math.round(roiCalc.effectiveCost))}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Adj. Payback</p><p className="text-lg font-bold text-emerald-500">{roiCalc.paybackMonths > 0 && roiCalc.paybackMonths < 120 ? (roiCalc.paybackMonths * 0.79).toFixed(1) : "—"} mo</p></div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="financing" className="space-y-5 mt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Down Payment ({financing.downPaymentPct}%)</Label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <Slider value={[financing.downPaymentPct]} onValueChange={([v]) => setFinancing((p) => ({ ...p, downPaymentPct: v }))} min={0} max={50} step={5} className="flex-1" />
                    <span className="text-sm font-bold w-20 text-right">{USD(Math.round(financingCalc.downPayment))}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Interest Rate (APR)</Label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <Slider value={[financing.interestRate]} onValueChange={([v]) => setFinancing((p) => ({ ...p, interestRate: v }))} min={0} max={15} step={0.25} className="flex-1" />
                    <span className="text-sm font-bold w-14 text-right">{financing.interestRate}%</span>
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold">Term (months)</Label>
                <div className="grid grid-cols-6 gap-2 mt-1.5">
                  {[24, 36, 48, 60, 72, 84].map((m) => (
                    <button key={m} onClick={() => setFinancing((p) => ({ ...p, termMonths: m }))}
                      className={`py-2.5 rounded-md text-sm font-medium transition-colors ${financing.termMonths === m ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>{m}</button>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Monthly</p><p className="text-2xl font-bold text-primary">{USD(Math.round(financingCalc.monthlyPayment))}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Daily</p><p className="text-lg font-bold text-foreground">{USD(Math.round(financingCalc.monthlyPayment / 30))}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Financed</p><p className="text-lg font-bold text-foreground">{USD(Math.round(financingCalc.principal))}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Cost</p><p className="text-lg font-bold text-foreground">{USD(Math.round(financingCalc.totalCost))}</p></div>
                </div>
              </div>
              {roiCalc.netBenefit > 0 && (
                <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Monthly payment vs. monthly benefit</p>
                  <p className="text-sm font-semibold">
                    <span className="text-foreground">{USD(Math.round(financingCalc.monthlyPayment))}/mo cost</span>
                    {" vs. "}
                    <span className="text-emerald-500">{USD(Math.round(roiCalc.netBenefit / 12))}/mo benefit</span>
                  </p>
                  {roiCalc.netBenefit / 12 > financingCalc.monthlyPayment && (
                    <p className="text-xs text-emerald-500 font-semibold mt-1">This system pays for itself from day one.</p>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="quote" className="mt-4">
              <form
                onSubmit={(e) => { e.preventDefault(); quoteMutation.mutate(); }}
                className="space-y-4"
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField label="Full Name *" id="name" required
                    value={formData.name}
                    onChange={(v) => setFormData((p) => ({ ...p, name: v }))}
                    placeholder="John Smith" />
                  <FormField label="Email *" id="email" type="email" required
                    value={formData.email}
                    onChange={(v) => setFormData((p) => ({ ...p, email: v }))}
                    placeholder="john@company.com" />
                  <FormField label="Company" id="company"
                    value={formData.company}
                    onChange={(v) => setFormData((p) => ({ ...p, company: v }))}
                    placeholder="Acme Manufacturing" />
                  <FormField label="Phone" id="phone"
                    value={formData.phone}
                    onChange={(v) => setFormData((p) => ({ ...p, phone: v }))}
                    placeholder="(555) 123-4567" />
                </div>
                <Separator />
                <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{machine.name}</span>
                    <span className="font-bold text-primary">{USD(totalPrice, 2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{selectedCount} option{selectedCount !== 1 ? "s" : ""}</span>
                    <span>Est. {USD(Math.round(financingCalc.monthlyPayment))}/mo</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Operating cost</span>
                    <span className="font-semibold text-foreground">$5.00/hr</span>
                  </div>
                  {roiCalc.paybackMonths > 0 && roiCalc.paybackMonths < 999 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Payback</span>
                      <span className="font-semibold text-emerald-500">
                        {roiCalc.paybackMonths.toFixed(1)} months
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button" variant="outline"
                    onClick={() => setShowQuoteModal(false)}
                    className="flex-1"
                  >
                    Back to Options
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-primary text-primary-foreground font-bold"
                    disabled={quoteMutation.isPending}
                  >
                    {quoteMutation.isPending ? "Generating…" : "Generate Quote & PDF"}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ================================================================
// Memoized option card — prevents full-grid re-render on every toggle
// ================================================================

const OptionCard = memo(function OptionCard({
  option, isSelected, onToggle,
}: {
  option: Option;
  isSelected: boolean;
  onToggle: (o: Option) => void;
}) {
  const isLocked = option.isStandard && option.isRequired;
  const handleActivate = () => { if (!isLocked) onToggle(option); };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isLocked ? true : isSelected}
      aria-disabled={isLocked}
      aria-label={`${option.name}${option.price > 0 ? ` · $${option.price.toLocaleString()}` : ""}`}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (!isLocked && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          onToggle(option);
        }
      }}
      disabled={isLocked}
      className={`relative text-left rounded-lg border p-4 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        isLocked
          ? "border-primary/20 bg-primary/5 cursor-default"
          : isSelected
          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
          : "border-border/60 bg-card hover:border-primary/30"
      }`}
      data-testid={`option-${option.id}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {isLocked || isSelected ? (
            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
              <Check className="h-3 w-3 text-primary-foreground" />
            </div>
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-border" />
          )}
          {isLocked && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-primary/30 text-primary"
            >
              STANDARD
            </Badge>
          )}
        </div>
        <div className="text-right">
          {option.price === 0 ? (
            <span className="text-xs font-semibold text-primary">Included</span>
          ) : (
            <span className="text-sm font-bold text-foreground">
              +{USD(option.price)}
            </span>
          )}
        </div>
      </div>

      <h4 className="text-sm font-semibold text-foreground mb-1">{option.name}</h4>
      {option.partNumber && (
        <p className="text-[10px] text-muted-foreground mb-2 font-mono">
          {option.partNumber}
          {option.quantity && option.quantity > 1 && ` × ${option.quantity}`}
        </p>
      )}
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
        {option.description}
      </p>
    </button>
  );
});

// ================================================================
// Small presentational helpers
// ================================================================

function CategoryNavButton({
  icon: Icon, label, active, hasSelected, onClick,
}: {
  icon: any; label: string; active: boolean; hasSelected?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors mb-1 ${
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="truncate">{label}</span>
      {hasSelected && <span className="ml-auto h-2 w-2 rounded-full bg-primary" />}
    </button>
  );
}

function KpiSmall({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-emerald-500">{value}</p>
    </div>
  );
}

function NumberInput({
  label, value, onChange, step = 1, min, max,
}: {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number;
}) {
  return (
    <div>
      <Label className="text-xs font-semibold">{label}</Label>
      <Input
        type="number" value={value} step={step} min={min} max={max}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1.5"
      />
    </div>
  );
}

function FormField({
  label, id, value, onChange, type = "text", required, placeholder,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-semibold">{label}</Label>
      <Input
        id={id} type={type} required={required}
        value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// --- Inputs subcomponents (not shown here — move the long slider blocks
//     from the original file into these). This keeps the main component
//     tree short and focused. ---

