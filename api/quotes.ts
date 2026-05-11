import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, inArray } from "drizzle-orm";
import { db } from "./_db.js";
import { machines, options, quotes } from "../shared/schema.js";
import { env } from "./_lib/env.js";
import { withErrorHandling, methodNotAllowed, HttpError } from "./_lib/handler.js";
import { isAllowedOrigin } from "./_lib/origin.js";
import { sendQuoteEmail } from "./_lib/email.js";
import { validateQuotePayload, generateQuoteNumber } from "./_lib/quotePayload.js";
import { computeQuoteTotals } from "../server/pricing.js";

function getClientIp(req: VercelRequest): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") return xff.split(",")[0].trim();
  if (Array.isArray(xff) && xff.length) return xff[0].split(",")[0].trim();
  return req.socket?.remoteAddress ?? "0.0.0.0";
}

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);

  // 1. Origin allowlist
  const ok = isAllowedOrigin(
    {
      origin: typeof req.headers.origin === "string" ? req.headers.origin : undefined,
      referer: typeof req.headers.referer === "string" ? req.headers.referer : undefined,
    },
    env.ALLOWED_ORIGINS,
  );
  if (!ok) throw new HttpError(403, "Forbidden");

  // 2. Schema
  const parsed = validateQuotePayload(req.body);
  if (!parsed.success) throw new HttpError(400, "Invalid input");
  const p = parsed.data;

  // 3. Honeypot — silent success on hit
  if (p.website && p.website.trim() !== "") {
    console.warn("Honeypot triggered, dropping quote", { ip: getClientIp(req) });
    res.status(200).json({ ok: true });
    return;
  }

  // 4. Look up machine
  const [machine] = await db.select().from(machines).where(eq(machines.id, p.machineId)).limit(1);
  if (!machine) throw new HttpError(400, "Invalid input");

  // 5. Look up + validate every option
  const selectedIds = p.selectedOptions.map((s) => s.id);
  const opts =
    selectedIds.length > 0
      ? await db.select().from(options).where(inArray(options.id, selectedIds))
      : [];
  if (opts.length !== selectedIds.length) throw new HttpError(400, "Invalid input");
  for (const o of opts) {
    if (o.machineId !== machine.id) throw new HttpError(400, "Invalid input");
  }

  // 5b. If user picked a CNC, enforce machine-compatibility on every selected option,
  //     and ensure required-when-compatible options are present.
  const selectedCnc = p.cncMachineModel ?? null;
  for (const o of opts) {
    if (o.compatibleMachineModels) {
      let compat: string[];
      try {
        compat = JSON.parse(o.compatibleMachineModels);
      } catch {
        throw new HttpError(500, "Server misconfiguration");
      }
      if (!selectedCnc || !compat.includes(selectedCnc)) {
        throw new HttpError(400, "Invalid input");
      }
    }
  }
  if (selectedCnc) {
    const allOptsForMachine = await db
      .select()
      .from(options)
      .where(eq(options.machineId, machine.id));
    for (const o of allOptsForMachine) {
      if (!o.requiredWhenCompatible || !o.compatibleMachineModels) continue;
      let compat: string[];
      try {
        compat = JSON.parse(o.compatibleMachineModels);
      } catch {
        continue;
      }
      if (compat.includes(selectedCnc) && !selectedIds.includes(o.id)) {
        throw new HttpError(400, "Invalid input");
      }
    }
  }

  // 6. Recompute totals on the server (cents-precise; honors per-option quantities)
  const totals = computeQuoteTotals({
    machine: { id: machine.id, basePrice: String(machine.basePrice) },
    allOptions: opts.map((o) => ({
      id: o.id,
      machineId: o.machineId,
      price: String(o.price),
      quantity: o.quantity,
      allowQuantityAdjustment: o.allowQuantityAdjustment,
      minQuantity: o.minQuantity,
      maxQuantity: o.maxQuantity,
    })),
    selectedOptions: p.selectedOptions,
  });

  // 7. Insert (numeric columns accept string values; createdAt/updatedAt default server-side)
  const quoteNumber = generateQuoteNumber();
  const [inserted] = await db
    .insert(quotes)
    .values({
      quoteNumber,
      machineId: machine.id,
      machineName: machine.name,
      customerName: p.customerName,
      customerEmail: p.customerEmail,
      customerCompany: p.customerCompany ?? null,
      customerPhone: p.customerPhone ?? null,
      cncMachineModel: p.cncMachineModel ?? null,
      cncYear: p.cncYear ?? null,
      cncSerialNumber: p.cncSerialNumber ?? null,
      voltage: p.voltage ?? null,
      selectedOptions: JSON.stringify(
        opts.map((o) => ({
          id: o.id,
          categoryId: o.categoryId,
          partNumber: o.partNumber,
          name: o.name,
          price: o.price,
          quantity: totals.resolvedQuantities[o.id] ?? o.quantity ?? 1,
          lineTotal: String(Number(o.price) * (totals.resolvedQuantities[o.id] ?? o.quantity ?? 1)),
        })),
      ),
      basePrice: totals.basePrice,
      optionsTotal: totals.optionsTotal,
      totalPrice: totals.totalPrice,
      financingParams: p.financingParams ? JSON.stringify(p.financingParams) : null,
      roiParams: p.roiParams ? JSON.stringify(p.roiParams) : null,
    })
    .returning();

  // 8. Fire-and-forget email (do not block the HTTP response)
  void sendQuoteEmail({
    quoteNumber: inserted.quoteNumber,
    machineName: inserted.machineName,
    totalPrice: totals.totalPrice,
    customerName: inserted.customerName,
    customerEmail: inserted.customerEmail,
    customerCompany: inserted.customerCompany,
    customerPhone: inserted.customerPhone,
    summaryUrl: `https://trinitybaq.com/quote/${inserted.quoteNumber}`,
  }).catch((err) => console.error("Email task error:", err));

  // 9. Respond
  res.status(201).json({ quoteNumber: inserted.quoteNumber });
});
