import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "./_db.js";
import { machines } from "../shared/schema.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const allMachines = await db.select().from(machines);
    return res.status(200).json(allMachines);
  } catch (error: any) {
    console.error("Error fetching machines:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
