import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { machines, optionCategories, options } from "../shared/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

export async function seedDatabase() {
  // Check if already seeded
  const existing = await db.select().from(machines);
  if (existing.length > 0) return;

  // ========== AX SERIES MACHINES ==========

  const axMachineData = [
    {
      slug: "ax1-12",
      name: "AX1-12",
      series: "AX",
      tagline: "Compact Pallet Automation for Small VMCs",
      description: "Entry-level automated pallet system with 12 storage locations. Ideal for small vertical machining centers running high-mix, low-volume production. Compact footprint maximizes floor space while delivering unattended runtime.",
      basePrice: 165000,
      specs: JSON.stringify({
        palletStations: 12, maxPartDiameter: '12"', maxPartHeight: '9"',
        maxWeight: "35 lbs.", palletDiameter: '7.5"', palletThickness: '1.5"',
        zeroPointPullStuds: 1, rotaryLoad: "Optional", activeDryingStation: "Included",
        loadDirection: "Side", axWidth: '62"', axDepth: '102"', axHeight: '116"',
        voltage: "220 VAC, 3 Phase, 40 AMPS", secondMachine: "N/A",
        robotPayload: "35 KG", robotAxes: 6,
      }),
      compatibleMachines: JSON.stringify([
        "Haas UMC-350 HD", "Haas DM1 / DT1", "Haas DM2 / DT2", "Haas DC1",
        "Haas UMC-500", "Haas VF-1", "Haas VF-2", "Brother Speedio S300, S500",
        "Doosan DNM 4500", "YCM NFX CX4", "Fanuc Robodrill",
      ]),
      features: JSON.stringify([
        "Six Axis Industrial Robot – 35 KG Max Payload",
        "Standard Schunk Single Pallet Gripper",
        "12 Standard Pallet Storage Locations",
        '15" Operator Control Touch Screen',
        "Trinity AX Pallet Management Software",
        "Fully Integrated Safety Enclosure",
        "Dual Check Safety Software",
        "Active Drying Station",
        "Operator Handheld Vacuum",
        "Shipment Preparation & Crating",
      ]),
    },
    {
      slug: "ax1-18",
      name: "AX1-18",
      series: "AX",
      tagline: "High-Density Compact Pallet System",
      description: "18-pallet automated system in a compact footprint. Perfect for shops needing maximum pallet density with smaller part sizes. Delivers extended unattended runtime for overnight and weekend production.",
      basePrice: 175000,
      specs: JSON.stringify({
        palletStations: 18, maxPartDiameter: '8"', maxPartHeight: '9"',
        maxWeight: "35 lbs.", palletDiameter: '7.5"', palletThickness: '1.5"',
        zeroPointPullStuds: 1, rotaryLoad: "Optional", activeDryingStation: "Included",
        loadDirection: "Side", axWidth: '62"', axDepth: '102"', axHeight: '116"',
        voltage: "220 VAC, 3 Phase, 40 AMPS", secondMachine: "N/A",
        robotPayload: "35 KG", robotAxes: 6,
      }),
      compatibleMachines: JSON.stringify([
        "Haas UMC-350 HD", "Haas DM1 / DT1", "Haas DM2 / DT2", "Haas DC1",
        "Haas UMC-500", "Haas VF-1", "Haas VF-2", "Brother Speedio S300, S500",
        "Doosan DNM 4500", "YCM NFX CX4", "Fanuc Robodrill",
      ]),
      features: JSON.stringify([
        "Six Axis Industrial Robot – 35 KG Max Payload",
        "Standard Schunk Single Pallet Gripper",
        "18 Standard Pallet Storage Locations",
        '15" Operator Control Touch Screen',
        "Trinity AX Pallet Management Software",
        "Fully Integrated Safety Enclosure",
        "Dual Check Safety Software",
        "Active Drying Station",
        "Operator Handheld Vacuum",
        "Shipment Preparation & Crating",
      ]),
    },
    {
      slug: "ax2-16",
      name: "AX2-16",
      series: "AX",
      tagline: "Medium-Duty Pallet Automation – 16 Stations",
      description: "Mid-range automated pallet system supporting up to 55 lbs per pallet and 16\" diameter parts. Built for small/medium vertical machining centers with higher payload requirements.",
      basePrice: 189245,
      specs: JSON.stringify({
        palletStations: 16, maxPartDiameter: '16"', maxPartHeight: '9"',
        maxWeight: "55 lbs.", palletDiameter: '7.5"', palletThickness: '1.5"',
        zeroPointPullStuds: 1, rotaryLoad: "Optional", activeDryingStation: "Included",
        loadDirection: "Side", axWidth: '76"', axDepth: '107"', axHeight: '115"',
        voltage: "220 VAC, 3 Phase, 40 AMPS", secondMachine: "N/A",
        robotPayload: "35 KG", robotAxes: 6,
      }),
      compatibleMachines: JSON.stringify([
        "Haas UMC-500", "Haas UMC-750", "Haas VF-1", "Haas VF-2", "Haas VF-3", "Haas VF-4",
        "Haas VF-1 + TRT160", "Haas VF-2 + TRT160", "Haas VF-3 + TRT160",
        "Brother Speedio S300X1", "Doosan DNM 4500", "Doosan DVF 5000",
        "YCM CX4", "YCM RX65", "Hwacheon D2-5AX", "Fanuc Robodrill",
      ]),
      features: JSON.stringify([
        "Six Axis Industrial Robot – 35 KG Max Payload",
        "Equipped with OEM 220 VAC, 3 Phase Transformer",
        "Standard Schunk Single Pallet Gripper – 55 lbs. Capacity",
        "16 Standard Pallet Storage Locations",
        '15" Operator Control Touch Screen',
        "Trinity AX Pallet Management Software",
        "Fully Integrated Safety Enclosure",
        "Dual Check Safety Software",
        "Active Drying Station with Air Blow Off",
        "Rotary Operator Load Station",
        "Operator Handheld Vacuum",
        "Shipment Preparation & Crating",
      ]),
    },
    {
      slug: "ax2-24",
      name: "AX2-24",
      series: "AX",
      tagline: "High-Capacity Medium-Duty Pallet System",
      description: "24-pallet automated system for maximum unattended runtime. Supports 55 lbs per pallet with 12\" part diameter. Ideal for high-mix production environments needing extended lights-out manufacturing.",
      basePrice: 195845,
      specs: JSON.stringify({
        palletStations: 24, maxPartDiameter: '12"', maxPartHeight: '9"',
        maxWeight: "55 lbs.", palletDiameter: '7.5"', palletThickness: '1.5"',
        zeroPointPullStuds: 1, rotaryLoad: "Optional", activeDryingStation: "Included",
        loadDirection: "Side", axWidth: '76"', axDepth: '107"', axHeight: '115"',
        voltage: "220 VAC, 3 Phase, 40 AMPS", secondMachine: "N/A",
        robotPayload: "35 KG", robotAxes: 6,
      }),
      compatibleMachines: JSON.stringify([
        "Haas UMC-500", "Haas UMC-750", "Haas VF-1", "Haas VF-2", "Haas VF-3", "Haas VF-4",
        "Haas VF-1 + TRT160", "Haas VF-2 + TRT160", "Haas VF-3 + TRT160",
        "Brother Speedio S300X1", "Doosan DNM 4500", "Doosan DVF 5000",
        "YCM CX4", "YCM RX65", "Hwacheon D2-5AX", "Fanuc Robodrill",
      ]),
      features: JSON.stringify([
        "Six Axis Industrial Robot – 35 KG Max Payload",
        "Equipped with OEM 220 VAC, 3 Phase Transformer",
        "Standard Schunk Single Pallet Gripper – 55 lbs. Capacity",
        "24 Standard Pallet Storage Locations",
        '15" Operator Control Touch Screen',
        "Trinity AX Pallet Management Software",
        "Fully Integrated Safety Enclosure",
        "Dual Check Safety Software",
        "Active Drying Station with Air Blow Off",
        "Rotary Operator Load Station",
        "Operator Handheld Vacuum",
        "Shipment Preparation & Crating",
      ]),
    },
    {
      slug: "ax2-16-duo",
      name: "AX2-16 Duo",
      series: "AX",
      tagline: "Dual-Machine Pallet Automation",
      description: "16-pallet system designed to serve two CNC machines simultaneously. Doubles your automation capacity without doubling floor space. Shares pallets between machines for maximum flexibility.",
      basePrice: 225000,
      specs: JSON.stringify({
        palletStations: 16, maxPartDiameter: '16"', maxPartHeight: '9"',
        maxWeight: "55 lbs.", palletDiameter: '7.5"', palletThickness: '1.5"',
        zeroPointPullStuds: 1, rotaryLoad: "Optional", activeDryingStation: "Included",
        loadDirection: "Side", axWidth: '80"', axDepth: '102.4"', axHeight: '115"',
        voltage: "220 VAC, 3 Phase, 40 AMPS", secondMachine: "Optional",
        robotPayload: "35 KG", robotAxes: 6,
      }),
      compatibleMachines: JSON.stringify([
        "Haas UMC-350 HD", "Haas DM1 / DT1", "Haas DM2 / DT2", "Haas DC1",
        "Haas UMC-500", "Haas UMC-750", "Haas VF-1", "Haas VF-2", "Haas VF-3", "Haas VF-4",
        "Brother Speedio S300X1", "Doosan DNM 4500", "Doosan DVF 5000",
        "YCM CX4", "YCM RX65", "Hwacheon D2-5AX", "Fanuc Robodrill",
      ]),
      features: JSON.stringify([
        "Dual-Machine Configuration – Serve Two CNCs",
        "Six Axis Industrial Robot – 35 KG Max Payload",
        "Standard Schunk Single Pallet Gripper – 55 lbs. Capacity",
        "16 Standard Pallet Storage Locations",
        '15" Operator Control Touch Screen',
        "Trinity AX Pallet Management Software",
        "Fully Integrated Safety Enclosure",
        "Dual Check Safety Software",
        "Active Drying Station",
        "Shipment Preparation & Crating",
      ]),
    },
    {
      slug: "ax2-24-duo",
      name: "AX2-24 Duo",
      series: "AX",
      tagline: "Dual-Machine High-Capacity Automation",
      description: "24-pallet dual-machine system for maximum throughput. Automates two CNC machines with shared pallet storage for ultimate production flexibility and extended unattended runtime.",
      basePrice: 245000,
      specs: JSON.stringify({
        palletStations: 24, maxPartDiameter: '12"', maxPartHeight: '9"',
        maxWeight: "55 lbs.", palletDiameter: '7.5"', palletThickness: '1.5"',
        zeroPointPullStuds: 1, rotaryLoad: "Optional", activeDryingStation: "Included",
        loadDirection: "Side", axWidth: '80"', axDepth: '102.4"', axHeight: '115"',
        voltage: "220 VAC, 3 Phase, 40 AMPS", secondMachine: "Optional",
        robotPayload: "35 KG", robotAxes: 6,
      }),
      compatibleMachines: JSON.stringify([
        "Haas UMC-350 HD", "Haas DM1 / DT1", "Haas DM2 / DT2", "Haas DC1",
        "Haas UMC-500", "Haas UMC-750", "Haas VF-1", "Haas VF-2", "Haas VF-3", "Haas VF-4",
        "Brother Speedio S300X1", "Doosan DNM 4500", "Doosan DVF 5000",
        "YCM CX4", "YCM RX65", "Hwacheon D2-5AX", "Fanuc Robodrill",
      ]),
      features: JSON.stringify([
        "Dual-Machine Configuration – Serve Two CNCs",
        "Six Axis Industrial Robot – 35 KG Max Payload",
        "Standard Schunk Single Pallet Gripper – 55 lbs. Capacity",
        "24 Standard Pallet Storage Locations",
        '15" Operator Control Touch Screen',
        "Trinity AX Pallet Management Software",
        "Fully Integrated Safety Enclosure",
        "Active Drying Station",
        "Shipment Preparation & Crating",
      ]),
    },
    {
      slug: "ax4-12",
      name: "AX4-12",
      series: "AX",
      tagline: "Front-Load Large-Format Pallet System",
      description: "12-pallet front-loading system for larger parts up to 21.65\" diameter and 16.50\" height. Designed for medium/large vertical machining centers with front automation entry.",
      basePrice: 235000,
      specs: JSON.stringify({
        palletStations: 12, maxPartDiameter: '21.65"', maxPartHeight: '16.50"',
        maxWeight: "75 lbs.", palletDiameter: '7.5"', palletThickness: '1.5"',
        zeroPointPullStuds: 1, rotaryLoad: "Optional", activeDryingStation: "Included",
        loadDirection: "Front", axWidth: '112"', axDepth: '102"', axHeight: '116"',
        voltage: "220 VAC, 3 Phase, 40 AMPS", secondMachine: "N/A",
        robotPayload: "50 KG", robotAxes: 6,
      }),
      compatibleMachines: JSON.stringify([
        "Haas UMC-500", "Haas UMC-750", "Haas UMC-1000",
        "Haas VF-1", "Haas VF-2", "Haas VF-3", "Haas VF-4",
        "Doosan DNM 4500", "Doosan DVF 5000",
        "Kitamura Mytrunnion-4G", "Matsuura MX-520", "Matsuura MX-850",
        "Hwacheon D2-5AX", "YCM RX65", "Mitsui Seiki VERTEX 55X III",
      ]),
      features: JSON.stringify([
        "Six Axis Industrial Robot – 50 KG Max Payload",
        "Front-Loading Configuration",
        "Standard Schunk Single Pallet Gripper – 75 lbs. Capacity",
        "12 Standard Pallet Storage Locations",
        "Large Part Capacity – 21.65\" Diameter",
        '15" Operator Control Touch Screen',
        "Trinity AX Pallet Management Software",
        "Fully Integrated Safety Enclosure",
        "Active Drying Station",
        "Shipment Preparation & Crating",
      ]),
    },
    {
      slug: "ax4-12-hd",
      name: "AX4-12 HD",
      series: "AX",
      tagline: "Heavy-Duty Front-Load Pallet System",
      description: "Heavy-duty 12-pallet system with 180 lbs capacity per pallet. Features triple pull stud HD pallets and 100 KG robot payload for the most demanding large-part applications.",
      basePrice: 275000,
      specs: JSON.stringify({
        palletStations: 12, maxPartDiameter: '21.65"', maxPartHeight: '16.50"',
        maxWeight: "180 lbs.", palletDiameter: '14.75"', palletThickness: '1.5"',
        zeroPointPullStuds: 3, rotaryLoad: "Optional", activeDryingStation: "Included",
        loadDirection: "Front", axWidth: '112"', axDepth: '102"', axHeight: '116"',
        voltage: "220 VAC, 3 Phase, 40 AMPS", secondMachine: "N/A",
        robotPayload: "100 KG", robotAxes: 6,
      }),
      compatibleMachines: JSON.stringify([
        "Haas UMC-500", "Haas UMC-750", "Haas UMC-1000",
        "Haas VF-1", "Haas VF-2", "Haas VF-3", "Haas VF-4",
        "Doosan DNM 4500", "Doosan DVF 5000",
        "Kitamura Mytrunnion-4G", "Matsuura MX-520", "Matsuura MX-850",
        "Hwacheon D2-5AX", "YCM RX65", "Mitsui Seiki VERTEX 55X III",
      ]),
      features: JSON.stringify([
        "Six Axis Industrial Robot – 100 KG Max Payload",
        "Heavy-Duty Triple Pull Stud Pallets (14.75\")",
        "Front-Loading Configuration",
        "Schunk HD Pallet Gripper – 180 lbs. Capacity",
        "12 HD Pallet Storage Locations",
        "3x Schunk Vero-S Clamping Modules per Pallet",
        '15" Operator Control Touch Screen',
        "Trinity AX Pallet Management Software",
        "Fully Integrated Safety Enclosure",
        "Active Drying Station",
        "Shipment Preparation & Crating",
      ]),
    },
    {
      slug: "ax5-20",
      name: "AX5-20",
      series: "AX",
      tagline: "Large-Format 20-Pallet Automation",
      description: "20-pallet automated system for medium/large vertical machining centers. Supports 20\" diameter parts with 75 lbs capacity. Side-loading design integrates seamlessly with UMC-750 and similar machines.",
      basePrice: 212082,
      specs: JSON.stringify({
        palletStations: 20, maxPartDiameter: '20"', maxPartHeight: '12"',
        maxWeight: "75 lbs.", palletDiameter: '7.5"', palletThickness: '1.5"',
        zeroPointPullStuds: 1, rotaryLoad: "Optional", activeDryingStation: "Included",
        loadDirection: "Side", axWidth: '104"', axDepth: '127"', axHeight: '115"',
        voltage: "220 VAC, 3 Phase, 40 AMPS", secondMachine: "N/A",
        robotPayload: "50 KG", robotAxes: 6,
      }),
      compatibleMachines: JSON.stringify([
        "Haas UMC-500", "Haas UMC-750", "Haas UMC-1000",
        "Haas VF-1", "Haas VF-2", "Haas VF-3", "Haas VF-4",
        "Doosan DNM 4500", "Doosan DVF 5000",
        "Kitamura Mytrunnion-4G", "Matsuura MX-520", "Matsuura MX-850",
        "Hwacheon D2-5AX", "YCM RX65",
      ]),
      features: JSON.stringify([
        "Six Axis Industrial Robot – 50 KG Max Payload",
        "Standard Schunk Single Pallet Gripper – 75 lbs. Capacity",
        "20 Standard Pallet Storage Locations",
        "20\" Max Part Diameter",
        '15" Operator Control Touch Screen',
        "Trinity AX Pallet Management Software",
        "Fully Integrated Safety Enclosure",
        "Dual Check Safety Robot Software",
        "Active Drying Station with Air Blow Off",
        "Rotary Operator Load Station",
        "Operator Handheld Vacuum",
        "Shipment Preparation & Crating",
      ]),
    },
    {
      slug: "ax5-20-hd",
      name: "AX5-20 HD",
      series: "AX",
      tagline: "Heavy-Duty 20-Pallet Powerhouse",
      description: "The flagship heavy-duty system with 180 lbs capacity per pallet. Features 100 KG robot, HD triple-stud pallets, and 3x Schunk Vero-S clamping modules. Built for the most demanding production environments.",
      basePrice: 277959,
      specs: JSON.stringify({
        palletStations: 20, maxPartDiameter: '20"', maxPartHeight: '12"',
        maxWeight: "180 lbs.", palletDiameter: '14.75"', palletThickness: '1.5"',
        zeroPointPullStuds: 3, rotaryLoad: "Optional", activeDryingStation: "Included",
        loadDirection: "Side", axWidth: '104"', axDepth: '127"', axHeight: '115"',
        voltage: "220 VAC, 3 Phase, 40 AMPS", secondMachine: "N/A",
        robotPayload: "100 KG", robotAxes: 6,
      }),
      compatibleMachines: JSON.stringify([
        "Haas UMC-500", "Haas UMC-750", "Haas UMC-1000",
        "Haas VF-1", "Haas VF-2", "Haas VF-3", "Haas VF-4",
        "Doosan DNM 4500", "Doosan DVF 5000",
        "Kitamura Mytrunnion-4G", "Matsuura MX-520", "Matsuura MX-850",
        "Hwacheon D2-5AX", "YCM RX65",
      ]),
      features: JSON.stringify([
        "Six Axis Industrial Robot – 100 KG Max Payload",
        "Heavy-Duty Triple Pull Stud Pallets (14.75\")",
        "Schunk HD Pallet Gripper – 180 lbs. Capacity",
        "20 HD Pallet Storage Locations",
        "3x Schunk Vero-S Clamping Modules per Pallet",
        '15" Operator Control Touch Screen',
        "Trinity AX Pallet Management Software",
        "Fully Integrated Safety Enclosure",
        "Dual Check Safety Robot Software",
        "Active Drying Station with Air Blow Off",
        "Rotary Operator Load Station",
        "Operator Handheld Vacuum",
        "Shipment Preparation & Crating",
      ]),
    },
    // ========== Ai SERIES ==========
    {
      slug: "ai-part-loader",
      name: "Ai Part Loader",
      series: "Ai",
      tagline: "AI-Powered Machine Tending – No Robot Programming",
      description: "Revolutionary AI-driven part loading system with Intrinsic Intelligence. Eliminates complex robot programming with AI-powered motion control. Features automatic gripper finger and air vise jaw changeovers for high-mix CNC automation.",
      basePrice: 115900,
      specs: JSON.stringify({
        maxPartWidth: '4"', maxPartHeight: '4"', maxPartLength: '6"',
        maxWeight: "8 lbs.",
        voltage: "220 VAC, 3 Phase, 40 AMPS",
        robotAxes: 6,
        aiPowered: true,
        softwareSubscription: "$12,000/year (Advanced Perception)",
        footprintWidth: '91"', footprintDepth: '80.5"',
      }),
      compatibleMachines: JSON.stringify([
        "Haas VF-1", "Haas VF-2", "Haas VF-3", "Haas VF-4",
      ]),
      features: JSON.stringify([
        "AI-Powered Robot Motion – No Robot Programming",
        "Automated Robot Finger Changing",
        "Automated Work Holding Jaw Changing",
        "Automated Touch Sensing",
        "Automated CNC Program Selection",
        "Simple Part Change Overs",
        "CNC / Auto-Door Integration",
        "Built with Intrinsic Intelligence",
        "Interchangeable Part Grid Plate",
        "Quick Change Pneumatic Vice Jaw Kit",
        "Quick Change Robot Gripper Finger Kit",
        "Confirmation Detection",
        "Application Support",
        "First Year Advanced Ai Subscription Included",
        "Installation by Trinity OEM Technicians",
      ]),
    },
  ];

  // Insert all machines
  for (const m of axMachineData) {
    await db.insert(machines).values(m);
  }

  const allMachines = await db.select().from(machines);

  // For each machine, create option categories and options
  for (const machine of allMachines) {
    if (machine.series === "AX") {
      await seedAXOptions(machine.id, machine.slug, allMachines);
    } else if (machine.series === "Ai") {
      await seedAiOptions(machine.id);
    }
  }
}

async function seedAXOptions(machineId: number, slug: string, allMachines: any[]) {
  const isHD = slug.includes("hd");
  const isDuo = slug.includes("duo");
  const specs = JSON.parse(
    allMachines.find((m) => m.id === machineId)!.specs
  );

  // Category 1: CNC Machine Integration
  const cat1 = await db.insert(optionCategories).values({
    slug: "cnc-integration", name: "CNC Machine Integration", sortOrder: 1, machineId,
  }).returning().then(r => r[0]);

  await db.insert(options).values([
    {
      categoryId: cat1.id, partNumber: "AX.A176", name: "In-Machine CNC Zero-Point Interface",
      description: "Zero-Point Receiver with Schunk Vero-S clamping module(s). Integration to CNC Table. Controls Package with Clamp Confirmation Detection. Blow offs for contact surfaces.",
      price: 0, isStandard: true, isRequired: true, machineId,
    },
    {
      categoryId: cat1.id, partNumber: "AX.A177", name: "Rotary Union Trunnion Assembly",
      description: "Rotary union assembly for Haas Universal Machining Centers. Includes Rotary Union, Anti-Rotation Brackets, and misc. hardware.",
      price: 0, isStandard: true, isRequired: true, machineId,
    },
    {
      categoryId: cat1.id, partNumber: "AX.A187", name: "CNC Side Auto-Door",
      description: "Auto-Door for Haas Machining Centers (2023+). On-site integration services to customer machine. Auto-Door integration for Trinity AX access to customer CNC.",
      price: 0, isStandard: true, isRequired: true, machineId,
    },
    {
      categoryId: cat1.id, partNumber: "AX.A223", name: "Trinity AC Retrofit Kit",
      description: "AC Retrofit Kit for Haas Machining Centers. Integration to retrofit electrical cabinet AC.",
      price: 0, isStandard: true, isRequired: true, machineId,
    },
  ]);

  // Category 2: Pallets
  const cat2 = await db.insert(optionCategories).values({
    slug: "pallets", name: "Pallet Configuration", sortOrder: 2, machineId,
  }).returning().then(r => r[0]);

  const palletCount = specs.palletStations;
  await db.insert(options).values([
    {
      categoryId: cat2.id, partNumber: isHD ? "AX.A081" : "AX.A157",
      name: isHD ? "Trinity HD Certified Pallets" : "Trinity Certified Pallets",
      description: isHD
        ? `A3 HD Style Blank Pallet - No Hole Pattern. Heavy Duty – Triple Pull stud for 3 Schunk Vero-S Receivers. Approx. 14.75" Diameter x 1.5".`
        : `A3 Style Blank Pallet - No Hole Pattern. Standard duty – Single Pull stud for single Schunk Vero-S Receiver. Approx. 7.5" Diameter x 1.5".`,
      price: 0, isStandard: true, isRequired: true, quantity: palletCount, machineId,
    },
    {
      categoryId: cat2.id, partNumber: "AX.P-EXTRA-4",
      name: "Additional Pallets (4-Pack)",
      description: "4 additional certified pallets for expanded production capacity.",
      price: isHD ? 3200 : 1800, isStandard: false, machineId,
    },
  ]);

  // Category 3: Work Holding Options
  const cat3 = await db.insert(optionCategories).values({
    slug: "workholding", name: "Work Holding Options", sortOrder: 3, machineId,
  }).returning().then(r => r[0]);

  await db.insert(options).values([
    {
      categoryId: cat3.id, partNumber: "AX.WH-DT", name: "Dovetail Fixturing",
      description: "Precision dovetail fixtures for secure part holding. Ideal for complex geometries and multi-sided machining operations.",
      price: 2950, isStandard: false, machineId,
    },
    {
      categoryId: cat3.id, partNumber: "AX.WH-SC", name: "Self Centering Vice w/ Soft Jaw",
      description: "Self-centering vice with machinable soft jaws. Quick-change capability for high-mix production environments.",
      price: 3450, isStandard: false, machineId,
    },
    {
      categoryId: cat3.id, partNumber: "AX.WH-DV", name: "Dual Vice Setup",
      description: "Dual vice configuration for doubled part holding capacity per pallet. Run two parts simultaneously for increased throughput.",
      price: 4950, isStandard: false, machineId,
    },
    {
      categoryId: cat3.id, partNumber: "AX.WH-TB", name: "Tombstone Fixtures",
      description: "Multi-sided tombstone fixtures for maximum part density. Machine multiple parts per cycle with 4-sided access.",
      price: 5500, isStandard: false, machineId,
    },
    {
      categoryId: cat3.id, partNumber: "AX.WH-3D", name: "3D Modular Work Holding",
      description: "Flexible 3D modular work holding system. Adaptable grid-based fixturing for infinite part configurations.",
      price: 4200, isStandard: false, machineId,
    },
    {
      categoryId: cat3.id, partNumber: "AX.WH-CF", name: "Custom Fixturing",
      description: "Custom-engineered fixturing designed specifically for your parts. Trinity engineering team designs and manufactures to your specifications.",
      price: 6500, isStandard: false, machineId,
    },
  ]);

  // Category 4: Installation & Services
  const cat4 = await db.insert(optionCategories).values({
    slug: "installation", name: "Installation & Services", sortOrder: 4, machineId,
  }).returning().then(r => r[0]);

  await db.insert(options).values([
    {
      categoryId: cat4.id, partNumber: "AX.INST", name: "On-Site Installation & Integration",
      description: "Trinity technician on-site for installation / machine integration. Includes on-site time & travel expenses. Hands-on operator training. Normal business hours 8:00 AM – 5:00 PM.",
      price: 6995, isStandard: false, isRequired: true, machineId,
    },
    {
      categoryId: cat4.id, partNumber: "AX.TRAIN-EXT", name: "Extended Operator Training",
      description: "Additional days of on-site operator training beyond standard installation training. Ideal for shops with multiple shifts or new operators.",
      price: 2500, isStandard: false, machineId,
    },
  ]);

  // Category 5: Upgrades & Accessories
  const cat5 = await db.insert(optionCategories).values({
    slug: "upgrades", name: "Upgrades & Accessories", sortOrder: 5, machineId,
  }).returning().then(r => r[0]);

  await db.insert(options).values([
    {
      categoryId: cat5.id, partNumber: "AX.RL-01", name: "Rotary Load Station Upgrade",
      description: "Rotating operator load station with single clamping module. Four manual index positions with operator handles for ergonomic part loading.",
      price: 4500, isStandard: false, machineId,
    },
    {
      categoryId: cat5.id, partNumber: "AX.VAC-01", name: "Operator Handheld Vacuum",
      description: "Vacuum setup at operator station for cleaning of parts/equipment. Includes vacuum nozzle, hose, & receptacle. Functions on standard compressed air supply.",
      price: 0, isStandard: true, machineId,
    },
    {
      categoryId: cat5.id, partNumber: "AX.V480", name: "480 VAC Power Option",
      description: "480 VAC, 3 Phase, 20 AMPS power configuration. Alternative voltage option for shops with 480V electrical infrastructure.",
      price: 1500, isStandard: false, machineId,
    },
    {
      categoryId: cat5.id, partNumber: "AX.LIGHT", name: "Work Cell LED Lighting Package",
      description: "High-intensity LED lighting for improved visibility inside the AX work cell. Critical for visual inspection and monitoring during operation.",
      price: 1200, isStandard: false, machineId,
    },
  ]);

  // Category 6: Warranty & Support
  const cat6 = await db.insert(optionCategories).values({
    slug: "warranty", name: "Warranty & Support", sortOrder: 6, machineId,
  }).returning().then(r => r[0]);

  await db.insert(options).values([
    {
      categoryId: cat6.id, partNumber: "AX.W-1YR", name: "1-Year Standard Warranty",
      description: "Trinity warranties purchased materials and workmanship to be free of defects for one (1) year from SAT run-off completion or production start.",
      price: 0, isStandard: true, isRequired: true, machineId,
    },
    {
      categoryId: cat6.id, partNumber: "AX.W-2YR", name: "2-Year Extended Warranty",
      description: "Extended warranty coverage for an additional year beyond the standard 1-year warranty. Includes parts and labor for manufacturing defects.",
      price: 8500, isStandard: false, machineId,
    },
    {
      categoryId: cat6.id, partNumber: "AX.PM-ANN", name: "Annual Preventive Maintenance",
      description: "Scheduled annual preventive maintenance visit by Trinity-certified technician. Includes system inspection, calibration verification, and software updates.",
      price: 4995, isStandard: false, machineId,
    },
  ]);

  // If Duo, add second machine category
  if (isDuo) {
    const cat7 = await db.insert(optionCategories).values({
      slug: "second-machine", name: "Second Machine Integration", sortOrder: 7, machineId,
    }).returning().then(r => r[0]);

    await db.insert(options).values([
      {
        categoryId: cat7.id, partNumber: "AX.DUO-INT", name: "Second CNC Machine Integration Package",
        description: "Complete integration package for the second CNC machine. Includes auto-door, zero-point interface, safety integration, and commissioning.",
        price: 18500, isStandard: false, machineId,
      },
    ]);
  }
}

async function seedAiOptions(machineId: number) {
  // Category 1: Work Holding
  const cat1 = await db.insert(optionCategories).values({
    slug: "workholding", name: "Work Holding & Gripper", sortOrder: 1, machineId,
  }).returning().then(r => r[0]);

  await db.insert(options).values([
    {
      categoryId: cat1.id, partNumber: "AI.WH-BASE", name: "Base Quick Change Work Holding Package",
      description: "Air Vise Kit with Schunk pneumatic two jaw vise. Base plate, quick change jaw kit, aluminum soft jaws, and 2 sets of quick change robot gripper fingers.",
      price: 0, isStandard: true, isRequired: true, machineId,
    },
    {
      categoryId: cat1.id, partNumber: "AI.VJ-QC", name: "Quick Change Vise Jaw Kit",
      description: "Schunk Quick Change Jaws for air vise (1 Set). Aluminum Soft Jaws – Machinable for part geometry (1 Set).",
      price: 1900, isStandard: false, machineId,
    },
    {
      categoryId: cat1.id, partNumber: "AI.VJ-AL", name: "Air Vise Aluminum Soft Jaws",
      description: "Aluminum Soft Jaws – Machinable for part geometry (1 Set). For custom part profiles.",
      price: 475, isStandard: false, machineId,
    },
    {
      categoryId: cat1.id, partNumber: "AI.VJ-ST", name: "Air Vise Steel Soft Jaws",
      description: "Steel Soft Jaws – Machinable for part geometry (1 Set). Replaces Schunk Quick Change Jaws + Aluminum Soft Jaws. Schunk WTR-A 160.",
      price: 1050, isStandard: false, machineId,
    },
  ]);

  // Category 2: Robot Gripper Options
  const cat2 = await db.insert(optionCategories).values({
    slug: "gripper", name: "Robot Gripper Options", sortOrder: 2, machineId,
  }).returning().then(r => r[0]);

  await db.insert(options).values([
    {
      categoryId: cat2.id, partNumber: "AI.GF-QC", name: "Quick Change Robot Gripper Finger Kit",
      description: "Aluminum finger blanks – machinable for part geometry (1 Set). Schunk automatic quick-change jaws (1 Set). Schunk centering sleeves (1 set).",
      price: 1450, isStandard: false, machineId,
    },
    {
      categoryId: cat2.id, partNumber: "AI.GF-RF", name: "Robot Gripper Finger Refill Kit",
      description: "Machinable finger kit for Quick Change system. Aluminum finger blanks (1 Set). Schunk centering sleeves (1 set). Re-uses existing quick-change jaws.",
      price: 250, isStandard: false, machineId,
    },
    {
      categoryId: cat2.id, partNumber: "AI.GF-CS", name: "Gripper Finger Centering Sleeve Kit",
      description: "Schunk centering sleeves replacement set (1 set).",
      price: 25, isStandard: false, machineId,
    },
  ]);

  // Category 3: Grid Plates & Application Support
  const cat3 = await db.insert(optionCategories).values({
    slug: "grid-plates", name: "Grid Plates & Support", sortOrder: 3, machineId,
  }).returning().then(r => r[0]);

  await db.insert(options).values([
    {
      categoryId: cat3.id, partNumber: "AI.GP-01", name: "Part Grid Plate",
      description: "Part grid for locating material for processing by robot. Grid size / product count based upon product geometry. One included with system, additional available.",
      price: 395, isStandard: false, machineId,
    },
    {
      categoryId: cat3.id, partNumber: "AI.AS-01", name: "Application Engineering Support",
      description: "Application engineering support for part introduction / changeover. Soft jaw / finger design & machining support. Part introduction support for high mix environments.",
      price: 2500, isStandard: false, machineId,
    },
  ]);

  // Category 4: Software Subscriptions
  const cat4 = await db.insert(optionCategories).values({
    slug: "software", name: "Software & Subscriptions", sortOrder: 4, machineId,
  }).returning().then(r => r[0]);

  await db.insert(options).values([
    {
      categoryId: cat4.id, partNumber: "AI.SW-ADV", name: "Advanced Ai Subscription (Year 1 Included)",
      description: "Advanced Trinity Ai feature set with Intrinsic Perception. Allows motion planning / part introduction via CAD upload. First year included with purchase.",
      price: 0, isStandard: true, isRequired: true, machineId,
    },
    {
      categoryId: cat4.id, partNumber: "AI.SW-STD-Y2", name: "Standard Software Subscription (Year 2+)",
      description: "Standard annual software subscription. Due 12 months following installation. $4,995 annually recurring.",
      price: 4995, isStandard: false, machineId,
    },
    {
      categoryId: cat4.id, partNumber: "AI.SW-ADV-Y2", name: "Advanced Perception Subscription (Year 2+)",
      description: "Advanced Perception annual software subscription. Includes PM services and advanced perception features. $12,000 annually recurring.",
      price: 12000, isStandard: false, machineId,
    },
  ]);

  // Category 5: Installation
  const cat5 = await db.insert(optionCategories).values({
    slug: "installation", name: "Installation & Training", sortOrder: 5, machineId,
  }).returning().then(r => r[0]);

  await db.insert(options).values([
    {
      categoryId: cat5.id, partNumber: "AI.INST", name: "Certified On-Site Installation",
      description: "Trinity technician on-site for installation / machine integration. Includes installation, commissioning, and hands-on operator training. Normal business hours 8:00 AM – 5:00 PM.",
      price: 6995, isStandard: false, isRequired: true, machineId,
    },
  ]);

  // Category 6: Warranty
  const cat6 = await db.insert(optionCategories).values({
    slug: "warranty", name: "Warranty & Support", sortOrder: 6, machineId,
  }).returning().then(r => r[0]);

  await db.insert(options).values([
    {
      categoryId: cat6.id, partNumber: "AI.W-1YR", name: "1-Year Standard Warranty",
      description: "Trinity warranties purchased materials and workmanship to be free of defects for one (1) year.",
      price: 0, isStandard: true, isRequired: true, machineId,
    },
    {
      categoryId: cat6.id, partNumber: "AI.W-2YR", name: "2-Year Extended Warranty",
      description: "Extended warranty for additional peace of mind beyond the standard coverage.",
      price: 6500, isStandard: false, machineId,
    },
  ]);
}

// Run seed directly
seedDatabase()
  .then(() => {
    console.log("Seed complete!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
