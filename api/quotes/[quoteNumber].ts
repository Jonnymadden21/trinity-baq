import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { db } from "../_db";
import { quotes } from "../../shared/schema";
import { withErrorHandling, methodNotAllowed, HttpError } from "../_lib/handler";

const QUOTE_NUM_RE = /^[A-Za-z0-9-]{1,64}$/;

export default withErrorHandling(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const { quoteNumber } = req.query;
  const qn = typeof quoteNumber === "string" ? quoteNumber : undefined;
  if (!qn || !QUOTE_NUM_RE.test(qn)) throw new HttpError(400, "Invalid quote number");
  const [q] = await db.select().from(quotes).where(eq(quotes.quoteNumber, qn)).limit(1);
  if (!q) throw new HttpError(404, "Not found");
  res.status(200).json(q);
});
