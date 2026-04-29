import { z } from "zod";

export const FinancingParamsSchema = z
  .object({
    downPayment: z.number().nonnegative(),
    termMonths: z.number().int().positive(),
    apr: z.number().nonnegative(),
    monthlyPayment: z.number().nonnegative().optional(),
  })
  .strict();
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
  .strict();
export type RoiParams = z.infer<typeof RoiParamsSchema>;
