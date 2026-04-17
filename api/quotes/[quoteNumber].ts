import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../_db.js";
import { quotes } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { quoteNumber } = req.query;
  if (!quoteNumber || typeof quoteNumber !== "string") {
    return res.status(400).json({ error: "Missing quote number" });
  }

  try {
    const [quote] = await db
      .select()
      .from(quotes)
      .where(eq(quotes.quoteNumber, quoteNumber));

    if (!quote) {
      return res.status(404).json({ error: "Quote not found" });
    }
    return res.status(200).json(quote);
  } catch (error: any) {
    console.error("Error fetching quote:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
