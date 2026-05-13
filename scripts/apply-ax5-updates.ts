/**
 * apply-ax5-updates.ts
 *
 * One-off, idempotent migration that applies Mike's AX5-20 / AX5-20 HD PDF
 * changes (dated 2026-05-07) to the live Supabase database.
 *
 * What it does (per slug):
 *  - Updates the `machines` row: basePrice, tagline, description, features,
 *    compatibleMachines, specs.
 *  - Upserts the pallet option with the right price (HD = $2,500, std = $825),
 *    default qty 20, min 2, allowQuantityAdjustment = true.
 *  - Upserts the Trinity Auto-Door option with machine-specific compat list.
 *  - Upserts the AC Retrofit option (mandatory on UMC-400/500/750).
 *  - Upserts Installation @ $9,995 (required).
 *  - Upserts 1-yr / 2-yr+PM / Annual PM warranty options at correct prices.
 *  - Upserts 6 Work Holding options at Mike's price list.
 *  - DELETES stale options no longer in Mike's catalog:
 *      Additional Pallets (4-Pack), Rotary Load Station Upgrade,
 *      480 VAC Power Option, Operator Handheld Vacuum (as upgrade),
 *      Work Cell LED Lighting Package, Extended Operator Training.
 *
 * Safe to run multiple times. Re-running produces no diff.
 *
 * Run with:
 *   DATABASE_URL='<prod_url>' npx tsx scripts/apply-ax5-updates.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and, inArray } from "drizzle-orm";
import postgres from "postgres";
import { machines, optionCategories, options } from "../shared/schema.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

const AX5_COMPAT = [
  "Haas UMC-500","Haas UMC-750","Haas UMC-1000",
  "Haas VF-1","Haas VF-1 + TRT160","Haas VF-1 + TRT210",
  "Haas VF-2","Haas VF-2 + TRT160","Haas VF-2 + TRT210",
  "Haas VF-3","Haas VF-3 + TRT160","Haas VF-3 + TRT210",
  "Haas VF-4","Haas VF-4 + TRT160","Haas VF-4 + TRT210",
  "Brother Speedio S300X1","Doosan DNM 4500","Doosan DVF 4000, 5000",
  "YCM NFX400A / CX4","YCM RX65","Hwacheon D2-5AX","Methods MB-650U",
];

const AX5_HD_COMPAT = [
  "Haas UMC-500","Haas UMC-750","Haas UMC-1000",
  "Haas VF-1","Haas VF-2","Haas VF-3","Haas VF-4",
  "Doosan DNM 4500","Doosan DVF 4000, 5000",
  "YCM NFX400A / CX4","YCM RX65","Hwacheon D2-5AX","Methods MB-650U",
];

const AX5_AUTO_DOOR = [
  "Haas UMC-500","Haas UMC-750","Haas UMC-1000",
  "Haas VF-1","Haas VF-1 + TRT160","Haas VF-1 + TRT210",
  "Haas VF-2","Haas VF-2 + TRT160","Haas VF-2 + TRT210",
  "Haas VF-3","Haas VF-3 + TRT160","Haas VF-3 + TRT210",
  "Haas VF-4","Haas VF-4 + TRT160","Haas VF-4 + TRT210",
  "Doosan DNM 4500",
];

const AX5_HD_AUTO_DOOR = [
  "Haas UMC-500","Haas UMC-750","Haas UMC-1000",
  "Haas VF-1","Haas VF-2","Haas VF-3","Haas VF-4",
  "Doosan DNM 4500",
];

const AC_RETROFIT_CNCS = ["Haas UMC-400","Haas UMC-500","Haas UMC-750"];

type AX5Config = {
  slug: "ax5-20" | "ax5-20-hd";
  isHD: boolean;
  basePrice: string;
  tagline: string;
  description: string;
  features: string[];
  specs: Record<string, unknown>;
  compat: string[];
  autoDoor: string[];
};

const CONFIGS: AX5Config[] = [
  {
    slug: "ax5-20",
    isHD: false,
    basePrice: "189900",
    tagline: "Large-Format Side-Load Pallet Automation – 20 Stations",
    description:
      "Large-sized side-load automated pallet system designed for medium to large vertical machining centers. The AX5 is ideal for high-mix production environments focused on maximizing spindle utilization and increasing lights-out manufacturing capacity. With payload capacities up to 75 lbs. per pallet and 20-pallet storage locations, the AX5 accommodates a wide range of parts while maintaining a compact footprint. Its side-load design preserves unrestricted front access to the machine, allowing operators to perform setups and machine access more efficiently.",
    features: [
      "Six Axis Industrial Robot – 50 KG Max Payload",
      "20 Standard Pallet Storage Locations",
      '20" max part size (for work holding + work piece on top of pallet)',
      '12" max part height (for work holding + work piece on top of pallet)',
      "75 lbs. max weight (for work holding + work piece on top of pallet)",
      "Standard Schunk Single Pallet Gripper – 75 lbs. Capacity",
      '15" Operator Control Touch Screen',
      "Rotary Operator Load Station",
      "Trinity AX Pallet Management Software",
      "Operator Handheld Vacuum",
      "Fully Integrated Safety Enclosure",
      "Active Drying Station",
      "In-Machine CNC Zero-Point Interface",
      "Shipment Preparation & Crating",
    ],
    specs: {
      palletStations: 20,
      maxPartDiameter: '20"',
      maxPartHeight: '12"',
      maxWeight: "75 lbs.",
      palletDiameter: '7.5"',
      palletThickness: '1.5"',
      zeroPointPullStuds: 1,
      rotaryLoad: "Standard",
      activeDryingStation: "Included",
      loadDirection: "Side",
      axWidth: '104"',
      axDepth: '127"',
      axHeight: '115"',
      voltage: "220 VAC, 3 Phase, 40 AMPS (480 VAC available)",
      secondMachine: "N/A",
      robotPayload: "50 KG",
      robotAxes: 6,
    },
    compat: AX5_COMPAT,
    autoDoor: AX5_AUTO_DOOR,
  },
  {
    slug: "ax5-20-hd",
    isHD: true,
    basePrice: "199900",
    tagline: "Heavy-Duty Side-Load Pallet Automation – 20 Stations",
    description:
      "Large-sized side-load automated pallet system designed for medium to large vertical machining centers. The AX5 HD is ideal for high-mix production environments focused on maximizing spindle utilization and increasing lights-out manufacturing capacity. With payload capacities up to 180 lbs. per pallet and 20-pallet storage locations, the AX5 HD accommodates a wide range of parts while maintaining a compact footprint. Its side-load design preserves unrestricted front access to the machine, allowing operators to perform setups and machine access more efficiently.",
    features: [
      "Six Axis Industrial Robot – 100 KG Max Payload",
      "20 HD Pallet Storage Locations",
      '20" max part size (for work holding + work piece on top of pallet)',
      '12" max part height (for work holding + work piece on top of pallet)',
      "180 lbs. max weight (for work holding + work piece on top of pallet)",
      "HD Schunk Single Pallet Gripper – 180 lbs. Capacity",
      "3x Schunk Vero-S Clamping Modules per pallet",
      'Heavy Duty Triple Pull Stud Pallets (14.75")',
      '15" Operator Control Touch Screen',
      "Rotary Operator Load Station",
      "Trinity AX Pallet Management Software",
      "Operator Handheld Vacuum",
      "Fully Integrated Safety Enclosure",
      "Active Drying Station",
      "In-Machine CNC Zero-Point Interface",
      "Shipment Preparation & Crating",
    ],
    specs: {
      palletStations: 20,
      maxPartDiameter: '20"',
      maxPartHeight: '12"',
      maxWeight: "180 lbs.",
      palletDiameter: '14.75"',
      palletThickness: '1.5"',
      zeroPointPullStuds: 3,
      rotaryLoad: "Standard",
      activeDryingStation: "Included",
      loadDirection: "Side",
      axWidth: '104"',
      axDepth: '127"',
      axHeight: '115"',
      voltage: "220 VAC, 3 Phase, 40 AMPS (480 VAC available)",
      secondMachine: "N/A",
      robotPayload: "100 KG",
      robotAxes: 6,
    },
    compat: AX5_HD_COMPAT,
    autoDoor: AX5_HD_AUTO_DOOR,
  },
];

// Work-holding catalog Mike approved (per WH attached sheet referenced in PDFs).
const WORK_HOLDING = [
  { partNumber: "AX.WH-DT551", name: '500 Series Dovetail Vise - 1.5" Dovetail Profile', description: 'Dovetail profile -1.5". Overall height - 3.0". Fixture length - 2.35". Two gripping clamps. (DT-551)', price: "695" },
  { partNumber: "AX.WH-DT320", name: '300 Series Dovetail Vise - ¾" Dovetail Profile', description: 'Dovetail profile - ¾". Overall height - 3.0". Fixture length - 5.97". Three gripping clamps. (DT-320)', price: "950" },
  { partNumber: "AX.WH-DT702", name: '700 Series Dovetail Vise - 3" Dovetail Profile', description: 'Dovetail profile -3". Overall height - 3.0". Fixture length - 7.45". Four gripping clamps. (DT-702)', price: "1495" },
  { partNumber: "AX.WH-KSC80", name: "KSC3 GRIP 80-130 Vise with Grip Jaws", description: "Dimensions: 80 x 130 x 78 mm. Jaw width: 80 mm. Max. clamping force: 25 kN. Max. torque: 90 Nm. Weight: 3.9 kg. (MFG PN 1514206)", price: "1250" },
  { partNumber: "AX.WH-KSC125", name: "KSC3 GRIP 125-160 Vise with Grip Jaws", description: "Dimensions: 125 x 160 x 83 mm. Jaw width: 125 mm. Max. clamping force: 35 kN. Max. torque: 100 Nm. Weight: 8.7 kg. (MFG PN 1514238)", price: "1550" },
  { partNumber: "AX.WH-KSC160", name: "KSC3 GRIP 160-280 Vise with Grip Jaws", description: "Dimensions: 160mm x 280mm x 70mm. Jaw width: 160 mm. Max. clamping force: 50 kN. Max. torque: 175 Nm. Weight: 25 kg. (MFG PN 1514250 / 2 x 432614)", price: "3975" },
];

// Stale options that Mike removed from the catalog. Deleted by partNumber.
const STALE_PART_NUMBERS = [
  "AX.P-EXTRA-4",      // Additional Pallets (4-Pack)
  "AX.RL-01",          // Rotary Load Station Upgrade (now standard)
  "AX.V480",           // 480 VAC Power Option (now in voltage selector)
  "AX.VAC-01",         // Operator Handheld Vacuum (now standard)
  "AX.LIGHT",          // Work Cell LED Lighting Package
  "AX.TRAIN-EXT",      // Extended Operator Training
];

// Stale legacy CNC-integration options (the older pre-standardized seed had
// these as $0 standard rows). We don't add them anymore — clean if present.
const STALE_LEGACY_INTEGRATION = ["AX.A176","AX.A177","AX.A187","AX.A223"];

async function ensureCategory(
  machineId: number,
  slug: string,
  name: string,
  sortOrder: number,
) {
  const existing = await db
    .select()
    .from(optionCategories)
    .where(and(eq(optionCategories.machineId, machineId), eq(optionCategories.slug, slug)));
  if (existing.length > 0) {
    // Keep name/sortOrder in sync if drifted.
    if (existing[0].name !== name || existing[0].sortOrder !== sortOrder) {
      await db
        .update(optionCategories)
        .set({ name, sortOrder })
        .where(eq(optionCategories.id, existing[0].id));
    }
    return existing[0].id;
  }
  const inserted = await db
    .insert(optionCategories)
    .values({ machineId, slug, name, sortOrder })
    .returning();
  return inserted[0].id;
}

async function upsertOption(
  machineId: number,
  categoryId: number,
  values: {
    partNumber: string;
    name: string;
    description: string;
    price: string;
    isStandard?: boolean;
    isRequired?: boolean;
    quantity?: number | null;
    allowQuantityAdjustment?: boolean;
    minQuantity?: number | null;
    maxQuantity?: number | null;
    compatibleMachineModels?: string | null;
    requiredWhenCompatible?: boolean;
  },
) {
  const existing = await db
    .select()
    .from(options)
    .where(and(eq(options.machineId, machineId), eq(options.partNumber, values.partNumber)));

  const row = {
    machineId,
    categoryId,
    partNumber: values.partNumber,
    name: values.name,
    description: values.description,
    price: values.price,
    isStandard: values.isStandard ?? false,
    isRequired: values.isRequired ?? false,
    quantity: values.quantity ?? 1,
    allowQuantityAdjustment: values.allowQuantityAdjustment ?? false,
    minQuantity: values.minQuantity ?? null,
    maxQuantity: values.maxQuantity ?? null,
    compatibleMachineModels: values.compatibleMachineModels ?? null,
    requiredWhenCompatible: values.requiredWhenCompatible ?? false,
  };

  if (existing.length === 0) {
    await db.insert(options).values(row);
    return;
  }
  await db.update(options).set(row).where(eq(options.id, existing[0].id));
}

async function deleteStaleOptions(machineId: number) {
  const partNumbers = [...STALE_PART_NUMBERS, ...STALE_LEGACY_INTEGRATION];
  await db
    .delete(options)
    .where(and(eq(options.machineId, machineId), inArray(options.partNumber, partNumbers)));

  // Drop the legacy "cnc-integration" category if it exists and is now empty.
  const legacyCat = await db
    .select()
    .from(optionCategories)
    .where(and(eq(optionCategories.machineId, machineId), eq(optionCategories.slug, "cnc-integration")));
  for (const cat of legacyCat) {
    const remaining = await db.select().from(options).where(eq(options.categoryId, cat.id));
    if (remaining.length === 0) {
      await db.delete(optionCategories).where(eq(optionCategories.id, cat.id));
    }
  }
}

async function applyForMachine(cfg: AX5Config) {
  const found = await db.select().from(machines).where(eq(machines.slug, cfg.slug));
  if (found.length === 0) {
    console.log(`  ⚠ machine "${cfg.slug}" not found in DB — skipping`);
    return;
  }
  const machineId = found[0].id;
  console.log(`\n→ ${cfg.slug} (id=${machineId})`);

  // 1. Update the machine row.
  await db
    .update(machines)
    .set({
      basePrice: cfg.basePrice,
      tagline: cfg.tagline,
      description: cfg.description,
      features: JSON.stringify(cfg.features),
      specs: JSON.stringify(cfg.specs),
      compatibleMachines: JSON.stringify(cfg.compat),
    })
    .where(eq(machines.id, machineId));
  console.log(`  ✓ machine row updated (base $${cfg.basePrice})`);

  // 2. Categories (idempotent).
  const palletsCat = await ensureCategory(machineId, "pallets", "Pallet Configuration", 1);
  const whCat = await ensureCategory(machineId, "workholding", "Work Holding Options", 2);
  const upgradesCat = await ensureCategory(machineId, "upgrades", "Upgrades & Accessories", 3);
  const installCat = await ensureCategory(machineId, "installation", "Installation & Services", 4);
  const warrantyCat = await ensureCategory(machineId, "warranty", "Warranty & Support", 5);

  // 3. Pallets — HD $2,500, std $825.
  const palletPrice = cfg.isHD ? "2500" : "825";
  await upsertOption(machineId, palletsCat, {
    partNumber: cfg.isHD ? "AX.A081" : "AX.A157",
    name: cfg.isHD ? "Trinity HD Certified Pallets" : "Trinity Certified Pallets",
    description: cfg.isHD
      ? `A3 HD Style Blank Pallet - No Hole Pattern. Heavy Duty – Triple Pull stud for 3 Schunk Vero-S Receivers. Approx. 14.75" Diameter x 1.5". Default 20 pallets, adjustable (minimum 2). $${palletPrice} each.`
      : `A3 Style Blank Pallet - No Hole Pattern. Standard duty – Single Pull stud for single Schunk Vero-S Receiver. Approx. 7.5" Diameter x 1.5". Default 20 pallets, adjustable (minimum 2). $${palletPrice} each.`,
    price: palletPrice,
    isStandard: true,
    isRequired: true,
    quantity: 20,
    allowQuantityAdjustment: true,
    minQuantity: 2,
  });
  console.log(`  ✓ pallets @ $${palletPrice}/each, default 20`);

  // 4. Work holding (6 entries).
  for (const wh of WORK_HOLDING) {
    await upsertOption(machineId, whCat, {
      partNumber: wh.partNumber,
      name: wh.name,
      description: wh.description,
      price: wh.price,
      quantity: 0,
      allowQuantityAdjustment: true,
      minQuantity: 0,
    });
  }
  console.log(`  ✓ ${WORK_HOLDING.length} work-holding options`);

  // 5. Upgrades — Auto-Door (machine-conditional) + AC Retrofit (machine-required).
  await upsertOption(machineId, upgradesCat, {
    partNumber: "AX.AUTO-DOOR",
    name: "Trinity Auto-Door",
    description:
      "Trinity-supplied auto-door integration. Strongly recommended to use the OEM auto-door where available; this option is for CNCs without OEM auto-door support.",
    price: "4995",
    compatibleMachineModels: JSON.stringify(cfg.autoDoor),
  });
  await upsertOption(machineId, upgradesCat, {
    partNumber: "AX.AC-RETRO",
    name: "AC Retrofit",
    description:
      "AC retrofit kit required for Haas UMC-400/500/750 electrical cabinet. Mandatory on these models when configured with Trinity AX.",
    price: "1995",
    compatibleMachineModels: JSON.stringify(AC_RETROFIT_CNCS),
    requiredWhenCompatible: true,
  });
  console.log(`  ✓ Auto-Door + AC Retrofit`);

  // 6. Installation.
  await upsertOption(machineId, installCat, {
    partNumber: "AX.INST",
    name: "On-Site Installation & Integration",
    description:
      "Trinity technician on-site for installation / machine integration. Includes on-site time & travel expenses. Hands-on operator training. Normal business hours 8:00 AM – 5:00 PM.",
    price: "9995",
    isRequired: true,
  });
  console.log(`  ✓ Installation @ $9,995`);

  // 7. Warranty.
  await upsertOption(machineId, warrantyCat, {
    partNumber: "AX.W-1YR",
    name: "1-Year Standard Warranty",
    description:
      "Trinity warranties purchased materials and workmanship to be free of defects for one (1) year from SAT run-off completion or production start.",
    price: "0",
    isStandard: true,
    isRequired: true,
  });
  await upsertOption(machineId, warrantyCat, {
    partNumber: "AX.W-2YR",
    name: "2-Year Extended Warranty + PM",
    description:
      "Extended warranty for an additional year beyond the standard 1-year warranty. Includes parts and labor for manufacturing defects, and Preventive Maintenance visit at the start of year 2.",
    price: "8995",
  });
  await upsertOption(machineId, warrantyCat, {
    partNumber: "AX.PM-ANN",
    name: "Annual Preventive Maintenance",
    description:
      "Scheduled annual preventive maintenance visit by Trinity-certified technician. Recommended at the completion of 1 year of service. Only available if 2-Year Extended Warranty + PM is not selected.",
    price: "2995",
  });
  console.log(`  ✓ Warranty (1yr / 2yr+PM $8,995 / annual PM $2,995)`);

  // 8. Drop stale options.
  await deleteStaleOptions(machineId);
  console.log(`  ✓ stale options removed`);
}

async function main() {
  console.log("Applying AX5-20 / AX5-20 HD updates per Mike's PDFs (2026-05-07)");
  for (const cfg of CONFIGS) {
    await applyForMachine(cfg);
  }
  console.log("\n✅ Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Failed:", err);
    process.exit(1);
  });
