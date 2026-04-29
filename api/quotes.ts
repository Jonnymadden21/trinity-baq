import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, inArray } from "drizzle-orm";
import { db } from "./_db";
import { machines, options, quotes } from "../shared/schema";
import { env } from "./_lib/env";
import { withErrorHandling, methodNotAllowed, HttpError } from "./_lib/handler";
import { isAllowedOrigin } from "./_lib/origin";
import { verifyTurnstile } from "./_lib/turnstile";
import { checkRateLimit, getRateLimitClient } from "./_lib/rateLimit";
import { sendQuoteEmail } from "./_lib/email";
import { validateQuotePayload, generateQuoteNumber } from "./_lib/quotePayload";
import { computeQuoteTotals } from "../server/pricing";

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

  // 4. Turnstile
  const ip = getClientIp(req);
  const turnstileOk = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, p.turnstileToken, ip);
  if (!turnstileOk) throw new HttpError(400, "Verification failed");

  // 5. Rate limit
  const rateClient = getRateLimitClient();
  const rl = await checkRateLimit(rateClient, ip, 5, 60);
  if (!rl.allowed) {
    res.setHeader("Retry-After", "60");
    throw new HttpError(429, "Too many requests");
  }

  // 6. Look up machine
  const [machine] = await db.select().from(machines).where(eq(machines.id, p.machineId)).limit(1);
  if (!machine) throw new HttpError(400, "Invalid input");

  // 7. Look up + validate every option
  const opts =
    p.selectedOptionIds.length > 0
      ? await db.select().from(options).where(inArray(options.id, p.selectedOptionIds))
      : [];
  if (opts.length !== p.selectedOptionIds.length) throw new HttpError(400, "Invalid input");
  for (const o of opts) {
    if (o.machineId !== machine.id) throw new HttpError(400, "Invalid input");
  }

  // 8. Recompute totals on the server (coerce doublePrecision → string for the pricing module)
  const totals = computeQuoteTotals({
    machine: { id: machine.id, basePrice: String(machine.basePrice) },
    allOptions: opts.map((o) => ({
      id: o.id,
      machineId: o.machineId,
      price: String(o.price),
    })),
    selectedOptionIds: p.selectedOptionIds,
  });

  // 9. Insert (coerce strings → numbers for current doublePrecision columns; will be removed after Phase B Task 9)
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
      selectedOptions: JSON.stringify(
        opts.map((o) => ({
          id: o.id,
          categoryId: o.categoryId,
          name: o.name,
          price: o.price,
        })),
      ),
      basePrice: Number(totals.basePrice),
      optionsTotal: Number(totals.optionsTotal),
      totalPrice: Number(totals.totalPrice),
      financingParams: p.financingParams ? JSON.stringify(p.financingParams) : null,
      roiParams: p.roiParams ? JSON.stringify(p.roiParams) : null,
      createdAt: new Date().toISOString(),
    })
    .returning();

  // 10. Fire-and-forget email (do not block the HTTP response)
  void sendQuoteEmail({
    quoteNumber: inserted.quoteNumber,
    machineName: inserted.machineName,
    totalPrice: totals.totalPrice, // pass the precise string from pricing, not the number from DB
    customerName: inserted.customerName,
    customerEmail: inserted.customerEmail,
    customerCompany: inserted.customerCompany,
    customerPhone: inserted.customerPhone,
    summaryUrl: `https://trinitybaq.com/quote/${inserted.quoteNumber}`,
  }).catch((err) => console.error("Email task error:", err));

  // 11. Respond
  res.status(201).json({ quoteNumber: inserted.quoteNumber });
});
