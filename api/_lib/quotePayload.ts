import { z } from "zod";
import { FinancingParamsSchema, RoiParamsSchema } from "../../shared/zodTypes.js";

export const SelectedOptionSchema = z.object({
  id: z.number().int().positive(),
  quantity: z.number().int().min(0).max(1000).optional(),
});

export const QuotePayloadSchema = z.object({
  machineId: z.number().int().positive(),
  selectedOptions: z.array(SelectedOptionSchema),
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email().max(254),
  customerCompany: z.string().max(200).nullable().optional(),
  customerPhone: z.string().max(50).nullable().optional(),
  cncMachineModel: z.string().max(120).nullable().optional(),
  cncYear: z.number().int().min(1980).max(2100).nullable().optional(),
  cncSerialNumber: z.string().max(80).nullable().optional(),
  voltage: z.enum(["220 VAC", "480 VAC"]).nullable().optional(),
  financingParams: FinancingParamsSchema.nullable().optional(),
  roiParams: RoiParamsSchema.nullable().optional(),
  website: z.string(), // honeypot, expected empty
});

export type QuotePayload = z.infer<typeof QuotePayloadSchema>;

export function validateQuotePayload(
  body: unknown,
): { success: true; data: QuotePayload } | { success: false } {
  const r = QuotePayloadSchema.safeParse(body);
  return r.success ? { success: true, data: r.data } : { success: false };
}

export function generateQuoteNumber(now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `Q-${yyyy}-${rand}`;
}
