import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  ArrowLeft, Sun, Moon, Check, Plus, X, ChevronRight, FileText,
  Settings2, Shield, Wrench, Box, Cpu, Layers, Zap, Package,
  Calculator, TrendingUp, DollarSign, Clock,
} from "lucide-react";
import type { Machine, Option, OptionCategory } from "@shared/schema";

type CategoryWithOptions = OptionCategory & { options: Option[] };

const categoryIcons: Record<string, any> = {
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

export default function Configurator() {
  const { slug } = useParams<{ slug: string }>();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedOptions, setSelectedOptions] = useState<Record<number, boolean>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "", email: "", company: "", phone: "",
  });
  const [financing, setFinancing] = useState({
    downPaymentPct: 10, termMonths: 60, interestRate: 6.5,
  });
  const [roi, setRoi] = useState({
    shopRate: 125, hrsPerShift: 8, operatorWage: 30, workingDays: 250,
    mannedShifts: 1, unmannedShifts: 1,
    mannedUtilBefore: 30, mannedUtilAfter: 85,
    unmannedUtilBefore: 0, unmannedUtilAfter: 70,
  });
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { data: machine, isLoading: machineLoading } = useQuery<Machine>({
    queryKey: ["/api/machines", slug],
  });

  const { data: categories, isLoading: optionsLoading } = useQuery<CategoryWithOptions[]>({
    queryKey: [`/api/machines/${machine?.id}/options`],
    enabled: !!machine,
  });

  // Initialize standard options as selected
  useMemo(() => {
    if (!categories) return;
    const defaults: Record<number, boolean> = {};
    categories.forEach((cat) => {
      cat.options.forEach((opt) => {
        if (opt.isStandard || opt.isRequired) {
          defaults[opt.id] = true;
        }
      });
    });
    setSelectedOptions((prev) => {
      const merged = { ...defaults };
      Object.keys(prev).forEach((k) => {
        merged[Number(k)] = prev[Number(k)];
      });
      return merged;
    });
  }, [categories]);

  const toggleOption = (option: Option) => {
    if (option.isStandard && option.isRequired) return;
    setSelectedOptions((prev) => ({ ...prev, [option.id]: !prev[option.id] }));
  };

  const { optionsTotal, totalPrice, selectedCount } = useMemo(() => {
    if (!categories || !machine) return { optionsTotal: 0, totalPrice: 0, selectedCount: 0 };
    let total = 0;
    let count = 0;
    categories.forEach((cat) => {
      cat.options.forEach((opt) => {
        if (selectedOptions[opt.id] && !opt.isStandard) {
          total += opt.price * (opt.quantity || 1);
          count++;
        }
      });
    });
    return { optionsTotal: total, totalPrice: machine.basePrice + total, selectedCount: count };
  }, [selectedOptions, categories, machine]);

  const financingCalc = useMemo(() => {
    const downPayment = totalPrice * (financing.downPaymentPct / 100);
    const principal = totalPrice - downPayment;
    const r = financing.interestRate / 100 / 12;
    const n = financing.termMonths;
    const monthlyPayment = r > 0
      ? principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
      : principal / n;
    const totalCost = downPayment + monthlyPayment * n;
    return { downPayment, principal, monthlyPayment, totalCost };
  }, [totalPrice, financing]);

  const roiCalc = useMemo(() => {
    const mannedHrs = roi.mannedShifts * roi.hrsPerShift;
    const mannedBefore = mannedHrs * (roi.mannedUtilBefore / 100);
    const mannedAfter = mannedHrs * (roi.mannedUtilAfter / 100);
    const mannedGainHrs = mannedAfter - mannedBefore;
    const mannedGainRev = mannedGainHrs * roi.shopRate * roi.workingDays;

    const unmannedHrs = roi.unmannedShifts * roi.hrsPerShift;
    const unmannedBefore = unmannedHrs * (roi.unmannedUtilBefore / 100);
    const unmannedAfter = unmannedHrs * (roi.unmannedUtilAfter / 100);
    const unmannedGainHrs = unmannedAfter - unmannedBefore;
    const unmannedGainRev = unmannedGainHrs * roi.shopRate * roi.workingDays;

    const totalGainRev = mannedGainRev + unmannedGainRev;
    const totalAutoHrs = mannedAfter + unmannedAfter;
    const opCost = totalAutoHrs * 5 * roi.workingDays;
    const laborSaving = roi.operatorWage * mannedGainHrs * roi.workingDays * 0.5;
    const grossBenefit = totalGainRev + laborSaving;
    const netBenefit = grossBenefit - opCost;

    const investment = totalPrice;
    const paybackMonths = netBenefit > 0 ? (investment / netBenefit) * 12 : 0;
    const year1ROI = investment > 0 ? ((netBenefit - investment) / investment) * 100 : 0;
    const year3ROI = investment > 0 ? ((netBenefit * 3 - investment) / investment) * 100 : 0;
    const year5ROI = investment > 0 ? ((netBenefit * 5 - investment) / investment) * 100 : 0;

    const totalHrsBefore = mannedBefore > 0 ? mannedBefore : 0.01;
    const capacityMult = (mannedAfter + unmannedAfter) / totalHrsBefore;

    const taxSavings = investment * 0.21;
    const effectiveCost = investment - taxSavings;

    return {
      mannedGainHrs, unmannedGainHrs, totalGainRev, laborSaving,
      opCost, netBenefit, paybackMonths,
      year1ROI, year3ROI, year5ROI, capacityMult,
      taxSavings, effectiveCost,
    };
  }, [totalPrice, roi]);

  const quoteMutation = useMutation({
    mutationFn: async () => {
      const quoteNumber = `TQ-${Date.now().toString(36).toUpperCase()}`;
      const selectedOpts = categories?.flatMap((cat) =>
        cat.options.filter((o) => selectedOptions[o.id]).map((o) => ({
          id: o.id, name: o.name, partNumber: o.partNumber, price: o.price,
          isStandard: o.isStandard, category: cat.name,
        }))
      ) || [];
      const res = await apiRequest("POST", "/api/quotes", {
        quoteNumber,
        machineName: machine!.name,
        machineId: machine!.id,
        customerName: formData.name,
        customerEmail: formData.email,
        customerCompany: formData.company || null,
        customerPhone: formData.phone || null,
        selectedOptions: JSON.stringify(selectedOpts),
        basePrice: machine!.basePrice,
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
    onSuccess: (data) => {
      toast({ title: "Quote Generated", description: `Quote #${data.quoteNumber}` });
      navigate(`/quote/${data.quoteNumber}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate quote", variant: "destructive" });
    },
  });

  const scrollToCategory = (slug: string) => {
    setActiveCategory(slug);
    categoryRefs.current[slug]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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

  if (!machine || !categories) return null;

  const specs = JSON.parse(machine.specs);
  const features = JSON.parse(machine.features) as string[];
  const compatibleMachines = JSON.parse(machine.compatibleMachines) as string[];

  return (
    <div className="min-h-screen bg-background" data-testid="configurator-page">
      {/* Sticky Header with Price */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors" data-testid="back-button">
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
                ${totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
              data-testid="theme-toggle"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] lg:grid lg:grid-cols-[220px_1fr_320px] lg:gap-0">
        {/* Left Sidebar — Category Nav */}
        <aside className="hidden lg:block border-r border-border/40 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          <nav className="py-4 px-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 mb-3">
              Categories
            </p>
            {/* Standard config */}
            <button
              onClick={() => scrollToCategory("overview")}
              className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors mb-1 ${
                activeCategory === "overview"
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              data-testid="nav-overview"
            >
              <Layers className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Current Config</span>
            </button>
            {categories.map((cat) => {
              const Icon = categoryIcons[cat.slug] || Settings2;
              const hasSelected = cat.options.some(
                (o) => selectedOptions[o.id] && !o.isStandard
              );
              return (
                <button
                  key={cat.id}
                  onClick={() => scrollToCategory(cat.slug)}
                  className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors mb-1 ${
                    activeCategory === cat.slug
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                  data-testid={`nav-${cat.slug}`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{cat.name}</span>
                  {hasSelected && (
                    <span className="ml-auto h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Center Content — Options */}
        <main className="min-h-screen border-r border-border/40 overflow-y-auto px-4 lg:px-6 py-6">
          {/* Machine Overview */}
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

            {/* Specs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
              {Object.entries(specs)
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

            {/* Standard Features */}
            <Card className="p-4 bg-card/50">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                Standard Features Included
              </h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Option Categories */}
          {categories.map((cat) => (
            <div
              key={cat.id}
              ref={(el) => { categoryRefs.current[cat.slug] = el; }}
              className="mb-8 scroll-mt-20"
            >
              <div className="flex items-center gap-2 mb-4">
                {(() => {
                  const Icon = categoryIcons[cat.slug] || Settings2;
                  return <Icon className="h-4 w-4 text-primary" />;
                })()}
                <h2 className="text-base font-bold text-foreground">{cat.name}</h2>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {cat.options.map((option) => {
                  const isSelected = selectedOptions[option.id];
                  const isLocked = option.isStandard && option.isRequired;
                  return (
                    <div
                      key={option.id}
                      onClick={() => !isLocked && toggleOption(option)}
                      className={`relative rounded-lg border p-4 transition-all duration-150 ${
                        isLocked
                          ? "border-primary/20 bg-primary/5 cursor-default"
                          : isSelected
                          ? "border-primary/50 bg-primary/5 cursor-pointer ring-1 ring-primary/20"
                          : "border-border/60 bg-card hover:border-primary/30 cursor-pointer"
                      }`}
                      data-testid={`option-${option.id}`}
                    >
                      {/* Header: status indicator + price */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {isLocked ? (
                            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          ) : isSelected ? (
                            <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-border" />
                          )}
                          {isLocked && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                              STANDARD
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          {option.price === 0 ? (
                            <span className="text-xs font-semibold text-primary">Included</span>
                          ) : (
                            <span className="text-sm font-bold text-foreground">
                              +${option.price.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Option name & part number */}
                      <h4 className="text-sm font-semibold text-foreground mb-1">{option.name}</h4>
                      {option.partNumber && (
                        <p className="text-[10px] text-muted-foreground mb-2 font-mono">
                          {option.partNumber}
                          {option.quantity && option.quantity > 1 && ` × ${option.quantity}`}
                        </p>
                      )}

                      {/* Description */}
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {option.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Mobile Financing + ROI */}
          <div className="lg:hidden mb-8 space-y-4">
            <Card className="p-5">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                Financing Calculator
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Down Payment</span>
                    <span className="font-semibold text-foreground">{financing.downPaymentPct}% (${Math.round(financingCalc.downPayment).toLocaleString()})</span>
                  </div>
                  <Slider
                    value={[financing.downPaymentPct]}
                    onValueChange={([v]) => setFinancing((p) => ({ ...p, downPaymentPct: v }))}
                    min={0} max={50} step={5}
                  />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Term (months)</p>
                  <div className="grid grid-cols-6 gap-2">
                    {[24, 36, 48, 60, 72, 84].map((m) => (
                      <button
                        key={m}
                        onClick={() => setFinancing((p) => ({ ...p, termMonths: m }))}
                        className={`py-2 rounded-md text-sm font-medium transition-colors ${
                          financing.termMonths === m
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Interest Rate (APR)</span>
                    <span className="font-semibold text-foreground">{financing.interestRate}%</span>
                  </div>
                  <Slider
                    value={[financing.interestRate]}
                    onValueChange={([v]) => setFinancing((p) => ({ ...p, interestRate: v }))}
                    min={0} max={15} step={0.25}
                  />
                </div>
              </div>
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-4 mt-4">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Est. Monthly</p>
                  <p className="text-2xl font-bold text-primary">
                    ${Math.round(financingCalc.monthlyPayment).toLocaleString()}<span className="text-sm font-normal">/mo</span>
                  </p>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>Financed: ${Math.round(financingCalc.principal).toLocaleString()}</span>
                  <span>Total: ${Math.round(financingCalc.totalCost).toLocaleString()}</span>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                ROI Estimate
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Shop Rate</span>
                    <span className="font-semibold">${roi.shopRate}/hr</span>
                  </div>
                  <Slider value={[roi.shopRate]} onValueChange={([v]) => setRoi((p) => ({ ...p, shopRate: v }))} min={50} max={300} step={5} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Operator Wage</span>
                    <span className="font-semibold">${roi.operatorWage}/hr</span>
                  </div>
                  <Slider value={[roi.operatorWage]} onValueChange={([v]) => setRoi((p) => ({ ...p, operatorWage: v }))} min={15} max={80} step={1} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Manned Shifts</p>
                    <div className="flex gap-1">
                      {[1, 2, 3].map((s) => (
                        <button key={s} onClick={() => setRoi((p) => ({ ...p, mannedShifts: s }))}
                          className={`flex-1 py-1.5 rounded text-xs font-medium ${roi.mannedShifts === s ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Unmanned Shifts</p>
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((s) => (
                        <button key={s} onClick={() => setRoi((p) => ({ ...p, unmannedShifts: s }))}
                          className={`flex-1 py-1.5 rounded text-xs font-medium ${roi.unmannedShifts === s ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"}`}>{s}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Manned Util (Before → After)</span>
                    <span className="font-semibold">{roi.mannedUtilBefore}% → {roi.mannedUtilAfter}%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Slider value={[roi.mannedUtilBefore]} onValueChange={([v]) => setRoi((p) => ({ ...p, mannedUtilBefore: v }))} min={0} max={100} step={5} />
                    <Slider value={[roi.mannedUtilAfter]} onValueChange={([v]) => setRoi((p) => ({ ...p, mannedUtilAfter: v }))} min={0} max={100} step={5} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Unmanned Util (Before → After)</span>
                    <span className="font-semibold">{roi.unmannedUtilBefore}% → {roi.unmannedUtilAfter}%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Slider value={[roi.unmannedUtilBefore]} onValueChange={([v]) => setRoi((p) => ({ ...p, unmannedUtilBefore: v }))} min={0} max={100} step={5} />
                    <Slider value={[roi.unmannedUtilAfter]} onValueChange={([v]) => setRoi((p) => ({ ...p, unmannedUtilAfter: v }))} min={0} max={100} step={5} />
                  </div>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Payback</p>
                  <p className="text-xl font-bold text-emerald-500">{roiCalc.paybackMonths > 0 && roiCalc.paybackMonths < 999 ? roiCalc.paybackMonths.toFixed(1) : "—"}</p>
                  <p className="text-[10px] text-muted-foreground">months</p>
                </div>
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Year 1 ROI</p>
                  <p className="text-xl font-bold text-emerald-500">{roiCalc.year1ROI > -999 ? `${Math.round(roiCalc.year1ROI)}%` : "—"}</p>
                  <p className="text-[10px] text-muted-foreground">return</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Net Annual Benefit</span>
                  <span className="font-semibold text-emerald-500">${Math.round(roiCalc.netBenefit).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Capacity Increase</span>
                  <span className="font-semibold text-foreground">{roiCalc.capacityMult.toFixed(1)}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sec. 179 Tax Savings</span>
                  <span className="font-semibold text-emerald-500">${Math.round(roiCalc.taxSavings).toLocaleString()}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Compatible Machines */}
          <div className="mb-8">
            <h2 className="text-base font-bold text-foreground mb-4">Compatible CNC Machines</h2>
            <div className="flex flex-wrap gap-2">
              {compatibleMachines.map((m, i) => (
                <Badge key={i} variant="outline" className="text-xs font-normal">
                  {m}
                </Badge>
              ))}
            </div>
          </div>
        </main>

        {/* Right Sidebar — Price Summary (Sticky) */}
        <aside className="hidden lg:block sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">Quote Summary</h3>

            {/* Base price */}
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">{machine.name} Base</span>
              <span className="text-sm font-semibold text-foreground">
                ${machine.basePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <Separator className="my-2" />

            {/* Selected upgrades */}
            <div className="mb-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
                Selected Options
              </p>
              {categories.flatMap((cat) =>
                cat.options
                  .filter((o) => selectedOptions[o.id] && !o.isStandard && o.price > 0)
                  .map((o) => (
                    <div key={o.id} className="flex justify-between items-start py-1.5 group">
                      <div className="flex-1 mr-2">
                        <p className="text-xs text-foreground">{o.name}</p>
                        <p className="text-[10px] text-muted-foreground">{cat.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          ${o.price.toLocaleString()}
                        </span>
                        <button
                          onClick={() => toggleOption(o)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`remove-option-${o.id}`}
                        >
                          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
              {selectedCount === 0 && (
                <p className="text-xs text-muted-foreground italic py-2">
                  No additional options selected
                </p>
              )}
            </div>

            <Separator className="my-3" />

            {/* Totals */}
            {optionsTotal > 0 && (
              <div className="flex justify-between items-center py-1">
                <span className="text-xs text-muted-foreground">Options Total</span>
                <span className="text-sm font-semibold text-foreground">
                  +${optionsTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 mt-1">
              <span className="text-sm font-bold text-foreground">Total Price</span>
              <span className="text-xl font-bold text-primary" data-testid="sidebar-total-price">
                ${totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* CTA */}
            <Button
              onClick={() => setShowQuoteModal(true)}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold"
              size="lg"
              data-testid="sidebar-get-quote"
            >
              <FileText className="h-4 w-4 mr-2" />
              Calculate ROI
            </Button>

            {/* Financing Calculator */}
            <div className="mt-5 rounded-lg border border-border/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-1.5">
                <Calculator className="h-3.5 w-3.5" />
                Financing
              </h4>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-muted-foreground">Down Payment</span>
                    <span className="font-semibold text-foreground">{financing.downPaymentPct}%</span>
                  </div>
                  <Slider
                    value={[financing.downPaymentPct]}
                    onValueChange={([v]) => setFinancing((p) => ({ ...p, downPaymentPct: v }))}
                    min={0} max={50} step={5}
                    className="mb-1"
                  />
                  <p className="text-[10px] text-muted-foreground text-right">
                    ${Math.round(financingCalc.downPayment).toLocaleString()}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Term (months)</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[24, 36, 48, 60, 72, 84].map((m) => (
                      <button
                        key={m}
                        onClick={() => setFinancing((p) => ({ ...p, termMonths: m }))}
                        className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                          financing.termMonths === m
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-muted-foreground">Interest Rate (APR)</span>
                    <span className="font-semibold text-foreground">{financing.interestRate}%</span>
                  </div>
                  <Slider
                    value={[financing.interestRate]}
                    onValueChange={([v]) => setFinancing((p) => ({ ...p, interestRate: v }))}
                    min={0} max={15} step={0.25}
                  />
                </div>
              </div>

              <Separator className="my-4" />

              <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Estimated Monthly
                </p>
                <p className="text-2xl font-bold text-primary">
                  ${Math.round(financingCalc.monthlyPayment).toLocaleString()}<span className="text-sm font-normal">/mo</span>
                </p>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Financed</span>
                    <span>${Math.round(financingCalc.principal).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Total Cost</span>
                    <span>${Math.round(financingCalc.totalCost).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ROI Summary */}
            <div className="mt-4 rounded-lg border border-border/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                ROI Snapshot
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Net Annual Benefit</span>
                  <span className="font-semibold text-emerald-500">${Math.round(roiCalc.netBenefit).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Capacity Increase</span>
                  <span className="font-semibold text-foreground">{roiCalc.capacityMult.toFixed(1)}x</span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Payback</p>
                  <p className="text-lg font-bold text-emerald-500">
                    {roiCalc.paybackMonths > 0 && roiCalc.paybackMonths < 999 ? roiCalc.paybackMonths.toFixed(1) : "—"}
                  </p>
                  <p className="text-[9px] text-muted-foreground">months</p>
                </div>
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Year 1 ROI</p>
                  <p className="text-lg font-bold text-emerald-500">
                    {roiCalc.year1ROI > -999 ? `${Math.round(roiCalc.year1ROI)}%` : "—"}
                  </p>
                  <p className="text-[9px] text-muted-foreground">return</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-3 italic">
                Customize in the ROI calculator →
              </p>
            </div>

            {/* Lead time */}
            <div className="mt-4 rounded-lg border border-border/50 p-3">
              <p className="text-xs font-semibold text-foreground mb-1">Lead Time: 8 Weeks</p>
              <p className="text-[10px] text-muted-foreground">
                FOB — Ontario, CA. Shipping customer supplied.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile Price Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-md px-4 py-3 z-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground">Total Price</p>
            <p className="text-base font-bold text-primary">
              ${totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Est. ${Math.round(financingCalc.monthlyPayment).toLocaleString()}/mo
            </p>
          </div>
          <Button
            onClick={() => setShowQuoteModal(true)}
            className="bg-primary text-primary-foreground font-bold"
            data-testid="mobile-get-quote"
          >
            Calculate ROI
          </Button>
        </div>
      </div>

      {/* Multi-Step Modal: ROI → Financing → Quote */}
      <Dialog open={showQuoteModal} onOpenChange={setShowQuoteModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{machine.name} — Build Your Case</DialogTitle>
            <DialogDescription>Calculate ROI, configure financing, and generate your quote.</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="roi" className="mt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="roi" className="text-xs"><TrendingUp className="h-3.5 w-3.5 mr-1.5" />ROI</TabsTrigger>
              <TabsTrigger value="financing" className="text-xs"><Calculator className="h-3.5 w-3.5 mr-1.5" />Financing</TabsTrigger>
              <TabsTrigger value="quote" className="text-xs"><FileText className="h-3.5 w-3.5 mr-1.5" />Quote</TabsTrigger>
            </TabsList>

            <TabsContent value="roi" className="space-y-5 mt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Shop Rate ($/hr)</Label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <Slider value={[roi.shopRate]} onValueChange={([v]) => setRoi((p) => ({ ...p, shopRate: v }))} min={50} max={300} step={5} className="flex-1" />
                    <span className="text-sm font-bold w-14 text-right">${roi.shopRate}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Operator Wage ($/hr)</Label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <Slider value={[roi.operatorWage]} onValueChange={([v]) => setRoi((p) => ({ ...p, operatorWage: v }))} min={15} max={80} step={1} className="flex-1" />
                    <span className="text-sm font-bold w-14 text-right">${roi.operatorWage}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Hours per Shift</Label>
                  <div className="flex gap-1.5 mt-1.5">
                    {[8, 10, 12].map((h) => (
                      <button key={h} onClick={() => setRoi((p) => ({ ...p, hrsPerShift: h }))}
                        className={`flex-1 py-2 rounded-md text-sm font-medium ${roi.hrsPerShift === h ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>{h} hrs</button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Working Days / Year</Label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <Slider value={[roi.workingDays]} onValueChange={([v]) => setRoi((p) => ({ ...p, workingDays: v }))} min={200} max={365} step={5} className="flex-1" />
                    <span className="text-sm font-bold w-14 text-right">{roi.workingDays}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Manned Shifts</Label>
                  <div className="flex gap-1.5 mt-1.5">
                    {[1, 2, 3].map((s) => (
                      <button key={s} onClick={() => setRoi((p) => ({ ...p, mannedShifts: s }))}
                        className={`flex-1 py-2 rounded-md text-sm font-medium ${roi.mannedShifts === s ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>{s}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Unmanned (Lights-Out) Shifts</Label>
                  <div className="flex gap-1.5 mt-1.5">
                    {[0, 1, 2, 3].map((s) => (
                      <button key={s} onClick={() => setRoi((p) => ({ ...p, unmannedShifts: s }))}
                        className={`flex-1 py-2 rounded-md text-sm font-medium ${roi.unmannedShifts === s ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>{s}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border/50 p-4">
                  <p className="text-xs font-semibold text-foreground mb-3">Manned Utilization</p>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Before</span><span className="font-semibold text-foreground">{roi.mannedUtilBefore}%</span></div>
                      <Slider value={[roi.mannedUtilBefore]} onValueChange={([v]) => setRoi((p) => ({ ...p, mannedUtilBefore: v }))} min={0} max={100} step={5} />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>After</span><span className="font-semibold text-primary">{roi.mannedUtilAfter}%</span></div>
                      <Slider value={[roi.mannedUtilAfter]} onValueChange={([v]) => setRoi((p) => ({ ...p, mannedUtilAfter: v }))} min={0} max={100} step={5} />
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border/50 p-4">
                  <p className="text-xs font-semibold text-foreground mb-3">Unmanned Utilization</p>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Before</span><span className="font-semibold text-foreground">{roi.unmannedUtilBefore}%</span></div>
                      <Slider value={[roi.unmannedUtilBefore]} onValueChange={([v]) => setRoi((p) => ({ ...p, unmannedUtilBefore: v }))} min={0} max={100} step={5} />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>After</span><span className="font-semibold text-primary">{roi.unmannedUtilAfter}%</span></div>
                      <Slider value={[roi.unmannedUtilAfter]} onValueChange={([v]) => setRoi((p) => ({ ...p, unmannedUtilAfter: v }))} min={0} max={100} step={5} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Net Annual</p><p className="text-xl font-bold text-emerald-500">${Math.round(roiCalc.netBenefit).toLocaleString()}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Payback</p><p className="text-xl font-bold text-emerald-500">{roiCalc.paybackMonths > 0 && roiCalc.paybackMonths < 999 ? `${roiCalc.paybackMonths.toFixed(1)} mo` : "—"}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Capacity</p><p className="text-xl font-bold text-foreground">{roiCalc.capacityMult.toFixed(1)}x</p></div>
                  <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Year 5 ROI</p><p className="text-xl font-bold text-emerald-500">{Math.round(roiCalc.year5ROI)}%</p></div>
                </div>
                <p className="text-center text-[10px] text-muted-foreground mt-2">Sec. 179 Tax Savings: ${Math.round(roiCalc.taxSavings).toLocaleString()} · Effective Cost: ${Math.round(roiCalc.effectiveCost).toLocaleString()}</p>
              </div>
            </TabsContent>

            <TabsContent value="financing" className="space-y-5 mt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold">Down Payment ({financing.downPaymentPct}%)</Label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <Slider value={[financing.downPaymentPct]} onValueChange={([v]) => setFinancing((p) => ({ ...p, downPaymentPct: v }))} min={0} max={50} step={5} className="flex-1" />
                    <span className="text-sm font-bold w-20 text-right">${Math.round(financingCalc.downPayment).toLocaleString()}</span>
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
                      className={`py-2.5 rounded-md text-sm font-medium ${financing.termMonths === m ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>{m}</button>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Monthly</p><p className="text-2xl font-bold text-primary">${Math.round(financingCalc.monthlyPayment).toLocaleString()}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Financed</p><p className="text-lg font-bold text-foreground">${Math.round(financingCalc.principal).toLocaleString()}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Cost</p><p className="text-lg font-bold text-foreground">${Math.round(financingCalc.totalCost).toLocaleString()}</p></div>
                  <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Down Payment</p><p className="text-lg font-bold text-foreground">${Math.round(financingCalc.downPayment).toLocaleString()}</p></div>
                </div>
              </div>
              {roiCalc.netBenefit > 0 && (
                <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Monthly payment vs. monthly benefit</p>
                  <p className="text-sm font-semibold">
                    <span className="text-foreground">${Math.round(financingCalc.monthlyPayment).toLocaleString()}/mo cost</span>{" vs. "}
                    <span className="text-emerald-500">${Math.round(roiCalc.netBenefit / 12).toLocaleString()}/mo benefit</span>
                  </p>
                  {roiCalc.netBenefit / 12 > financingCalc.monthlyPayment && (
                    <p className="text-xs text-emerald-500 font-semibold mt-1">This system pays for itself from day one.</p>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="quote" className="mt-4">
              <form onSubmit={(e) => { e.preventDefault(); quoteMutation.mutate(); }} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><Label htmlFor="name" className="text-xs font-semibold">Full Name *</Label><Input id="name" required value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="John Smith" /></div>
                  <div><Label htmlFor="email" className="text-xs font-semibold">Email *</Label><Input id="email" type="email" required value={formData.email} onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))} placeholder="john@company.com" /></div>
                  <div><Label htmlFor="company" className="text-xs font-semibold">Company</Label><Input id="company" value={formData.company} onChange={(e) => setFormData((p) => ({ ...p, company: e.target.value }))} placeholder="Acme Manufacturing" /></div>
                  <div><Label htmlFor="phone" className="text-xs font-semibold">Phone</Label><Input id="phone" value={formData.phone} onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))} placeholder="(555) 123-4567" /></div>
                </div>
                <Separator />
                <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">{machine.name}</span><span className="font-bold text-primary">${totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>{selectedCount} option{selectedCount !== 1 ? "s" : ""}</span><span>Est. ${Math.round(financingCalc.monthlyPayment).toLocaleString()}/mo</span></div>
                  {roiCalc.paybackMonths > 0 && roiCalc.paybackMonths < 999 && (
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Payback</span><span className="font-semibold text-emerald-500">{roiCalc.paybackMonths.toFixed(1)} months</span></div>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowQuoteModal(false)} className="flex-1">Back to Options</Button>
                  <Button type="submit" className="flex-1 bg-primary text-primary-foreground font-bold" disabled={quoteMutation.isPending}>{quoteMutation.isPending ? "Generating..." : "Generate Quote & PDF"}</Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
