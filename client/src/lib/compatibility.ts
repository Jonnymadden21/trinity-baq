import type { Machine } from "@shared/schema";

export type BrandIndex = {
  brands: string[];
  modelsByBrand: Record<string, string[]>;
  machineSlugsByModel: Record<string, string[]>;
};

const BRAND_PREFIXES = [
  "Haas",
  "Brother",
  "Doosan",
  "YCM",
  "Fanuc",
  "DN Solutions",
  "Mazak",
  "Okuma",
  "Makino",
  "DMG Mori",
  "Hurco",
  "Hyundai Wia",
];

function brandFromEntry(entry: string): { brand: string; model: string } {
  const trimmed = entry.trim();
  const match = BRAND_PREFIXES.find((b) =>
    trimmed.toLowerCase().startsWith(b.toLowerCase() + " "),
  );
  if (match) {
    return { brand: match, model: trimmed.slice(match.length).trim() };
  }
  const [first, ...rest] = trimmed.split(/\s+/);
  return { brand: first, model: rest.join(" ") };
}

export function buildBrandIndex(machines: Machine[]): BrandIndex {
  const modelsByBrandSet: Record<string, Set<string>> = {};
  const machineSlugsByModel: Record<string, Set<string>> = {};

  for (const m of machines) {
    let compat: string[];
    try {
      compat = JSON.parse(m.compatibleMachines);
    } catch {
      compat = [];
    }
    for (const entry of compat) {
      const { brand, model } = brandFromEntry(entry);
      if (!brand || !model) continue;
      (modelsByBrandSet[brand] ??= new Set()).add(model);
      const key = `${brand}|${model}`;
      (machineSlugsByModel[key] ??= new Set()).add(m.slug);
    }
  }

  const brands = Object.keys(modelsByBrandSet).sort();
  const modelsByBrand: Record<string, string[]> = {};
  for (const b of brands) {
    modelsByBrand[b] = Array.from(modelsByBrandSet[b]).sort();
  }
  const slugsByModel: Record<string, string[]> = {};
  for (const k of Object.keys(machineSlugsByModel)) {
    slugsByModel[k] = Array.from(machineSlugsByModel[k]);
  }

  return { brands, modelsByBrand, machineSlugsByModel: slugsByModel };
}

export function compatibleSlugs(
  index: BrandIndex,
  brand: string,
  model: string,
): Set<string> {
  return new Set(index.machineSlugsByModel[`${brand}|${model}`] ?? []);
}
