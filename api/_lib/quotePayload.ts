import { z } from "zod";
import { FinancingParamsSchema, RoiParamsSchema } from "../../shared/zodTypes.js";

export const QuotePayloadSchema = z.object({
  machineId: z.number().int().positive(),
  selectedOptionIds: z.array(z.number().int().positive()),
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email().max(254),
  customerCompany: z.string().max(200).nullable().optional(),
  customerPhone: z.string().max(50).nullable().optional(),
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
