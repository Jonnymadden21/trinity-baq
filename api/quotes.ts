import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_db.js";
import { quotes, insertQuoteSchema } from "../shared/schema.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const parsed = insertQuoteSchema.parse(req.body);
    const [quote] = await db.insert(quotes).values(parsed).returning();
    return res.status(201).json(quote);
  } catch (error: any) {
    console.error("Error creating quote:", error);
    return res.status(400).json({ error: error.message });
  }
}
