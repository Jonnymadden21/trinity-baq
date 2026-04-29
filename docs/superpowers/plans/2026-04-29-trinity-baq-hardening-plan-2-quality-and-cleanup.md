# Trinity BAQ — Hardening Plan 2 (Reliability, Performance & Cleanup) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every remaining HIGH/MEDIUM audit finding that wasn't part of Plan 1's critical path: front-end reliability bugs, bundle/perf bloat, the 1,100-LOC configurator monolith, broader test coverage, and onboarding/architecture docs.

**Architecture:** No new infrastructure. The work is mechanical fixes (theme-provider, JSON.parse safety), bundle hygiene (dynamic imports, dropped shadcn dead code, recharts removal), feature decomposition (`client/src/features/configurator/*` + `client/src/features/pricing/*`), and a Vitest/Playwright suite that makes the app safe to refactor going forward.

**Tech Stack:** Same as Plan 1 — TypeScript, Vite, React, TanStack Query, wouter, Tailwind, shadcn/ui — plus Playwright for e2e.

**Companion docs:**
- Spec: `docs/superpowers/specs/2026-04-28-trinity-baq-hardening-design.md`
- Plan 1 (critical path): `docs/superpowers/plans/2026-04-28-trinity-baq-hardening-plan-1-critical-path.md`
- SEO design (separate effort): `docs/superpowers/specs/2026-04-28-trinity-baq-seo-design.md`

**Prerequisite:** Plan 1 ships first (all 20 tasks merged to `main`, including the Phase B schema overhaul and deploy verification). After Plan 1 is on `main`, branch `hardening-plan-2` from `main` and execute Plan 2 in the same way (subagent-driven, tasks committed individually).

**Conventions:**
- Project root: `/Users/jmadden/Desktop/selway/Trinity/trinity-quote-vercel`.
- All paths relative to project root.
- Conventional Commits.
- Each task ends in a commit. Branch is `hardening-plan-2`.

---

## Phase outline

- **Phase A — Reliability bugs (small, independent fixes):** Tasks 1–5
- **Phase B — Bundle / performance hygiene:** Tasks 6–9
- **Phase C — Configurator decomposition:** Tasks 10–15
- **Phase D — Test suite expansion:** Tasks 16–19
- **Phase E — Docs:** Tasks 20–24
- **Phase F — Final QA & merge:** Task 25

---

## Task 1: Fix theme-provider dead branch + null-safe `useTheme`

**Files:**
- Modify: `client/src/components/theme-provider.tsx`

- [ ] **Step 1.1: Fix the conditional**

Open `client/src/components/theme-provider.tsx`. Find line ~12 with the `useState<Theme>` initializer:

```tsx
const [theme, setTheme] = useState<Theme>(() =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "dark"
);
```

Change the second `"dark"` to `"light"`:

```tsx
const [theme, setTheme] = useState<Theme>(() =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
);
```

- [ ] **Step 1.2: Make `useTheme` throw outside provider**

Find:

```tsx
export const useTheme = () => useContext(ThemeContext);
```

Replace with:

```tsx
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
```

Also change the `createContext` default from a non-null object to `null`:

```tsx
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);
```

- [ ] **Step 1.3: Verify**

```bash
npm run check && npm run lint && npm test && DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder npm run build
```

All four pass.

- [ ] **Step 1.4: Commit**

```bash
git add client/src/components/theme-provider.tsx
git commit -m "fix(client): respect light system theme; throw if useTheme used outside provider"
```

---

## Task 2: Render error state in configurator when data load fails

**Files:**
- Modify: `client/src/pages/configurator.tsx`

- [ ] **Step 2.1: Find the broken branch**

Open `client/src/pages/configurator.tsx`. Search for the line that returns `null` when `machine`, `categories`, or `parsedMachine` is missing — pre-Plan 2 location was around line 307–308 but lint/format passes may have shifted:

```tsx
if (!machine || !categories || !parsedMachine) return null;
```

- [ ] **Step 2.2: Replace with explicit branches**

Above the `return null` line, the file already has loading-skeleton handling for `machineLoading || optionsLoading`. We add error-state handling AFTER loading is done.

Replace the single `return null` line with:

```tsx
if (!machine) {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold mb-2">Machine not found</h1>
      <p className="text-muted-foreground mb-6">
        We couldn’t find a machine matching this URL. It may have been renamed or removed.
      </p>
      <Button onClick={() => setLocation("/")}>Back to machine list</Button>
    </div>
  );
}
if (!categories) {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold mb-2">Couldn’t load configuration options</h1>
      <p className="text-muted-foreground mb-6">
        Something went wrong loading this machine’s options. Please refresh the page.
      </p>
      <Button onClick={() => window.location.reload()}>Reload</Button>
    </div>
  );
}
if (!parsedMachine) {
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold mb-2">Machine data is malformed</h1>
      <p className="text-muted-foreground mb-6">
        The server returned an unexpected shape for this machine. Please contact support.
      </p>
    </div>
  );
}
```

(The existing `setLocation` import from wouter, `Button` import from `@/components/ui/button`, and the loading-skeleton block above must stay. Verify by reading surrounding context.)

- [ ] **Step 2.3: Verify**

```bash
npm run check && npm run lint && npm test && DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder npm run build
```

- [ ] **Step 2.4: Commit**

```bash
git add client/src/pages/configurator.tsx
git commit -m "fix(client): render error states instead of blank when configurator data is missing"
```

---

## Task 3: Defensive `JSON.parse` for `machine.specs` in machine-selector

**Files:**
- Modify: `client/src/pages/machine-selector.tsx`

- [ ] **Step 3.1: Identify the unsafe parse**

Search the file for `JSON.parse(machine.specs)`. Currently around line ~120 inside `MachineCard`:

```tsx
const specs = JSON.parse(machine.specs);
```

If this throws (e.g., one machine row has malformed JSON), the entire grid crashes.

- [ ] **Step 3.2: Add a local safe-parse helper at the top of the file**

After the imports, add:

```tsx
function safeParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
```

- [ ] **Step 3.3: Use it**

Replace `const specs = JSON.parse(machine.specs);` with:

```tsx
const specs = safeParse<Record<string, unknown>>(machine.specs, {});
```

If anywhere else in the file calls `JSON.parse` on a DB-sourced string, apply the same treatment.

- [ ] **Step 3.4: Verify**

```bash
npm run check && npm run lint && npm test && DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder npm run build
```

- [ ] **Step 3.5: Commit**

```bash
git add client/src/pages/machine-selector.tsx
git commit -m "fix(client): use safeParse for machine.specs so one bad row doesn't crash the grid"
```

---

## Task 4: PDF export — throw on missing DOM containers, surface toast

**Files:**
- Modify: `client/src/lib/pdf-export.ts`
- Modify: `client/src/pages/quote-summary.tsx` (the caller)

- [ ] **Step 4.1: Throw instead of silent return**

Open `client/src/lib/pdf-export.ts`. Find the early-return blocks (around lines 41–50):

```ts
const container = document.querySelector(".prop") as HTMLElement;
if (!container) {
  console.error("Proposal container not found");
  return;
}
const pages = container.querySelectorAll<HTMLElement>(".page");
if (pages.length === 0) {
  console.error("No .page elements found in proposal");
  return;
}
```

Replace with:

```ts
const container = document.querySelector<HTMLElement>(".prop");
if (!container) throw new Error("Proposal container (.prop) not found");
const pages = container.querySelectorAll<HTMLElement>(".page");
if (pages.length === 0) throw new Error("No .page elements found in proposal");
```

- [ ] **Step 4.2: Catch in the caller**

Open `client/src/pages/quote-summary.tsx`. Find the click handler that calls the PDF export. Wrap the call in `try/catch`:

```tsx
const handleExport = async () => {
  setExporting(true);
  try {
    await exportProposalPdf(/* args */);
  } catch (err) {
    console.error("PDF export failed", err);
    toast({
      title: "Couldn’t generate the PDF",
      description: err instanceof Error ? err.message : "Try refreshing and exporting again.",
      variant: "destructive",
    });
  } finally {
    setExporting(false);
  }
};
```

(Adjust function names — `exportProposalPdf`, `setExporting` — to match what the file currently uses.)

If `quote-summary.tsx` already wraps the PDF call in try/catch, just confirm the `finally` resets the loading state and the catch surfaces a toast.

- [ ] **Step 4.3: Verify**

```bash
npm run check && npm run lint && npm test && DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder npm run build
```

- [ ] **Step 4.4: Commit**

```bash
git add client/src/lib/pdf-export.ts client/src/pages/quote-summary.tsx
git commit -m "fix(client): PDF export throws on missing DOM, caller surfaces toast and resets loading"
```

---

## Task 5: Clamp ROI numeric inputs

**Files:**
- Modify: `client/src/pages/configurator.tsx` (or wherever ROI inputs live after Phase C decomposition; if Phase C hasn't run yet, edit configurator.tsx)

- [ ] **Step 5.1: Identify the inputs**

Find every `<Input type="number" ...>` (or `Slider` already has bounds) tied to a ROI field: `shopRate`, `hrsPerShift`, `operatorWage`, `workingDays`, `mannedShifts`, `unmannedShifts`. Sliders already enforce bounds; the free-text number inputs do not.

- [ ] **Step 5.2: Add a `clampedNumber` helper at the top of the configurator file**

```tsx
function clampedNumber(raw: string, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
```

- [ ] **Step 5.3: Use it in each numeric `onChange`**

Per-field bounds (use these exact values):

| Field | min | max |
|---|---|---|
| shopRate | 0 | 1000 |
| hrsPerShift | 0 | 24 |
| operatorWage | 0 | 500 |
| workingDays | 0 | 365 |
| mannedShifts | 0 | 3 |
| unmannedShifts | 0 | 3 |

Example for `shopRate`:

```tsx
onChange={(e) =>
  setRoi((p) => ({ ...p, shopRate: clampedNumber(e.target.value, 0, 1000, p.shopRate) }))
}
```

- [ ] **Step 5.4: Add `min`/`max` HTML attributes too** for browser-level guardrails:

```tsx
<Input type="number" min={0} max={1000} ... />
```

- [ ] **Step 5.5: Verify**

```bash
npm run check && npm run lint && npm test && DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder npm run build
```

- [ ] **Step 5.6: Commit**

```bash
git add client/src/pages/configurator.tsx
git commit -m "fix(client): clamp ROI numeric inputs to sensible ranges"
```

---

## Task 6: Drop unused dependencies (`react-icons`, `html2pdf.d.ts`)

**Files:**
- Modify: `package.json`
- Delete: `client/src/html2pdf.d.ts`

- [ ] **Step 6.1: Confirm `react-icons` is unused**

```bash
grep -rn "react-icons" client/src 2>/dev/null
```

Expected: no matches (the audit already noted it as likely dead). If matches exist, STOP and report.

- [ ] **Step 6.2: Remove from package.json**

```bash
npm uninstall react-icons
```

- [ ] **Step 6.3: Delete the orphaned type declaration**

The project uses `jspdf` + `html2canvas`, not `html2pdf.js`. The type declaration at `client/src/html2pdf.d.ts` is dead.

```bash
rm client/src/html2pdf.d.ts
```

- [ ] **Step 6.4: Verify**

```bash
npm run check && npm run lint && npm test && DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder npm run build
```

- [ ] **Step 6.5: Commit**

```bash
git add package.json package-lock.json client/src/html2pdf.d.ts
git commit -m "chore: drop unused react-icons dep and orphan html2pdf.d.ts"
```

---

## Task 7: Delete unused shadcn UI components

The audit found 34 of 47 shadcn components have no imports outside `components/ui/`. Removing them shrinks the bundle and the surface area for accidental usage.

**Files:**
- Delete: ~34 files in `client/src/components/ui/` (full list determined by grep)
- Modify: `package.json` (drop their Radix/etc. dependencies)

- [ ] **Step 7.1: Identify which ui components are imported anywhere outside `components/ui/`**

```bash
KEEPERS=$(grep -rh '@/components/ui/' client/src --include="*.tsx" --include="*.ts" \
  | grep -v 'components/ui/' \
  | sed -E 's|.*@/components/ui/([a-z0-9-]+).*|\1|' \
  | sort -u)
echo "Keep: $KEEPERS"
```

The list should include at minimum: `badge`, `button`, `card`, `dialog`, `input`, `label`, `separator`, `skeleton`, `slider`, `tabs`, `toaster` (and possibly `toast` if used). Anything not in that list under `client/src/components/ui/` is deletable.

- [ ] **Step 7.2: Build the delete list**

```bash
ALL=$(ls client/src/components/ui/ | sed 's/\.tsx$//' | sed 's/\.ts$//' | sort -u)
DELETE=$(comm -23 <(echo "$ALL" | tr ' ' '\n' | sort -u) <(echo "$KEEPERS" | tr ' ' '\n' | sort -u))
echo "Delete: $DELETE"
```

Capture and review the list manually. Confirm none are imported transitively (e.g., `dialog` may import `button` indirectly — but if `button` is in the keepers, that's fine).

- [ ] **Step 7.3: Delete the unused files**

For each file in `$DELETE`:

```bash
rm "client/src/components/ui/$f.tsx" 2>/dev/null || rm "client/src/components/ui/$f.ts"
```

- [ ] **Step 7.4: Drop now-unused npm dependencies**

The shadcn components import from `@radix-ui/*`, `recharts`, `embla-carousel-react`, `react-day-picker`, `react-resizable-panels`, `vaul`, `input-otp`, `cmdk`, `react-hook-form`, `@hookform/resolvers`. After deletion, run:

```bash
npm run typecheck
```

If it passes, the source no longer imports the deleted packages. Then:

```bash
# uninstall packages that no surviving file imports
npm uninstall recharts embla-carousel-react react-day-picker react-resizable-panels vaul input-otp cmdk react-hook-form @hookform/resolvers @radix-ui/react-accordion @radix-ui/react-alert-dialog @radix-ui/react-aspect-ratio @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-collapsible @radix-ui/react-context-menu @radix-ui/react-hover-card @radix-ui/react-menubar @radix-ui/react-navigation-menu @radix-ui/react-scroll-area @radix-ui/react-toggle @radix-ui/react-toggle-group @radix-ui/react-progress
```

(Cross-check by grepping `client/src` and `api/` for each package name first; only uninstall the ones with zero remaining imports.)

- [ ] **Step 7.5: Verify**

```bash
npm run check && npm run lint && npm test && DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder npm run build
```

The build's main chunk should drop noticeably (~150 KB). Capture before/after sizes.

- [ ] **Step 7.6: Commit**

```bash
git add -A
git commit -m "chore: delete 34 unused shadcn UI components and their dependencies"
```

---

## Task 8: Dynamic-import the PDF export stack on first click

**Files:**
- Modify: `client/src/pages/quote-summary.tsx`

- [ ] **Step 8.1: Replace the static import**

Currently `quote-summary.tsx` does something like:

```tsx
import { exportProposalPdf } from "@/lib/pdf-export";
```

Move it inside the click handler:

```tsx
const handleExport = async () => {
  setExporting(true);
  try {
    const { exportProposalPdf } = await import("@/lib/pdf-export");
    await exportProposalPdf(/* args */);
  } catch (err) {
    /* (already added in Task 4) */
  } finally {
    setExporting(false);
  }
};
```

This dynamic-imports `lib/pdf-export.ts` (which transitively pulls `jspdf` ~386 KB, `html2canvas` ~201 KB, `pdf-lib` ~158 KB) only when the user clicks Export. Initial bundle drops by ~600 KB.

- [ ] **Step 8.2: Verify the build emits a separate chunk**

```bash
DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder npm run build 2>&1 | grep -E "(jspdf|html2canvas|pdf-lib)"
```

Expect to see those libs in chunks separate from the main `index-*.js`.

- [ ] **Step 8.3: Verify all four CI gates green**

```bash
npm run check && npm run lint && npm test && DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder npm run build
```

- [ ] **Step 8.4: Commit**

```bash
git add client/src/pages/quote-summary.tsx
git commit -m "perf(client): dynamic-import PDF export stack on first click (~600 KB off initial bundle)"
```

---

## Task 9: Drop `main.tsx` manual hash assignment

**Files:**
- Modify: `client/src/main.tsx`

- [ ] **Step 9.1: Delete the unnecessary hash forcing**

Find and remove:

```tsx
if (!window.location.hash) {
  window.location.hash = "#/";
}
```

wouter's `useHashLocation` handles empty-hash routing natively.

- [ ] **Step 9.2: Verify**

```bash
npm run check && npm run lint && npm test && DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder npm run build
```

- [ ] **Step 9.3: Commit**

```bash
git add client/src/main.tsx
git commit -m "perf(client): drop manual hash assignment; wouter handles empty hash"
```

---

## Task 10: Extract pricing modules to `client/src/features/pricing/`

The configurator file currently inlines two financial calculators: a financing PMT solver and a Trinity-style ROI model. Extracting them makes them testable in isolation and shrinks the configurator.

**Files:**
- Create: `client/src/features/pricing/computeFinancing.ts`
- Create: `client/src/features/pricing/computeRoi.ts`
- Create: `tests/unit/computeFinancing.test.ts`
- Create: `tests/unit/computeRoi.test.ts`
- Modify: `client/src/pages/configurator.tsx` (replace inline math with imports)

- [ ] **Step 10.1: Identify the inline functions in configurator.tsx**

Search for `monthlyPayment`, `interestRate`, `mannedGainHrs`, `paybackMonths` — these are computed inline. Find the contiguous block(s) of math.

- [ ] **Step 10.2: Write failing tests at `tests/unit/computeFinancing.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { computeFinancing } from "../../client/src/features/pricing/computeFinancing";

describe("computeFinancing", () => {
  it("computes monthly payment with PMT formula at a positive APR", () => {
    const r = computeFinancing({
      totalPrice: 200_000,
      downPaymentPct: 10,
      termMonths: 60,
      interestRate: 6,
    });
    expect(r.financedAmount).toBe(180_000);
    // PMT @ 6% APR / 12, 60 months, 180000 principal = ~3479.92
    expect(r.monthlyPayment).toBeGreaterThan(3478);
    expect(r.monthlyPayment).toBeLessThan(3481);
  });

  it("returns financedAmount/12*term as monthly when interestRate is 0", () => {
    const r = computeFinancing({
      totalPrice: 120_000,
      downPaymentPct: 0,
      termMonths: 60,
      interestRate: 0,
    });
    expect(r.monthlyPayment).toBe(2_000);
  });

  it("downPayment scales with downPaymentPct", () => {
    const r = computeFinancing({
      totalPrice: 100_000,
      downPaymentPct: 25,
      termMonths: 36,
      interestRate: 5,
    });
    expect(r.downPayment).toBe(25_000);
    expect(r.financedAmount).toBe(75_000);
  });
});
```

- [ ] **Step 10.3: Run tests, expect failures.**

- [ ] **Step 10.4: Implement `client/src/features/pricing/computeFinancing.ts`**

Extract the existing logic from `configurator.tsx` and rewrite as a pure function:

```ts
export interface FinancingInput {
  totalPrice: number;
  downPaymentPct: number; // 0-100
  termMonths: number;
  interestRate: number; // annual percent (e.g., 6 = 6%)
}

export interface FinancingOutput {
  downPayment: number;
  financedAmount: number;
  monthlyPayment: number;
  totalCost: number;
}

export function computeFinancing(input: FinancingInput): FinancingOutput {
  const downPayment = (input.totalPrice * input.downPaymentPct) / 100;
  const financedAmount = input.totalPrice - downPayment;
  let monthlyPayment: number;
  if (input.interestRate === 0) {
    monthlyPayment = financedAmount / input.termMonths;
  } else {
    const r = input.interestRate / 100 / 12;
    const n = input.termMonths;
    monthlyPayment = (financedAmount * r) / (1 - Math.pow(1 + r, -n));
  }
  const totalCost = downPayment + monthlyPayment * input.termMonths;
  return { downPayment, financedAmount, monthlyPayment, totalCost };
}
```

- [ ] **Step 10.5: Run tests, expect 3/3 pass.**

- [ ] **Step 10.6: Same dance for `computeRoi`**

Write `tests/unit/computeRoi.test.ts` with at least 4 tests covering: utilization gain math, labor savings, payback months, and the case where unmanned shifts are zero. Read the existing inline ROI function in configurator.tsx for canonical inputs/outputs. Implement `client/src/features/pricing/computeRoi.ts` mirroring the existing logic.

- [ ] **Step 10.7: Replace inline math in configurator.tsx**

Import:

```tsx
import { computeFinancing } from "@/features/pricing/computeFinancing";
import { computeRoi } from "@/features/pricing/computeRoi";
```

Use the imports inline where the inline math used to be. Remove the inline functions.

- [ ] **Step 10.8: Verify**

```bash
npm run check && npm run lint && npm test && DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder npm run build
```

All tests pass, including new `computeFinancing` + `computeRoi` suites (≥7 new tests).

- [ ] **Step 10.9: Commit**

```bash
git add client/src/features client/src/pages/configurator.tsx tests/unit/computeFinancing.test.ts tests/unit/computeRoi.test.ts
git commit -m "refactor(client): extract financing + ROI math into testable feature modules"
```

---

## Task 11: Extract ROI modal to `client/src/features/configurator/RoiModal.tsx`

**Files:**
- Create: `client/src/features/configurator/RoiModal.tsx`
- Modify: `client/src/pages/configurator.tsx`

- [ ] **Step 11.1: Identify the ROI modal JSX in configurator.tsx**

Search for the `Dialog`/`DialogContent` block that renders the ROI calculator (sliders, inputs, computed outputs). It's a self-contained section.

- [ ] **Step 11.2: Move to `RoiModal.tsx`**

The new component takes props for the input state (controlled) and a callback to commit values:

```tsx
interface RoiModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalPrice: number;
  initialRoi: RoiInputs;
  onConfirm: (roi: RoiInputs) => void;
}
```

Move the JSX, the state lifted up so the parent owns it, and the call to `computeRoi` from Task 10.

- [ ] **Step 11.3: Render the modal in configurator.tsx**

```tsx
<RoiModal
  open={showRoi}
  onOpenChange={setShowRoi}
  totalPrice={totalPrice}
  initialRoi={roi}
  onConfirm={(next) => { setRoi(next); setShowRoi(false); }}
/>
```

- [ ] **Step 11.4: Verify**

```bash
npm run check && npm run lint && npm test && DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder npm run build
```

Manually open the configurator page in dev (`npm run dev`), open the ROI modal, change a slider, and confirm the displayed totals update.

- [ ] **Step 11.5: Commit**

```bash
git add client/src/features/configurator/RoiModal.tsx client/src/pages/configurator.tsx
git commit -m "refactor(client): extract RoiModal from configurator monolith"
```

---

## Task 12: Extract financing modal to `client/src/features/configurator/FinancingModal.tsx`

Same pattern as Task 11 for the financing calculator dialog. Props match the parent's existing financing state/setters.

- [ ] **Step 12.1: Identify the financing modal JSX**
- [ ] **Step 12.2: Create `client/src/features/configurator/FinancingModal.tsx`**
- [ ] **Step 12.3: Render it in configurator.tsx**
- [ ] **Step 12.4: Verify all four CI gates green**
- [ ] **Step 12.5: Commit**

```bash
git commit -m "refactor(client): extract FinancingModal from configurator monolith"
```

---

## Task 13: Extract `OptionsPanel` and `OptionCard`

**Files:**
- Create: `client/src/features/configurator/OptionsPanel.tsx`
- Create: `client/src/features/configurator/OptionCard.tsx`
- Modify: `client/src/pages/configurator.tsx`

- [ ] **Step 13.1: Identify the JSX**

The options panel renders categorized lists of toggleable options. The current configurator inlines this as a long block of JSX.

- [ ] **Step 13.2: Create `OptionCard.tsx`**

Single-option card with name, price, description, and toggle.

```tsx
interface OptionCardProps {
  option: Option;
  selected: boolean;
  onToggle: (id: number) => void;
}
```

- [ ] **Step 13.3: Create `OptionsPanel.tsx`**

Iterates categories and renders OptionCards.

```tsx
interface OptionsPanelProps {
  categories: CategoryWithOptions[];
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
}
```

- [ ] **Step 13.4: Use them in configurator.tsx**
- [ ] **Step 13.5: Verify**
- [ ] **Step 13.6: Commit**

```bash
git commit -m "refactor(client): extract OptionsPanel and OptionCard"
```

---

## Task 14: Extract `QuoteForm`

**Files:**
- Create: `client/src/features/configurator/QuoteForm.tsx`
- Modify: `client/src/pages/configurator.tsx`

- [ ] **Step 14.1: Identify the customer-info form JSX**

The form section that contains name/email/company/phone inputs, the honeypot, the TurnstileWidget (added in Plan 1 Task 18), and the submit button.

- [ ] **Step 14.2: Create `QuoteForm.tsx`**

```tsx
interface QuoteFormProps {
  pending: boolean;
  initialValues?: { name?: string; email?: string; company?: string; phone?: string };
  onSubmit: (form: { name: string; email: string; company: string | null; phone: string | null; turnstileToken: string; honeypot: string }) => void;
}
```

The component owns its own form state, the TurnstileWidget callbacks, and the honeypot — it bubbles up only the final values on submit. The configurator parent then constructs the API payload with these values + machine/option/financing/roi context and calls the mutation.

- [ ] **Step 14.3: Use it in configurator.tsx**
- [ ] **Step 14.4: Verify**
- [ ] **Step 14.5: Commit**

```bash
git commit -m "refactor(client): extract QuoteForm with Turnstile + honeypot"
```

---

## Task 15: Reduce `configurator.tsx` to wiring

After Tasks 11–14, the page should be ~150 LOC: route reading, queries, derived totals, and a layout that composes the extracted components.

- [ ] **Step 15.1: Read the current configurator.tsx top-to-bottom**

Confirm what's left is mostly:
- imports
- the `useRoute` / `useQuery` calls
- the `useMutation` for submit
- a layout block that renders header, OptionsPanel, RoiModal, FinancingModal, QuoteForm
- error/loading branches (from Task 2)

- [ ] **Step 15.2: Move any helper/render inline functions still in the file out**

If anything substantial remains inline, move it (e.g., a header section can become `client/src/features/configurator/ConfiguratorHeader.tsx`).

- [ ] **Step 15.3: Confirm line count**

```bash
wc -l client/src/pages/configurator.tsx
```

Target: under 250 LOC. If still much larger, inspect for remaining inlined logic and extract.

- [ ] **Step 15.4: Verify all four CI gates green + manual smoke**

```bash
npm run dev
```

Click through home → AX2-16 configurator → toggle options → ROI modal → Financing modal → submit form. Everything should work identically to before the refactor.

- [ ] **Step 15.5: Commit**

```bash
git add client/src/pages/configurator.tsx client/src/features/configurator
git commit -m "refactor(client): configurator.tsx is now wiring only (~200 LOC)"
```

---

## Task 16: Playwright e2e smoke test

**Files:**
- Modify: `package.json` (add `@playwright/test` dev dep + `e2e` script)
- Create: `playwright.config.ts`
- Create: `tests/e2e/smoke.spec.ts`

- [ ] **Step 16.1: Install Playwright**

```bash
npm install --save-dev @playwright/test
npx playwright install --with-deps chromium
```

- [ ] **Step 16.2: Add `e2e` script**

In `package.json`:

```json
"e2e": "playwright test"
```

- [ ] **Step 16.3: Create `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    headless: true,
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:5173",
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
```

- [ ] **Step 16.4: Create `tests/e2e/smoke.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("home page lists machines and links into a configurator", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Trinity/i }).first()).toBeVisible();
  // First machine card — click it
  const firstCard = page.locator("[data-testid='machine-card']").first();
  await firstCard.click();
  await expect(page).toHaveURL(/configure/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("direct-load every configure route renders content", async ({ page }) => {
  // Slugs from the seed data; if these change, this list updates
  const slugs = [
    "ai-part-loader",
    "ax1-12",
    "ax1-18",
    "ax2-16",
    "ax2-24",
    "ax2-16-duo",
    "ax2-24-duo",
    "ax4-12",
    "ax4-12-hd",
    "ax5-20",
    "ax5-20-hd",
  ];
  for (const slug of slugs) {
    await page.goto(`/#/configure/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("body")).not.toContainText("Machine not found");
  }
});
```

(If the SEO migration has landed and switched to BrowserRouter, drop the `#/` prefix.)

The first test depends on `data-testid="machine-card"` existing on the home page; add it to the `MachineCard` component if missing.

- [ ] **Step 16.5: Run e2e**

```bash
npm run e2e
```

Both tests should pass.

- [ ] **Step 16.6: Add `data-testid` if needed**

If the first test fails because the testid is missing, add it to `MachineCard` in `machine-selector.tsx`:

```tsx
<Card data-testid="machine-card" ...>
```

- [ ] **Step 16.7: Commit**

```bash
git add package.json package-lock.json playwright.config.ts tests/e2e client/src/pages/machine-selector.tsx
git commit -m "test: add Playwright smoke + per-slug direct-load coverage"
```

---

## Task 17: Add CI step to run Playwright

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 17.1: Append an e2e job**

```yaml
  e2e:
    runs-on: ubuntu-latest
    needs: ci
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
        env:
          DATABASE_URL: postgresql://placeholder:placeholder@localhost:5432/placeholder
```

Note: this job runs against `npm run dev`, which boots Vite and proxies `/api` calls. The API calls will fail because there's no real DB — but the e2e tests don't submit quotes; they only load pages. If a test needs API data, it'll time out. For smoke coverage of just direct-load rendering, this is fine.

If we want richer e2e (actual quote submission), add a Postgres service container in CI and run `db:migrate` + `db:seed` first. That's deferred to Plan 3.

- [ ] **Step 17.2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add Playwright job for e2e smoke"
```

---

## Task 18: Supertest API tests (read endpoints)

**Files:**
- Create: `tests/api/machines.test.ts`
- Modify: `package.json` (no new dep needed — Vitest's `fetch` works)

- [ ] **Step 18.1: Decide on test strategy**

The Vercel handlers depend on a real DB to be useful end-to-end. For now, write **handler-level unit tests** that exercise the validation/error paths against a mocked `db` module, not full integration tests. (Full integration is Plan 3.)

Use Vitest's `vi.mock` to swap out `../api/_db`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../api/_db", () => ({
  db: { select: vi.fn() },
}));
```

- [ ] **Step 18.2: Write tests for `api/machines/[id].ts`**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import handler from "../../api/machines/[id]";
import { db } from "../../api/_db";

beforeEach(() => vi.clearAllMocks());

function mockReqRes(query: Record<string, string>) {
  const headers: Record<string, string> = {};
  return {
    req: { method: "GET", query, headers: {} } as any,
    res: {
      _status: 0,
      _body: undefined as unknown,
      _headers: headers,
      setHeader(k: string, v: string) { headers[k] = v; },
      status(code: number) { this._status = code; return this; },
      json(body: unknown) { this._body = body; return this; },
      end() { return this; },
    } as any,
  };
}

describe("GET /api/machines/[id]", () => {
  it("400 on invalid slug", async () => {
    const { req, res } = mockReqRes({ id: "BAD$$" });
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._body).toEqual({ error: "Invalid slug" });
  });

  it("404 when machine not found", async () => {
    const { req, res } = mockReqRes({ id: "valid-slug" });
    (db.select as any).mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    });
    await handler(req, res);
    expect(res._status).toBe(404);
  });

  it("200 with machine when found", async () => {
    const { req, res } = mockReqRes({ id: "ax2-16" });
    (db.select as any).mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => [{ id: 1, slug: "ax2-16", name: "AX2-16" }] }) }),
    });
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._headers["Cache-Control"]).toMatch(/s-maxage=300/);
  });

  it("405 on POST", async () => {
    const { req, res } = mockReqRes({ id: "ax2-16" });
    req.method = "POST";
    await handler(req, res);
    expect(res._status).toBe(405);
  });
});
```

- [ ] **Step 18.3: Similar for `api/machines.ts` and `api/quotes/[quoteNumber].ts`**

- [ ] **Step 18.4: Commit**

```bash
git add tests/api
git commit -m "test(api): handler-level tests for machine/quote read endpoints"
```

---

## Task 19: Supertest tests for `POST /api/quotes` reject paths

**Files:**
- Create: `tests/api/quotes.test.ts`

This codifies the entire 11-step pipeline from Plan 1 Task 17. The test structure is large; write each rejection path as its own `it()` block. **Don't test the happy path with a real DB** — just verify the validations.

- [ ] **Step 19.1: Mock all the dependencies**

```ts
vi.mock("../../api/_db", () => ({ db: { select: vi.fn(), insert: vi.fn() } }));
vi.mock("../../api/_lib/turnstile", () => ({ verifyTurnstile: vi.fn() }));
vi.mock("../../api/_lib/rateLimit", () => ({
  getRateLimitClient: () => ({}),
  checkRateLimit: vi.fn(),
}));
vi.mock("../../api/_lib/email", () => ({ sendQuoteEmail: vi.fn() }));
```

- [ ] **Step 19.2: Cover these scenarios as separate `it()` blocks**

1. `403` when Origin header missing.
2. `403` when Origin header is on a different domain.
3. `400` when payload schema fails (e.g., bad email).
4. `200 silent` when honeypot is non-empty (no DB insert).
5. `400` when Turnstile token verification fails.
6. `429` when rate limit exceeded.
7. `400` when machineId not in DB.
8. `400` when an option ID isn't in DB.
9. `400` when an option ID belongs to a different machine.
10. `201 + { quoteNumber }` on full happy path with mocked DB returning insert result.

The happy-path test verifies the response shape and that `sendQuoteEmail` was called once.

- [ ] **Step 19.3: Run and confirm all green**

```bash
npm test -- quotes
```

- [ ] **Step 19.4: Commit**

```bash
git add tests/api/quotes.test.ts
git commit -m "test(api): cover all POST /api/quotes reject paths and happy path"
```

---

## Task 20: Rewrite `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 20.1: Replace with a real quickstart**

Use this template:

```markdown
# Trinity Build-A-Quote (BAQ)

Public-facing CNC pallet automation quote builder for Trinity Automation. Customers configure a machine, generate a PDF proposal, and request a formal quote — no login required.

**Live:** https://trinitybaq.com

## Stack

- React 18 + Vite + TanStack Query + wouter (router) + Tailwind + shadcn/ui
- Vercel Functions (TypeScript) backed by Supabase Postgres via Drizzle ORM
- Cloudflare Turnstile for bot protection, Upstash Redis for rate limit, Resend for lead emails

## Prerequisites

- Node.js ≥ 18.17
- npm ≥ 9
- A Vercel project linked (`vercel link`)
- A Supabase project (`DATABASE_URL`)
- (Optional, for full local prod parity) Cloudflare Turnstile keys, Upstash Redis, Resend

## Quickstart

```bash
git clone <repo>
cd trinity-quote-vercel
npm install
cp .env.example .env.local
# fill in DATABASE_URL minimum; rest are optional for local dev
npm run db:migrate
npm run db:seed     # only for first-time DB setup
npm run dev         # http://localhost:5173 with Vite hot reload
```

For local API + frontend together:

```bash
vercel dev          # http://localhost:3000 with serverless functions
```

## Environment variables

See `.env.example`. Detailed sourcing in `docs/deployment.md`.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Vite dev server (frontend only) |
| `npm run build` | Production build |
| `npm run check` | Typecheck client + api |
| `npm run lint` | ESLint |
| `npm run test` | Vitest unit + integration |
| `npm run e2e` | Playwright smoke |
| `npm run db:generate` | Generate a new Drizzle migration from schema diff |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Seed all 11 machines + ~228 options (run once on a fresh DB) |

## Architecture

See `docs/architecture.md`.

## Deploying

See `docs/deployment.md`.

## Troubleshooting

See `docs/troubleshooting.md`.
```

- [ ] **Step 20.2: Verify**

`cat README.md` — sanity check.

- [ ] **Step 20.3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README as a real quickstart with current stack and scripts"
```

---

## Task 21: `docs/architecture.md`

**Files:**
- Create: `docs/architecture.md`

- [ ] **Step 21.1: Write the doc**

Cover (each as its own short section):

- **System diagram** (ascii or mermaid): browser → Vercel CDN → Vercel Functions → Supabase + Resend + Upstash + Cloudflare Turnstile.
- **Folder layout:** what's in `client/`, `api/`, `server/`, `shared/`, `scripts/`, `tests/`, `drizzle/`, `docs/`.
- **Data flow for a quote submission:** numbered steps mirroring the Plan 1 Task 17 pipeline.
- **Pricing precision:** how we use BigInt cents in `server/pricing.ts` and `numeric(10,2)` in the DB.
- **State management:** TanStack Query for server cache; React local state for form state; no Redux/Zustand.
- **Routing:** wouter with hash routing today; SEO migration switches to BrowserRouter (separate spec).
- **Public flow protection:** layer-by-layer summary of origin/honeypot/Turnstile/rate-limit.

- [ ] **Step 21.2: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: add architecture overview"
```

---

## Task 22: `docs/api.md`

**Files:**
- Create: `docs/api.md`

- [ ] **Step 22.1: Document each endpoint**

For each of `GET /api/machines`, `GET /api/machines/:slug`, `GET /api/machines/:slug/options`, `GET /api/quotes/:quoteNumber`, `POST /api/quotes`:

- Method + path
- Auth: "None — public endpoint"
- Request body / query params (with Zod schema reference)
- Response shape on 200 / 201
- Error responses (400, 403, 404, 405, 429, 500) and what triggers each
- Cache headers if any
- Sample `curl`

For `POST /api/quotes`, include the full pipeline diagram and document each rejection scenario.

- [ ] **Step 22.2: Commit**

```bash
git add docs/api.md
git commit -m "docs: document all API endpoints with request/response shapes and error cases"
```

---

## Task 23: `docs/database.md`

**Files:**
- Create: `docs/database.md`

- [ ] **Step 23.1: Document the schema**

- Table-by-table: columns, types, constraints, indexes, FKs.
- The four JSON-as-text columns (`machines.specs`, `machines.compatibleMachines`, `machines.features`, `quotes.selectedOptions`, `quotes.financingParams`, `quotes.roiParams`): document expected shape (link to `shared/zodTypes.ts` once those Zod schemas exist).
- Migration policy: production uses `db:migrate` (never `db:push`). Generate migrations with `db:generate --name <descriptor>`.
- Seeding: when to run `db:seed`. Idempotency caveats.

- [ ] **Step 23.2: Commit**

```bash
git add docs/database.md
git commit -m "docs: document schema, JSON columns, migration policy, seeding"
```

---

## Task 24: `docs/deployment.md` and `docs/troubleshooting.md`

**Files:**
- Create: `docs/deployment.md`
- Create: `docs/troubleshooting.md`
- Create: `KNOWN_ISSUES.md`

- [ ] **Step 24.1: `docs/deployment.md`**

Cover:
- Vercel project link + how to switch projects.
- All env vars: where to set them, how to source values (Supabase, Cloudflare, Upstash, Resend).
- Migration application on production: PITR snapshot first, then `npm run db:migrate`.
- Rollback: revert deploy via Vercel dashboard; revert schema via PITR restore.
- DNS for `mail.trinitybaq.com` (Resend domain verification records).

- [ ] **Step 24.2: `docs/troubleshooting.md`**

Cover:
- "I get 403 on POST /api/quotes" → ALLOWED_ORIGINS misconfigured.
- "I get 400 verification failed" → Turnstile keys mismatched between client and server, or browser blocking the script.
- "Lead emails not arriving" → check RESEND_API_KEY, domain verified, LEAD_NOTIFICATION_TO set, Resend dashboard logs.
- "Cold-start 500 from any /api endpoint" → likely DATABASE_URL invalid; check Supabase pooler.
- "PDF export hangs" → check browser console; the proposal DOM may not have rendered yet.

- [ ] **Step 24.3: `KNOWN_ISSUES.md`**

Short bullet list. Examples:
- ROI calculator's payback math assumes constant utilization rates; long-horizon projections may not match a CFO's spreadsheet.
- Brochure PDFs are ~3 MB total; future migration to Vercel Blob deferred.
- Configurator hash-routing legacy URLs (`/#/configure/...`) work via the SEO migration's redirect; once SEO ships, the hash-redirector can be removed in a future cleanup.

- [ ] **Step 24.4: Commit**

```bash
git add docs/deployment.md docs/troubleshooting.md KNOWN_ISSUES.md
git commit -m "docs: deployment, troubleshooting, known issues"
```

---

## Task 25: Final QA + merge

- [ ] **Step 25.1: Push branch**

```bash
git push -u origin hardening-plan-2
```

- [ ] **Step 25.2: Verify CI green** on the GitHub Actions run.

- [ ] **Step 25.3: Manual smoke**

In a real browser against the preview deploy:
- Home page renders.
- Pick a machine, configure it, fire ROI modal, fire Financing modal, submit form.
- Lead email arrives.
- PDF export works (button doesn't hang on missing DOM — Task 4 verified).
- Try light-mode browser; theme matches (Task 1 verified).
- Lighthouse: bundle should be ≥ 30% smaller than Plan 1 baseline.

- [ ] **Step 25.4: Merge**

```bash
git checkout main
git merge --no-ff hardening-plan-2
git push origin main
git tag -a v1.2.0 -m "Plan 2: reliability, performance, configurator decomposition, tests, docs"
git push origin v1.2.0
```

---

## Self-Review

(Performed at write time, fixed inline.)

**Spec coverage (audit M-level findings carried into Plan 2):**
- M11 (configurator decomposition) — Tasks 10–15 ✅
- M12 (theme-provider dead branch) — Task 1 ✅
- M13 (PDF silent fail) — Task 4 ✅
- M14 (slug→branding hardcoded) — **deferred to Plan 3** (data-driven branding requires DB schema column; lower priority than the rest of Plan 2)
- M15 (hardcoded contact info) — **deferred to Plan 3** (env or config; minor)
- M16 (`react-icons` likely unused) — Task 6 ✅
- M17 (`html2pdf.d.ts` dead) — Task 6 ✅
- M18 (`Record<string, any>` for icons) — typed during configurator decomposition (Task 13) ✅
- M19 (toast hook race) — **deferred** (replace with `sonner` is a larger swap; lower urgency)
- M20 (delete unused shadcn) — Task 7 ✅
- m1 (`.gitignore` gaps) — done in Plan 1 Task 1 ✅
- m3 (`main.tsx` hash forcing) — Task 9 ✅
- m4 (`useTheme` no-op default) — Task 1 ✅
- m5 (`isError` state in machine-selector) — covered by Task 3's safeParse; full error UI is opportunistic
- m7 (ROI input clamping) — Task 5 ✅
- Performance: dynamic-import PDF — Task 8 ✅; `Cache-Control` on /api/machines — Plan 1 Task 16 ✅
- Tests: unit (Plan 1) + extracted pricing modules (Task 10) + handler-level API (Tasks 18–19) + e2e (Tasks 16–17) ✅
- Docs: README, architecture, api, database, deployment, troubleshooting, known issues — Tasks 20–24 ✅

**Placeholders:** none.

**Type/name consistency:**
- `computeFinancing` and `computeRoi` consistently named in Tasks 10–11.
- `RoiInputs` typename is used by both the modal (Task 11) and the parent (Task 15) — to be defined in `client/src/features/configurator/types.ts` if not already in `shared/schema.ts` (currently it's in `shared/schema.ts` as `RoiParams` — feel free to reuse that name for the modal prop type to keep things aligned).
- `OptionCardProps`, `OptionsPanelProps`, `RoiModalProps`, `FinancingModalProps`, `QuoteFormProps` are used only locally; defined in their respective files.

**Scope:** Plan 2 is intentionally large — 25 tasks, ~6 stages. If after Phase A+B (Tasks 1–9) the velocity warrants, Phases C–E can split into their own plans. But the dependencies are sequential enough (decomposition → tests → docs) that one plan is reasonable.
