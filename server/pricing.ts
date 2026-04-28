type MoneyString = string;

interface PricingMachine {
  id: number;
  basePrice: MoneyString;
}
interface PricingOption {
  id: number;
  machineId: number;
  price: MoneyString;
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

export function computeQuoteTotals(input: {
  machine: PricingMachine;
  allOptions: PricingOption[];
  selectedOptionIds: number[];
}): QuoteTotals {
  const { machine, allOptions, selectedOptionIds } = input;

  if (new Set(selectedOptionIds).size !== selectedOptionIds.length) {
    throw new Error("duplicate option ids in selection");
  }

  const byId = new Map(allOptions.map((o) => [o.id, o]));
  let optionsCents = 0n;
  for (const id of selectedOptionIds) {
    const opt = byId.get(id);
    if (!opt) throw new Error(`unknown option id: ${id}`);
    if (opt.machineId !== machine.id) {
      throw new Error(`option ${id} belongs to wrong machine`);
    }
    optionsCents += toCents(opt.price);
  }
  const baseCents = toCents(machine.basePrice);
  const totalCents = baseCents + optionsCents;
  return {
    basePrice: fromCents(baseCents),
    optionsTotal: fromCents(optionsCents),
    totalPrice: fromCents(totalCents),
  };
}
