import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const machines = pgTable("machines", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  series: text("series").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  // Specs stored as JSON text
  specs: text("specs").notNull(), // JSON: { palletStations, maxPartDiameter, maxPartHeight, maxWeight, ... }
  compatibleMachines: text("compatible_machines").notNull(), // JSON array of strings
  features: text("features").notNull(), // JSON array of feature strings
});

export const optionCategories = pgTable(
  "option_categories",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull(),
    machineId: integer("machine_id")
      .notNull()
      .references(() => machines.id, { onDelete: "cascade" }),
  },
  (t) => ({
    machineIdx: index("idx_option_categories_machine_id").on(t.machineId),
  }),
);

export const options = pgTable(
  "options",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("category_id")
      .notNull()
      .references(() => optionCategories.id, { onDelete: "cascade" }),
    partNumber: text("part_number"),
    name: text("name").notNull(),
    description: text("description").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    isStandard: boolean("is_standard").notNull().default(false),
    isRequired: boolean("is_required").notNull().default(false),
    quantity: integer("quantity").default(1),
    // When non-null, only show this option if the user's selected CNC model is in the JSON array.
    compatibleMachineModels: text("compatible_machine_models"),
    // When true AND compatibleMachineModels matches, auto-include and prevent deselect (e.g. AC Retrofit on UMC-400/500/750).
    requiredWhenCompatible: boolean("required_when_compatible").notNull().default(false),
    // When true, the user can adjust the quantity in the configurator (pallets, work-holding pieces).
    allowQuantityAdjustment: boolean("allow_quantity_adjustment").notNull().default(false),
    minQuantity: integer("min_quantity"),
    maxQuantity: integer("max_quantity"),
    machineId: integer("machine_id")
      .notNull()
      .references(() => machines.id, { onDelete: "cascade" }),
  },
  (t) => ({
    categoryIdx: index("idx_options_category_id").on(t.categoryId),
    machineIdx: index("idx_options_machine_id").on(t.machineId),
  }),
);

export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  quoteNumber: text("quote_number").notNull().unique(),
  machineName: text("machine_name").notNull(),
  machineId: integer("machine_id")
    .notNull()
    .references(() => machines.id, { onDelete: "restrict" }),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerCompany: text("customer_company"),
  customerPhone: text("customer_phone"),
  cncMachineModel: text("cnc_machine_model"),
  cncYear: integer("cnc_year"),
  cncSerialNumber: text("cnc_serial_number"),
  voltage: text("voltage"),
  selectedOptions: text("selected_options").notNull(), // JSON
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  optionsTotal: numeric("options_total", { precision: 10, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  financingParams: text("financing_params"),
  roiParams: text("roi_params"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Types
export type Machine = typeof machines.$inferSelect;
export type Option = typeof options.$inferSelect;
export type OptionCategory = typeof optionCategories.$inferSelect;
export type Quote = typeof quotes.$inferSelect;

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertQuote = z.infer<typeof insertQuoteSchema>;

export type FinancingParams = {
  downPaymentPct: number;
  termMonths: number;
  interestRate: number;
  downPayment: number;
  financedAmount: number;
  monthlyPayment: number;
  totalCost: number;
};

export type RoiParams = {
  shopRate: number;
  hrsPerShift: number;
  operatorWage: number;
  workingDays: number;
  mannedShifts: number;
  unmannedShifts: number;
  mannedUtilBefore: number;
  mannedUtilAfter: number;
  unmannedUtilBefore: number;
  unmannedUtilAfter: number;
  mannedGainHrs: number;
  unmannedGainHrs: number;
  totalGainRev: number;
  laborSaving: number;
  opCost: number;
  netBenefit: number;
  paybackMonths: number;
  year1ROI: number;
  year3ROI: number;
  year5ROI: number;
  capacityMult: number;
  taxSavings: number;
  effectiveCost: number;
};
