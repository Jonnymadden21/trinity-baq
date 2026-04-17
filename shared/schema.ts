import { pgTable, serial, text, doublePrecision, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Machine models
export const machines = pgTable("machines", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  series: text("series").notNull(), // "AX" or "Ai"
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  basePrice: doublePrecision("base_price").notNull(),
  imageUrl: text("image_url"),
  // Specs stored as JSON text
  specs: text("specs").notNull(), // JSON: { palletStations, maxPartDiameter, maxPartHeight, maxWeight, ... }
  compatibleMachines: text("compatible_machines").notNull(), // JSON array of strings
  features: text("features").notNull(), // JSON array of feature strings
});

// Option categories
export const optionCategories = pgTable("option_categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull(),
  machineId: integer("machine_id").notNull(),
});

// Individual options within categories
export const options = pgTable("options", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull(),
  partNumber: text("part_number"),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: doublePrecision("price").notNull(), // 0 = included/standard
  isStandard: boolean("is_standard").notNull().default(false),
  isRequired: boolean("is_required").notNull().default(false),
  quantity: integer("quantity").default(1),
  machineId: integer("machine_id").notNull(),
});

// Saved quotes
export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  quoteNumber: text("quote_number").notNull().unique(),
  machineName: text("machine_name").notNull(),
  machineId: integer("machine_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerCompany: text("customer_company"),
  customerPhone: text("customer_phone"),
  selectedOptions: text("selected_options").notNull(), // JSON
  basePrice: doublePrecision("base_price").notNull(),
  optionsTotal: doublePrecision("options_total").notNull(),
  totalPrice: doublePrecision("total_price").notNull(),
  financingParams: text("financing_params"),
  roiParams: text("roi_params"),
  createdAt: text("created_at").notNull(),
});

// Types
export type Machine = typeof machines.$inferSelect;
export type Option = typeof options.$inferSelect;
export type OptionCategory = typeof optionCategories.$inferSelect;
export type Quote = typeof quotes.$inferSelect;

export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true });
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
