import { z } from "zod";

// Both schemas use .passthrough() so the client can include computed/derived
// values (downPaymentPct, financedAmount, totalCost, capacityMult, paybackMonths,
// year1/3/5ROI, mannedGainHrs, etc.) without the server rejecting them. The
// computed fields are surfaced on the quote-summary page; server only validates
// the core inputs.
export const FinancingParamsSchema = z
  .object({
    downPayment: z.number().nonnegative(),
    termMonths: z.number().int().positive(),
    apr: z.number().nonnegative().optional(),
    interestRate: z.number().nonnegative().optional(),
    monthlyPayment: z.number().nonnegative().optional(),
  })
  .passthrough();
export type FinancingParams = z.infer<typeof FinancingParamsSchema>;

export const RoiParamsSchema = z
  .object({
    shopRate: z.number().nonnegative(),
    hrsPerShift: z.number().nonnegative(),
    operatorWage: z.number().nonnegative(),
    workingDays: z.number().nonnegative(),
    mannedShifts: z.number().int().nonnegative(),
    unmannedShifts: z.number().int().nonnegative(),
    mannedUtilBefore: z.number().min(0).max(100),
    mannedUtilAfter: z.number().min(0).max(100),
    unmannedUtilBefore: z.number().min(0).max(100),
    unmannedUtilAfter: z.number().min(0).max(100),
  })
  .passthrough();
export type RoiParams = z.infer<typeof RoiParamsSchema>;
