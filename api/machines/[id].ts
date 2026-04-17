import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../_db.js";
import { machines } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing slug" });
  }

  try {
    const [machine] = await db.select().from(machines).where(eq(machines.slug, id));
    if (!machine) {
      return res.status(404).json({ error: "Machine not found" });
    }
    return res.status(200).json(machine);
  } catch (error: any) {
    console.error("Error fetching machine:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
