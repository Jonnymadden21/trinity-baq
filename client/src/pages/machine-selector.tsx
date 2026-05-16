import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import { TrinityLogo } from "@/components/trinity-logo";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sun,
  Moon,
  ArrowRight,
  Factory,
  Cpu,
  Shield,
  Zap,
  FileText,
  Layers,
  Bot,
} from "lucide-react";
import type { Machine } from "@shared/schema";
import { brochuresForSlug, brochureUrl } from "@/lib/brochures";

type SeriesFilter = "all" | "Ai" | "AX";

export default function MachineSelector() {
  const { theme, toggleTheme } = useTheme();
  const { data: machines, isLoading } = useQuery<Machine[]>({
    queryKey: ["/api/machines"],
  });
  const [filter, setFilter] = useState<SeriesFilter>("all");

  const orderedMachines = useMemo(() => {
    if (!machines) return [];
    return [
      ...machines.filter((m) => m.series === "Ai"),
      ...machines.filter((m) => m.series === "AX"),
    ];
  }, [machines]);

  const visibleMachines =
    filter === "all"
      ? orderedMachines
      : orderedMachines.filter((m) => m.series === filter);

  const handleSelectSeries = (next: SeriesFilter) => {
    setFilter(next);
    requestAnimationFrame(() => {
      document
        .getElementById("systems")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className="min-h-screen bg-background" data-testid="machine-selector-page">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <TrinityLogo className="h-9" />
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium tracking-wide text-muted-foreground hidden sm:block">
              BUILD & PRICE
            </span>
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Toggle theme"
              data-testid="theme-toggle"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/30">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/3" />
        <div className="mx-auto max-w-7xl px-6 py-16 md:py-20 relative">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary mb-4">
              PROVEN · RELIABLE · AMERICAN-MADE
            </p>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-[1.05] mb-5">
              CNC automation
              <br />
              that runs the second shift.
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl">
              Configure, quote, and download everything you need for your machine —
              any night of the week.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 mt-10">
            {[
              { icon: Factory, label: "100+ Installs" },
              { icon: Shield, label: "1-Year Warranty" },
              { icon: Zap, label: "8-Week Lead Time" },
              { icon: Cpu, label: "13+ CNC Brands" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Icon className="h-4 w-4 text-primary" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category tiles: Ax vs Ai */}
      <section className="mx-auto max-w-7xl px-6 pt-12">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground">Shop by category</h2>
          <p className="text-sm text-muted-foreground">
            Two product lines for two different automation problems.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CategoryTile
            kind="AX"
            active={filter === "AX"}
            onClick={() => handleSelectSeries("AX")}
            title="Ax — Pallet Automation"
            blurb="Robot-loaded pallet system for VMCs and HMCs. Lights-out runtime for high-mix, low-volume work."
            icon={Layers}
          />
          <CategoryTile
            kind="Ai"
            active={filter === "Ai"}
            onClick={() => handleSelectSeries("Ai")}
            title="Ai — Part Loading"
            blurb="AI-driven part loader. Skips robot programming entirely — point it at the parts and run."
            icon={Bot}
          />
        </div>
      </section>

      {/* Machine grid */}
      <section
        id="systems"
        className="mx-auto max-w-7xl px-6 py-12 pb-20 scroll-mt-20"
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {filter === "all"
                ? "All Trinity systems"
                : filter === "AX"
                ? "Ax pallet automation systems"
                : "Ai part-loading systems"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl">
              Select a system to configure and build your quote.
            </p>
          </div>
          <FilterPills filter={filter} setFilter={setFilter} />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleMachines.map((machine) => (
              <MachineCard key={machine.id} machine={machine} />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 bg-card">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <TrinityLogo className="h-8 mb-2" />
              <p className="text-xs text-muted-foreground">
                Designed & Built in the United States
              </p>
            </div>
            <div className="text-xs text-muted-foreground text-right">
              <p>trinityautomation.com</p>
              <p>sales@trinityautomation.com</p>
              <p>(800) 762-6864</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CategoryTile({
  kind,
  active,
  onClick,
  title,
  blurb,
  icon: Icon,
}: {
  kind: "AX" | "Ai";
  active: boolean;
  onClick: () => void;
  title: string;
  blurb: string;
  icon: typeof Layers;
}) {
  const accent = kind === "Ai" ? "primary" : "muted-foreground";
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`category-tile-${kind.toLowerCase()}`}
      className={`group relative overflow-hidden text-left rounded-2xl border bg-card p-6 md:p-7 transition-all duration-200 hover:border-primary/50 hover:shadow-lg ${
        active ? "border-primary/60 shadow-md" : "border-border/60"
      }`}
    >
      <div className="flex items-start justify-between mb-5">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            kind === "Ai"
              ? "bg-primary/15 text-primary"
              : "bg-muted text-foreground"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] tracking-widest ${
            kind === "Ai"
              ? "bg-primary/10 text-primary border-primary/30"
              : "bg-muted text-muted-foreground border-border"
          }`}
        >
          {kind === "Ai" ? "AI POWERED" : "PALLET SYSTEM"}
        </Badge>
      </div>
      <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">
        {blurb}
      </p>
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary tracking-wide">
        SEE SYSTEMS
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
      </span>
    </button>
  );
}

function FilterPills({
  filter,
  setFilter,
}: {
  filter: SeriesFilter;
  setFilter: (f: SeriesFilter) => void;
}) {
  const items: { key: SeriesFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "Ai", label: "Ai" },
    { key: "AX", label: "Ax" },
  ];
  return (
    <div
      className="inline-flex rounded-lg border border-border/60 bg-card p-1"
      role="tablist"
      data-testid="series-filter"
    >
      {items.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={filter === key}
          onClick={() => setFilter(key)}
          data-testid={`filter-${key}`}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
            filter === key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function MachineCard({ machine }: { machine: Machine }) {
  const specs = JSON.parse(machine.specs);
  const isAi = machine.series === "Ai";
  const downloads = brochuresForSlug(machine.slug);

  return (
    <div
      className="group relative flex flex-col rounded-xl border border-border/60 bg-card p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-lg"
      data-testid={`machine-card-${machine.slug}`}
    >
      <Link href={`/configure/${machine.slug}`} className="flex-1">
        <div className="cursor-pointer">
          {/* Top row: badge + price */}
          <div className="flex items-start justify-between mb-4">
            <Badge
              className={`text-xs font-semibold ${
                isAi
                  ? "bg-primary/15 text-primary border-primary/20"
                  : "bg-muted text-muted-foreground border-border"
              }`}
              variant="outline"
            >
              {machine.series} Series
            </Badge>
            <p className="text-xs text-muted-foreground">
              from{" "}
              <span className="font-semibold text-foreground">
                ${machine.basePrice.toLocaleString()}
              </span>
            </p>
          </div>

          {/* Machine name */}
          <h3 className="text-lg font-bold text-foreground mb-1">{machine.name}</h3>
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed line-clamp-2">
            {machine.tagline}
          </p>

          {/* Key specs */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-5">
            {isAi ? (
              <>
                <SpecItem
                  label="Max Part"
                  value={`${specs.maxPartWidth} x ${specs.maxPartLength}`}
                />
                <SpecItem label="Max Weight" value={specs.maxWeight} />
                <SpecItem label="Max Height" value={specs.maxPartHeight} />
                <SpecItem label="AI Powered" value="Yes" highlight />
              </>
            ) : (
              <>
                <SpecItem label="Pallets" value={String(specs.palletStations)} />
                <SpecItem label="Max Diameter" value={specs.maxPartDiameter} />
                <SpecItem label="Max Weight" value={specs.maxWeight} />
                <SpecItem label="Max Height" value={specs.maxPartHeight} />
              </>
            )}
          </div>
        </div>
      </Link>

      {/* Downloads + CTA — outside the Link so PDF clicks don't navigate */}
      {downloads.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {downloads.map((d) => (
            <a
              key={d.file}
              href={brochureUrl(d.file)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              data-testid={`brochure-${machine.slug}-${d.label.toLowerCase().replace(/\s/g, "-")}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <FileText className="h-3 w-3" />
              {d.label}
            </a>
          ))}
        </div>
      )}

      <Link href={`/configure/${machine.slug}`}>
        <div className="flex items-center justify-between pt-4 border-t border-border/40 cursor-pointer">
          <span className="text-xs font-semibold text-primary tracking-wide">
            CONFIGURE & PRICE
          </span>
          <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
        </div>
      </Link>
    </div>
  );
}

function SpecItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`text-sm font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
