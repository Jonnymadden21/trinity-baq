type MoneyString = string;

interface PricingMachine {
  id: number;
  basePrice: MoneyString;
}
interface PricingOption {
  id: number;
  machineId: number;
  price: MoneyString;
  // Quantity stored in DB seed (pallet count, etc). null/undefined → 1.
  quantity: number | null;
  allowQuantityAdjustment: boolean;
  minQuantity: number | null;
  maxQuantity: number | null;
}

export interface QuoteTotals {
  basePrice: MoneyString;
  optionsTotal: MoneyString;
  totalPrice: MoneyString;
}

function toCents(s: MoneyString): bigint {
  const [whole, frac = "00"] = s.split(".");
  const fracPadded = (frac + "00").slice(0, 2);
  return BigInt(whole) * 100n + BigInt(fracPadded);
}

function fromCents(c: bigint): MoneyString {
  const neg = c < 0n;
  const abs = neg ? -c : c;
  const whole = abs / 100n;
  const frac = abs % 100n;
  const fracStr = frac.toString().padStart(2, "0");
  return `${neg ? "-" : ""}${whole.toString()}.${fracStr}`;
}

export interface SelectedOptionInput {
  id: number;
  // Optional override; if omitted, uses the option's stored quantity (or 1).
  quantity?: number;
}

export function computeQuoteTotals(input: {
  machine: PricingMachine;
  allOptions: PricingOption[];
  selectedOptions: SelectedOptionInput[];
}): QuoteTotals & { resolvedQuantities: Record<number, number> } {
  const { machine, allOptions, selectedOptions } = input;

  const seenIds = new Set<number>();
  for (const sel of selectedOptions) {
    if (seenIds.has(sel.id)) throw new Error(`duplicate option id in selection: ${sel.id}`);
    seenIds.add(sel.id);
  }

  const byId = new Map(allOptions.map((o) => [o.id, o]));
  const resolvedQuantities: Record<number, number> = {};
  let optionsCents = 0n;

  for (const sel of selectedOptions) {
    const opt = byId.get(sel.id);
    if (!opt) throw new Error(`unknown option id: ${sel.id}`);
    if (opt.machineId !== machine.id) {
      throw new Error(`option ${sel.id} belongs to wrong machine`);
    }

    // Resolve quantity: client override (only allowed when option permits adjustment),
    // else stored quantity, else 1.
    let qty: number;
    if (sel.quantity !== undefined) {
      if (!opt.allowQuantityAdjustment) {
        throw new Error(`quantity override not permitted for option ${sel.id}`);
      }
      if (!Number.isInteger(sel.quantity) || sel.quantity < 0) {
        throw new Error(`invalid quantity for option ${sel.id}: ${sel.quantity}`);
      }
      const min = opt.minQuantity ?? 0;
      const max = opt.maxQuantity ?? Number.MAX_SAFE_INTEGER;
      if (sel.quantity < min || sel.quantity > max) {
        throw new Error(`quantity ${sel.quantity} out of range [${min},${max}] for option ${sel.id}`);
      }
      qty = sel.quantity;
    } else {
      qty = opt.quantity ?? 1;
    }
    resolvedQuantities[sel.id] = qty;

    if (qty > 0) {
      optionsCents += toCents(opt.price) * BigInt(qty);
    }
  }

  const baseCents = toCents(machine.basePrice);
  const totalCents = baseCents + optionsCents;
  return {
    basePrice: fromCents(baseCents),
    optionsTotal: fromCents(optionsCents),
    totalPrice: fromCents(totalCents),
    resolvedQuantities,
  };
}
