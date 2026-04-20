import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

import { TrinityLogo } from "@/components/trinity-logo";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sun, Moon, ArrowRight, Factory, Cpu, Shield, Zap } from "lucide-react";
import type { Machine } from "@shared/schema";

export default function MachineSelector() {
  const { theme, toggleTheme } = useTheme();
  const { data: machines, isLoading } = useQuery<Machine[]>({
    queryKey: ["/api/machines"],
  });

  const allMachines = machines ? [...machines.filter(m => m.series === "Ai"), ...machines.filter(m => m.series === "AX")] : [];

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
        <div className="mx-auto max-w-7xl px-6 py-16 md:py-24 relative">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold tracking-widest text-primary mb-3">
              SIMPLIFYING CNC AUTOMATION
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight mb-4">
              Build & Price Your<br />Automation System
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed max-w-lg">
              Configure your Trinity system, select options, and get an instant quote.
              Built in the USA with 8-week lead times.
            </p>
          </div>
          <div className="flex gap-8 mt-10">
            {[
              { icon: Factory, label: "100+ Installs" },
              { icon: Shield, label: "1-Year Warranty" },
              { icon: Zap, label: "8-Week Lead Time" },
              { icon: Cpu, label: "13+ CNC Brands" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="h-4 w-4 text-primary" />
                <span className="hidden sm:inline">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* All Machines */}
      <section className="mx-auto max-w-7xl px-6 py-12 pb-20">
        <div className="mb-8">
          <h2 className="text-xl font-bold text-foreground">Trinity Automation Systems</h2>
          <p className="text-sm text-muted-foreground max-w-xl">
            Select a system to configure and build your quote.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allMachines.map((machine) => (
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

function MachineCard({ machine }: { machine: Machine }) {
  const specs = JSON.parse(machine.specs);
  const isAi = machine.series === "Ai";

  return (
    <Link href={`/configure/${machine.slug}`}>
      <div
        className="group relative rounded-xl border border-border/60 bg-card p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-lg cursor-pointer"
        data-testid={`machine-card-${machine.slug}`}
      >
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
            from <span className="font-semibold text-foreground">${machine.basePrice.toLocaleString()}</span>
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
              <SpecItem label="Max Part" value={`${specs.maxPartWidth} x ${specs.maxPartLength}`} />
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

        {/* CTA */}
        <div className="flex items-center justify-between pt-4 border-t border-border/40">
          <span className="text-xs font-semibold text-primary tracking-wide">
            CONFIGURE & PRICE
          </span>
          <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}

function SpecItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
